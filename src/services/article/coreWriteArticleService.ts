import { UserProfile } from "@/types/user";
import {
  validateImageFile,
  fetchMediaById,
  toMongoObjectId,
  mapTagsToObjects,
  generateArticleSlug,
  buildRevisionEntry,
  mapDocToArticle,
} from "@/lib/helper-article";
import {
  assertUniqueArticleSlug,
  assertUniqueArticleTitle,
  isPlaceholderArticleTitle,
  normalizeArticleTitle,
  resolveArticleSlug,
  titleNormalizedForStorage,
} from "@/lib/article-validation";
import { saveMediaDB } from "@/services/mediaService";
import { Db, ObjectId } from "mongodb";
import {
  Article,
  ArticleFormData,
  ArticleRevision,
  ArticleStatus,
  UpdateArticleFormData,
  StandardArticle,
  GalleryArticle,
  ArticleMediaStored,
  GalleryItemStored,
} from "@/types/article";
import logger from "@/lib/logger";
import { revalidateArticlePage } from "@/lib/cache/revalidate-article-page";
import { adminPanelHref } from "@/lib/admin-panel-path";
import { createAuditLog } from "@/services/auditLogService";
import { hasPermission, ROLES } from "@/lib/auth-client";
import {
  createBulkNotifications,
  createOneNotification,
} from "@/services/notificationService";
import type { CreateNotificationInput } from "@/types/notification";
import { NotificationType } from "@/types/notification";
import { Media } from "@/types/media";
import { Category } from "@/types/category";
import { AuditLogAction } from "@/types/auditLog";
import { createEditorActivity } from "@/services/analytics/editorActivityService";
import { canPickArticleAttribution } from "@/lib/editorialPublicationAccess";
import {
  buildLegacyArticlePath,
  resolveUrlFormatForNewArticle,
} from "@/lib/article-public-path";
import {
  buildPublicPathFields,
  recomputeArticlePublicPathFromUpdates,
} from "@/services/article/articlePublicPathService";

export function safeRevalidateArticlePublicPage(
  publicPath: string | null | undefined,
  previousPublicPath?: string | null | undefined,
) {
  try {
    const current =
      publicPath != null ? String(publicPath).trim() : "";
    const prev =
      previousPublicPath != null ? String(previousPublicPath).trim() : "";

    if (current) {
      revalidateArticlePage(
        current,
        prev && prev !== current ? prev : undefined,
      );
      return;
    }

    if (prev) {
      revalidateArticlePage(prev);
    }
  } catch (err) {
    logger.warn({ err, publicPath }, "revalidateArticlePage gagal");
  }
}

function toUniqueContributorObjectIds(
  raw: unknown,
): ObjectId[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: ObjectId[] = [];
  for (const item of raw) {
    const s = String(item).trim();
    if (!/^[a-f\d]{24}$/i.test(s)) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    try {
      out.push(new ObjectId(s));
    } catch {
      /* skip */
    }
  }
  return out;
}

/**
 * Field MongoDB (`authorId`, `editorId`, `contributorIds`) jika aktor boleh atribusi
 * dan payload menyertakan field tersebut — dipakai `updateArticle` dan alur approval.
 */
export async function resolveAttributionMongoUpdates(
  db: Db,
  role: string,
  payload: {
    authorId?: string;
    editorId?: string | null;
    contributorIds?: string[];
  },
): Promise<Record<string, unknown>> {
  if (!canPickArticleAttribution(role)) return {};
  const attributionUpdates: Record<string, unknown> = {};
  if (payload.authorId !== undefined) {
    if (
      typeof payload.authorId === "string" &&
      /^[a-f\d]{24}$/i.test(payload.authorId.trim())
    ) {
      const aid = new ObjectId(payload.authorId.trim());
      const u = await db.collection("users").findOne({
        _id: aid,
        deletedAt: { $in: [null, ""] },
      });
      if (u) attributionUpdates.authorId = aid;
    }
  }
  if (payload.editorId !== undefined) {
    if (
      payload.editorId === null ||
      (typeof payload.editorId === "string" && !String(payload.editorId).trim())
    ) {
      attributionUpdates.editorId = null;
    } else if (
      typeof payload.editorId === "string" &&
      /^[a-f\d]{24}$/i.test(payload.editorId.trim())
    ) {
      const eid = new ObjectId(payload.editorId.trim());
      const u = await db.collection("users").findOne({
        _id: eid,
        deletedAt: { $in: [null, ""] },
      });
      if (u) attributionUpdates.editorId = eid;
    }
  }
  if (payload.contributorIds !== undefined) {
    const cids = toUniqueContributorObjectIds(payload.contributorIds);
    if (cids.length === 0) {
      attributionUpdates.contributorIds = [];
    } else {
      const count = await db.collection("users").countDocuments({
        _id: { $in: cids },
        deletedAt: { $in: [null, ""] },
      });
      if (count !== cids.length) {
        throw Object.assign(new Error("Invalid contributorIds"), {
          status: 400,
        });
      }
      attributionUpdates.contributorIds = cids;
    }
  }
  return attributionUpdates;
}

function mongoUserToProfile(
  doc: Record<string, unknown> | null | undefined,
): UserProfile | null {
  if (!doc || doc._id == null) return null;
  const id = doc._id;
  return {
    _id: id instanceof ObjectId ? id.toString() : String(id),
    name: String(doc.name ?? ""),
    email: String(doc.email ?? ""),
    slug:
      doc.slug !== undefined && doc.slug !== null && doc.slug !== ""
        ? String(doc.slug)
        : undefined,
    avatar: doc.avatar as UserProfile["avatar"],
    role: (doc.role ?? "SUBSCRIBER") as UserProfile["role"],
    teamId: doc.teamId as UserProfile["teamId"],
  };
}

/** Konteks pengguna untuk mutasi artikel (permission + audit trail). */
export type ArticleMutationActor = {
  _id: ObjectId | string;
  role?: string;
  name: string;
  email: string;
};

/** @deprecated Gunakan ArticleMutationActor — alias untuk kompatibilitas pemanggil create. */
export type CreateArticleAuthor = ArticleMutationActor;

/** Map role string penulis ke key `ROLES` untuk `UserProfile` / editor activity */
function roleKeyFromActorRole(roleRaw: string | undefined): keyof typeof ROLES {
  const r = (roleRaw || "").toLowerCase();
  const found = (Object.keys(ROLES) as (keyof typeof ROLES)[]).find(
    (k) => ROLES[k].toLowerCase() === r,
  );
  return found ?? "WRITER";
}

async function resolveFeaturedImageForCreate(
  db: Db,
  featuredImage: unknown,
): Promise<ArticleMediaStored | null> {
  if (!featuredImage) return null;

  let mediaIdStr: string | null = null;
  let customCaption: string | null = null;
  let customCredit: string | null = null;

  if (typeof featuredImage === "string" && featuredImage.trim() !== "") {
    mediaIdStr = featuredImage.trim();
  } else if (typeof featuredImage === "object" && featuredImage !== null) {
    const fiObj = featuredImage as any;
    if (fiObj.mediaId || fiObj._id) {
      mediaIdStr = String(fiObj.mediaId || fiObj._id).trim();
    }
    if (typeof fiObj.caption === "string") customCaption = fiObj.caption.trim();
    if (typeof fiObj.credit === "string") customCredit = fiObj.credit.trim();
  }

  if (!mediaIdStr) return null;

  let mediaDoc: any = null;
  try {
    mediaDoc = await db
      .collection("media")
      .findOne({ _id: new ObjectId(mediaIdStr) });
  } catch (lookupErr) {
    logger.error(
      { err: lookupErr, featuredImage },
      "Gagal query media untuk featuredImage",
    );
  }

  if (!mediaDoc) {
    throw Object.assign(new Error("Invalid featuredImage id"), {
      status: 400,
    });
  }

  return {
    mediaId: mediaDoc._id.toString(),
    filename: String(mediaDoc.filename ?? ""),
    caption: customCaption !== null ? customCaption : (mediaDoc.caption ?? ""),
    credit: customCredit !== null ? customCredit : (mediaDoc.credit ?? mediaDoc.takenBy ?? ""),
  };
}

async function resolveContentMediaForCreate(
  db: Db,
  format: string,
  contentMediaRaw: unknown[],
): Promise<ArticleMediaStored[]> {
  if (
    format !== "STANDARD" ||
    !Array.isArray(contentMediaRaw) ||
    contentMediaRaw.length === 0
  ) {
    return [];
  }

  const requestedItems: Array<{
    mediaIdStr: string;
    customCaption: string | null;
    customCredit: string | null;
  }> = [];
  const objectIds: ObjectId[] = [];

  for (const item of contentMediaRaw) {
    let mediaIdStr: string | null = null;
    let customCaption: string | null = null;
    let customCredit: string | null = null;

    if (typeof item === "string" && item.trim() !== "") {
      mediaIdStr = item.trim();
    } else if (typeof item === "object" && item !== null) {
      const fiObj = item as any;
      if (fiObj.mediaId || fiObj._id) {
        mediaIdStr = String(fiObj.mediaId || fiObj._id).trim();
      }
      if (typeof fiObj.caption === "string") customCaption = fiObj.caption.trim();
      if (typeof fiObj.credit === "string") customCredit = fiObj.credit.trim();
    }

    if (mediaIdStr) {
      try {
        const oid = new ObjectId(mediaIdStr);
        objectIds.push(oid);
        requestedItems.push({ mediaIdStr: oid.toString(), customCaption, customCredit });
      } catch {
        // ignore
      }
    }
  }

  if (objectIds.length === 0) return [];

  const mediaDocs = await db.collection("media").find({ _id: { $in: objectIds } }).toArray();
  const mediaMap = new Map(mediaDocs.map((doc) => [doc._id.toString(), doc]));

  const result: ArticleMediaStored[] = [];
  for (const req of requestedItems) {
    const mediaDoc = mediaMap.get(req.mediaIdStr);
    if (mediaDoc) {
      result.push({
        mediaId: mediaDoc._id.toString(),
        filename: String(mediaDoc.filename ?? ""),
        caption: req.customCaption !== null ? req.customCaption : (mediaDoc.caption ?? ""),
        credit: req.customCredit !== null ? req.customCredit : (mediaDoc.credit ?? ""),
      });
    }
  }
  return result;
}

async function resolveGalleryItemsForCreate(
  db: Db,
  format: string,
  galleryItemsRaw: unknown[],
): Promise<GalleryItemStored[]> {
  if (
    format !== "GALLERY" ||
    !Array.isArray(galleryItemsRaw) ||
    galleryItemsRaw.length === 0
  ) {
    return [];
  }

  const requestedItems: Array<{
    mediaIdStr: string;
    customCaption: string | null;
    customCredit: string | null;
    order: number;
  }> = [];
  const objectIds: ObjectId[] = [];

  for (const [index, item] of galleryItemsRaw.entries()) {
    if (typeof item === "object" && item !== null) {
      const fiObj = item as any;
      let mediaIdStr: string | null = null;
      if (fiObj.mediaId || fiObj._id) {
        mediaIdStr = String(fiObj.mediaId || fiObj._id).trim();
      }
      if (mediaIdStr) {
        try {
          const oid = new ObjectId(mediaIdStr);
          objectIds.push(oid);
          let customCaption: string | null = null;
          let customCredit: string | null = null;
          if (typeof fiObj.caption === "string") customCaption = fiObj.caption.trim();
          if (typeof fiObj.credit === "string") customCredit = fiObj.credit.trim();
          const order = typeof fiObj.order === "number" ? fiObj.order : index;
          requestedItems.push({ mediaIdStr: oid.toString(), customCaption, customCredit, order });
        } catch {
          // ignore
        }
      }
    }
  }

  if (objectIds.length === 0) return [];

  const mediaDocs = await db.collection("media").find({ _id: { $in: objectIds } }).toArray();
  const mediaMap = new Map(mediaDocs.map((doc) => [doc._id.toString(), doc]));

  const result: GalleryItemStored[] = [];
  for (const req of requestedItems) {
    const mediaDoc = mediaMap.get(req.mediaIdStr);
    if (mediaDoc) {
      result.push({
        mediaId: mediaDoc._id.toString(),
        filename: String(mediaDoc.filename ?? ""),
        caption: req.customCaption !== null ? req.customCaption : (mediaDoc.caption ?? ""),
        credit: req.customCredit !== null ? req.customCredit : (mediaDoc.credit ?? ""),
        order: req.order,
      });
    }
  }
  return result.sort((a, b) => a.order - b.order);
}

function resolveRelatedArticles(
  itemsRaw: unknown[],
  actorOid: ObjectId
): any[] {
  if (!Array.isArray(itemsRaw) || itemsRaw.length === 0) return [];
  const result: any[] = [];
  for (const [index, item] of itemsRaw.entries()) {
    if (typeof item === "object" && item !== null) {
      const it = item as any;
      let aidStr: string | null = null;
      if (it.article_id) aidStr = String(it.article_id).trim();
      else if (it._id) aidStr = String(it._id).trim(); // Just in case it's an array of articles directly
      
      if (aidStr) {
        try {
          const articleOid = new ObjectId(aidStr);
          result.push({
            _id: new ObjectId(),
            article_id: articleOid,
            order: index,
            createdAt: it.createdAt ? new Date(it.createdAt) : new Date(),
            createdBy: it.createdBy ? new ObjectId(String(it.createdBy)) : actorOid,
          });
        } catch {
          // ignore
        }
      }
    }
  }
  return result;
}

// ─── Create ───────────────────────────────────────────────────────────────────
export async function createArticle(
  db: Db,
  payload: ArticleFormData,
  author: CreateArticleAuthor,
): Promise<Article> {
  const previewTitle =
    typeof (payload as { title?: string }).title === "string"
      ? (payload as { title?: string }).title
      : undefined;

  logger.info(
    {
      titlePreview: previewTitle?.slice(0, 120),
      authorId:
        typeof author._id === "string" ? author._id : author._id.toString(),
    },
    "createArticle dimulai",
  );

  try {
    // Permission check: must have create_article (case-insensitive)
    const role = (author.role || "").toString().toLowerCase();
    if (!hasPermission(role, "create_article")) {
      throw Object.assign(
        new Error("Forbidden: missing create_article permission"),
        { status: 403 },
      );
    }

    const actorName = author.name?.trim();
    const actorEmail = author.email?.trim();
    const actorRole = author.role?.trim();
    if (!actorName || !actorEmail) {
      throw Object.assign(
        new Error("name dan email penulis wajib untuk audit artikel"),
        { status: 400 },
      );
    }

    // Ambil format, default ke "STANDARD" jika tidak ada
    const format =
      (payload as any).format === "GALLERY" ? "GALLERY" : "STANDARD";
    const {
      title,
      content,
      excerpt = "",
      categoryId,
      tags = [],
      featuredImage,
      contentMedia = [],
      status = ArticleStatus.DRAFT,
      scheduledAt,
      galleryItems = [],
      authorId: payloadAuthorId,
      editorId: payloadEditorId,
      contributorIds: rawContributorIds,
      relatedArticles: rawRelatedArticles = [],
    } = payload as any;

    // ── Validasi field wajib ──
    if (!title)
      throw Object.assign(new Error("Title is required"), { status: 400 });

    const trimmedTitle =
      typeof title === "string" ? title.trim() : String(title).trim();
    if (!trimmedTitle) {
      throw Object.assign(new Error("Title is required"), { status: 400 });
    }

    await assertUniqueArticleTitle(db, trimmedTitle);

    const draftSlugId = new ObjectId();
    const articleSlug = isPlaceholderArticleTitle(trimmedTitle)
      ? resolveArticleSlug(trimmedTitle, draftSlugId)
      : generateArticleSlug(trimmedTitle);
    await assertUniqueArticleSlug(db, articleSlug);

    if (format === "STANDARD" && !content)
      throw Object.assign(
        new Error("Content is required for STANDARD article"),
        {
          status: 400,
        },
      );
    if (
      format === "GALLERY" &&
      (!Array.isArray(galleryItems) || galleryItems.length < 1)
    )
      throw Object.assign(
        new Error(
          "galleryItems is required and must have at least 1 item for GALLERY article",
        ),
        { status: 400 },
      );

    const mongoCategoryId = toMongoObjectId(categoryId);
    if (!mongoCategoryId)
      throw Object.assign(new Error("Invalid category ID"), { status: 400 });

    /** Kategori + featured + konten media independen — satu round-trip paralel */
    const [categoryExists, resolvedFeaturedImage, resolvedContentMedia, resolvedGalleryItems] =
      await Promise.all([
        db.collection("categories").findOne(
          { _id: mongoCategoryId },
          { projection: { _id: 1, slug: 1, name: 1 } },
        ),
        resolveFeaturedImageForCreate(db, featuredImage),
        resolveContentMediaForCreate(db, format, contentMedia),
        resolveGalleryItemsForCreate(db, format, galleryItems)
      ]);

    if (!categoryExists)
      throw Object.assign(new Error("Category not found"), { status: 400 });

    if (format === "GALLERY" && resolvedGalleryItems.length === 0) {
      throw Object.assign(
        new Error(
          "No valid media found for galleryItems",
        ),
        { status: 400 },
      );
    }

    // ── Validasi scheduledAt (hanya terima tanggal di masa depan) ──
    let validScheduledAt: Date | null = null;
    if (scheduledAt) {
      const d = new Date(scheduledAt);
      if (!isNaN(d.getTime()) && d > new Date()) validScheduledAt = d;
    }

    const actorOid =
      typeof author._id === "string" ? new ObjectId(author._id) : author._id;
    const createdById = actorOid;

    let resolvedAuthorId = actorOid;
    let resolvedEditorId: ObjectId | null = null;
    let resolvedContributorIds: ObjectId[] = [];

    if (canPickArticleAttribution(role)) {
      if (
        typeof payloadAuthorId === "string" &&
        /^[a-f\d]{24}$/i.test(payloadAuthorId.trim())
      ) {
        const aid = new ObjectId(payloadAuthorId.trim());
        const u = await db.collection("users").findOne({
          _id: aid,
          deletedAt: { $in: [null, ""] },
        });
        if (u) resolvedAuthorId = aid;
      }

      if (
        payloadEditorId === null ||
        payloadEditorId === undefined ||
        (typeof payloadEditorId === "string" && !payloadEditorId.trim())
      ) {
        resolvedEditorId = null;
      } else if (
        typeof payloadEditorId === "string" &&
        /^[a-f\d]{24}$/i.test(payloadEditorId.trim())
      ) {
        const eid = new ObjectId(payloadEditorId.trim());
        const u = await db.collection("users").findOne({
          _id: eid,
          deletedAt: { $in: [null, ""] },
        });
        if (u) resolvedEditorId = eid;
      }

      const cids = toUniqueContributorObjectIds(rawContributorIds);
      if (cids.length > 0) {
        const count = await db.collection("users").countDocuments({
          _id: { $in: cids },
          deletedAt: { $in: [null, ""] },
        });
        if (count !== cids.length) {
          throw Object.assign(
            new Error("One or more contributorIds are invalid"),
            { status: 400 },
          );
        }
        resolvedContributorIds = cids;
      }
    }

    const authorId = resolvedAuthorId;

    const urlFormat = resolveUrlFormatForNewArticle();
    const createPublishedAt = status === "PUBLISHED" ? new Date() : null;
    const categorySlug = categoryExists?.slug
      ? String(categoryExists.slug).trim()
      : null;
    const { publicPath: createPublicPath } = buildPublicPathFields({
      slug: articleSlug,
      publishedAt: createPublishedAt,
      status,
      urlFormat,
      categorySlug,
    });

    let doc: any = {
      title: trimmedTitle,
      titleNormalized: titleNormalizedForStorage(trimmedTitle),
      slug: articleSlug,
      excerpt,
      categoryId: mongoCategoryId,
      tags: mapTagsToObjects(tags),
      featuredImage: resolvedFeaturedImage ?? undefined,
      authorId,
      createdById,
      editorId: resolvedEditorId,
      contributorIds: resolvedContributorIds,
      status,
      isFeatured: false,
      isHeadline: false,
      isBreaking: false,
      isPopular: false,
      isEditorChoices: false,
      viewCount: 0,
      metaTitle: trimmedTitle,
      metaDesc: excerpt,
      scheduledAt: validScheduledAt,
      publishedAt: createPublishedAt,
      publishedBy: status === "PUBLISHED" ? actorOid : null,
      submittedAt: status !== "DRAFT" ? new Date() : null,
      createdAt: new Date(),
      updatedAt: new Date(),
      revisionHistory: [],
      format,
      relatedArticles: resolveRelatedArticles(rawRelatedArticles, actorOid),
      urlFormat,
      publicPath: createPublicPath,
    };
    if (format === "STANDARD") {
      doc.content = content;
      doc.contentMedia = resolvedContentMedia;
    } else if (format === "GALLERY") {
      doc.content = content;
      doc.galleryItems = resolvedGalleryItems;
    }

    const insertPromise = db.collection("articles").insertOne(doc);
    const authorRowPromise = db
      .collection("users")
      .findOne({ _id: resolvedAuthorId });

    const [result, authorRow] = await Promise.all([
      insertPromise,
      authorRowPromise,
    ]);
    const insertedId = result.insertedId;

    const editorPromise = resolvedEditorId
      ? db.collection("users").findOne({ _id: resolvedEditorId })
      : Promise.resolve(null);
    const createdByPromise = db
      .collection("users")
      .findOne({ _id: actorOid });
    const contribPromise =
      resolvedContributorIds.length > 0
        ? db
            .collection("users")
            .find({ _id: { $in: resolvedContributorIds } })
            .toArray()
        : Promise.resolve([] as Record<string, unknown>[]);

    const [editorRow, createdByRow, contribRows] = await Promise.all([
      editorPromise,
      createdByPromise,
      contribPromise,
    ]);

    const editorProfile = mongoUserToProfile(
      editorRow as Record<string, unknown> | null,
    );
    const createdByProfile = mongoUserToProfile(
      createdByRow as Record<string, unknown> | null,
    );
    const contributorsProfiles: UserProfile[] = (
      contribRows as Record<string, unknown>[]
    )
      .map((r) => mongoUserToProfile(r))
      .filter((p): p is UserProfile => p != null);

    const authorProfile: UserProfile =
      mongoUserToProfile(authorRow as Record<string, unknown> | null) ?? {
        _id: resolvedAuthorId.toString(),
        name: actorName,
        email: actorEmail,
        role: roleKeyFromActorRole(actorRole),
      };

    const articleIdStr = insertedId.toString();
    const notifyActor = {
      _id: typeof author._id === "string" ? author._id : author._id.toString(),
      name: actorName,
      email: actorEmail,
    };

    const actorIdStr =
      typeof author._id === "string" ? author._id : author._id.toString();

    /** Audit + aktivitas redaksi paralel; notifikasi menyusul di dalam task yang sama */
    await Promise.all([
      Promise.allSettled([
        createAuditLog(db, {
          actor: {
            _id: actorIdStr,
            name: actorName,
            email: actorEmail,
          },
          action: AuditLogAction.CREATE,
          entity: "articles",
          entityId: insertedId,
          details: `Membuat artikel baru (${format}): "${title}" — status ${status}`,
          newValue: {
            status,
            format,
            slug: doc.slug,
            title,
          },
        }),
        createEditorActivity(db, {
          actor: {
            _id: actorIdStr,
            name: actorName,
            email: actorEmail,
          },
          action: AuditLogAction.CREATE,
          statusFrom: ArticleStatus.DRAFT,
          statusTo: status as ArticleStatus,
          article: {
            _id: insertedId.toHexString(),
            title,
            author: authorProfile,
          },
        }),
      ]).then((results) => {
        if (results[0].status === "rejected") {
          logger.error(
            { err: results[0].reason, articleId: articleIdStr },
            "createAuditLog gagal setelah insert artikel",
          );
        }
        if (results[1].status === "rejected") {
          logger.warn(
            { err: results[1].reason, articleId: articleIdStr },
            "createEditorActivity gagal setelah createArticle",
          );
        }
      }),
      (async () => {
        if (status === ArticleStatus.PENDING_REVIEW) {
          try {
            const editorDocs = await db
              .collection("users")
              .find({ role: { $regex: /^editor$/i } })
              .project({ _id: 1, name: 1, email: 1, avatar: 1 })
              .toArray();

            const bulkInputs: CreateNotificationInput[] = [];
            for (const u of editorDocs) {
              const email = String(u.email ?? "").trim();
              const name = String(u.name ?? "").trim();
              if (!email || !name) continue;
              const rid =
                u._id instanceof ObjectId ? u._id.toHexString() : String(u._id);
              const av = u.avatar;
              bulkInputs.push({
                receiver: {
                  _id: rid,
                  name,
                  email,
                  ...(typeof av === "string" && av.trim()
                    ? { avatarUrl: av.trim() }
                    : {}),
                },
                actor: notifyActor,
                type: NotificationType.ARTICLE_SUBMITTED,
                title: "Artikel menunggu review",
                message: `${actorName} mengirim artikel "${title}" untuk ditinjau.`,
                targetId: articleIdStr,
                link: adminPanelHref(`articles/${articleIdStr}`),
                isPushSent: false,
              });
            }

            if (bulkInputs.length > 0) {
              await createBulkNotifications(db, bulkInputs);
            }
          } catch (notifErr) {
            logger.error(
              { err: notifErr, articleId: articleIdStr },
              "createArticle: notifikasi ke editor gagal",
            );
          }
        } else if (status === ArticleStatus.PUBLISHED) {
          try {
            await createOneNotification(db, {
              receiver: notifyActor,
              actor: notifyActor,
              type: NotificationType.ARTICLE_PUBLISHED,
              title: "Artikel telah terbit",
              message: `Artikel Anda "${title}" sudah dipublikasikan.`,
              targetId: articleIdStr,
              link:
                doc.publicPath
                  ? String(doc.publicPath)
                  : adminPanelHref(`articles/${articleIdStr}`),
              isPushSent: false,
            });
          } catch (notifErr) {
            logger.error(
              { err: notifErr, articleId: articleIdStr },
              "createArticle: notifikasi publish ke penulis gagal",
            );
          }
        } else if (status === ArticleStatus.SCHEDULED) {
          try {
            const when =
              validScheduledAt && !Number.isNaN(validScheduledAt.getTime())
                ? validScheduledAt.toLocaleString("id-ID", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })
                : "";
            await createOneNotification(db, {
              receiver: notifyActor,
              actor: notifyActor,
              type: NotificationType.ARTICLE_APPROVAL,
              title: "Artikel dijadwalkan terbit",
              message: when
                ? `Artikel "${title}" dijadwalkan terbit pada ${when}.`
                : `Artikel "${title}" telah dijadwalkan untuk terbit.`,
              targetId: articleIdStr,
              link: adminPanelHref(`articles/${articleIdStr}`),
              isPushSent: false,
            });
          } catch (notifErr) {
            logger.error(
              { err: notifErr, articleId: articleIdStr },
              "createArticle: notifikasi terjadwal ke penulis gagal",
            );
          }
        }
      })(),
    ]);

    logger.info(
      {
        articleId: insertedId.toString(),
        slug: doc.slug,
        format,
        status: doc.status,
      },
      "createArticle selesai",
    );

    if (
      doc.status === ArticleStatus.PUBLISHED ||
      doc.status === ArticleStatus.SCHEDULED
    ) {
      safeRevalidateArticlePublicPage(
        doc.publicPath ?? null,
        null,
      );
    }

    if (format === "STANDARD") {
      return mapDocToArticle({
        ...doc,
        _id: insertedId,
        category: categoryExists,
        author: authorProfile,
        editor: editorProfile,
        createdBy: createdByProfile,
        contributors: contributorsProfiles,
      });
    }

    return mapDocToArticle({
      ...doc,
      _id: insertedId,
      category: categoryExists,
      author: authorProfile,
      editor: editorProfile,
      createdBy: createdByProfile,
      contributors: contributorsProfiles,
    });
  } catch (err) {
    logger.error({ err }, "createArticle gagal");
    throw err;
  }
}

// ─── Helper: Determine Final Status Based on Role ────────────────────────────
/**
 * Menentukan status akhir artikel berdasarkan role user.
 * Role di bawah head-of (reporter, writer, contributor, editor) akan memaksa status ke PENDING_REVIEW.
 * Role head-of ke atas (head-of, managing-editor, editor-in-chief, admin) dapat mengubah status sesuai input.
 */
function determineFinalStatus(
  userRole: string,
  payloadStatus: ArticleStatus | undefined,
  existingStatus: ArticleStatus,
): ArticleStatus {
  const juniorRoles = ["reporter", "writer", "contributor"];

  // Jika role adalah junior (di bawah head-of), paksa status ke PENDING_REVIEW
  if (
    existingStatus !== ArticleStatus.DRAFT &&
    juniorRoles.includes(userRole)
  ) {
    return ArticleStatus.PENDING_REVIEW;
  }

  // Jika role adalah head-of atau di atas, gunakan payload status atau keep existing
  return payloadStatus || existingStatus;
}

// ─── Update ───────────────────────────────────────────────────────────────────
export async function updateArticle(
  db: Db,
  articleId: string,
  payload: UpdateArticleFormData,
  actor: ArticleMutationActor,
): Promise<Article> {
  logger.info({ articleId }, "updateArticle dimulai");

  try {
    if (!/^[a-f\d]{24}$/i.test(articleId)) {
      throw Object.assign(new Error("Invalid article ID"), { status: 400 });
    }

    const query = { _id: new ObjectId(articleId) };
    const existing = await db.collection("articles").findOne(query);
    if (!existing)
      throw Object.assign(new Error("Article not found"), { status: 404 });

    const actorName = actor.name?.trim();
    const actorEmail = actor.email?.trim();
    if (!actorName || !actorEmail) {
      throw Object.assign(
        new Error("name dan email wajib untuk audit artikel"),
        { status: 400 },
      );
    }

    const userId = actor._id?.toString?.() ?? actor._id;
    const role = (actor.role || "").toString().toLowerCase();
    let canEdit = false;
    if (hasPermission(role, "edit_any_article")) {
      canEdit = true;
    } else if (hasPermission(role, "edit_own_article")) {
      const authorId = existing.authorId?.toString?.() ?? existing.authorId;
      if (authorId && userId && authorId === userId) {
        canEdit = true;
      }
    }
    if (!canEdit)
      throw Object.assign(new Error("Forbidden: missing edit permission"), {
        status: 403,
      });

    // ─── Format Validation ────────────────────────────────────────────────────
    // Format tidak bisa diubah setelah artikel dibuat (immutable property)
    const existingFormat = existing.format || "STANDARD";
    if (payload.format && payload.format !== existingFormat) {
      throw Object.assign(
        new Error(
          `Article format cannot be changed. Current format: ${existingFormat}`,
        ),
        { status: 400 },
      );
    }

    // scheduledAt validation
    let validScheduledAt: Date | null = null;
    if (payload.scheduledAt) {
      const d = new Date(payload.scheduledAt);
      if (!isNaN(d.getTime()) && d > new Date()) validScheduledAt = d;
    }

    // Handle featuredImage: null, File, string, or ArticleMedia object
    let resolvedFeaturedImage: ArticleMediaStored | null | undefined = undefined;
    let shouldUpdateFeaturedImage = false;
    const oldIdStr = existing.featuredImage?.mediaId?.toString() || null;

    if (payload.featuredImage !== undefined) {
      if (payload.featuredImage instanceof File) {
        shouldUpdateFeaturedImage = true;
        validateImageFile(payload.featuredImage);
        const media = await saveMediaDB(db, payload.featuredImage, {}, actor);
        resolvedFeaturedImage = {
          mediaId: media._id.toString(),
          filename: media.filename,
          caption: media.caption ?? "",
          credit: media.credit ?? "",
        };
      } else if (payload.featuredImage === null) {
        if (oldIdStr !== null) {
          resolvedFeaturedImage = null;
          shouldUpdateFeaturedImage = true;
        }
      } else {
        const resImg = await resolveFeaturedImageForCreate(db, payload.featuredImage);
        if (resImg) {
          if (resImg.mediaId !== oldIdStr || (resImg.caption !== existing.featuredImage?.caption) || (resImg.credit !== existing.featuredImage?.credit)) {
             resolvedFeaturedImage = resImg;
             shouldUpdateFeaturedImage = true;
          }
        } else if (oldIdStr !== null) {
           resolvedFeaturedImage = null;
           shouldUpdateFeaturedImage = true;
        }
      }
    }

    // Validasi dan filter contentMedia
    let resolvedContentMedia: ArticleMediaStored[] | undefined = undefined;
    if (payload.contentMedia !== undefined && existingFormat === "STANDARD") {
      const newContentMediaIdsRaw = Array.isArray(payload.contentMedia) ? payload.contentMedia : [];
      resolvedContentMedia = await resolveContentMediaForCreate(db, existingFormat, newContentMediaIdsRaw);
    }

    // Validasi dan filter galleryItems
    let resolvedGalleryItems: GalleryItemStored[] | undefined = undefined;
    if (payload.galleryItems !== undefined && existingFormat === "GALLERY") {
      const newGalleryItemsRaw = Array.isArray(payload.galleryItems) ? payload.galleryItems : [];
      resolvedGalleryItems = await resolveGalleryItemsForCreate(db, existingFormat, newGalleryItemsRaw);
    }

    const mongoCategoryId =
      payload.categoryId !== undefined
        ? toMongoObjectId(payload.categoryId)
        : undefined;

    // ───────────────── POINT 1: Deteksi Role & Tentukan Status Final ────────────
    const finalStatus = determineFinalStatus(
      role,
      payload.status as ArticleStatus | undefined,
      existing.status as ArticleStatus,
    );
    const statusChanged = finalStatus !== existing.status;

    // ───────────────── POINT 2: Tambahkan Data ke Revision History ──────────────
    // Selalu buat entry revisi ketika ada update, dengan from/to sesuai perubahan status
    const revisionEntry = buildRevisionEntry(
      typeof userId === "string" ? new ObjectId(userId) : userId,
      existing.status as ArticleStatus,
      finalStatus,
      payload.reason, // Ambil reason dari payload jika ada
    );

    const p = payload as ArticleFormData;
    const attributionUpdates = await resolveAttributionMongoUpdates(db, role, {
      authorId: p.authorId,
      editorId: p.editorId,
      contributorIds: p.contributorIds,
    });

    let titleSlugUpdates: Record<string, unknown> = {};
    if (payload.title !== undefined && payload.title !== null) {
      const trimmedTitle = String(payload.title).trim();
      if (!trimmedTitle) {
        throw Object.assign(new Error("Title is required"), { status: 400 });
      }

      const existingTitle = String(existing.title ?? "");
      const titleChanged =
        normalizeArticleTitle(trimmedTitle) !==
        normalizeArticleTitle(existingTitle);

      if (titleChanged) {
        await assertUniqueArticleTitle(db, trimmedTitle, articleId);

        const newSlug = isPlaceholderArticleTitle(trimmedTitle)
          ? resolveArticleSlug(trimmedTitle, new ObjectId(articleId))
          : generateArticleSlug(trimmedTitle);
        await assertUniqueArticleSlug(db, newSlug, articleId);

        titleSlugUpdates = {
          title: trimmedTitle,
          metaTitle: trimmedTitle,
          titleNormalized: titleNormalizedForStorage(trimmedTitle),
          slug: newSlug,
        };
      }
    }

    const updates: Record<string, unknown> = {
      ...attributionUpdates,
      ...titleSlugUpdates,
      ...(payload.content !== undefined && { content: payload.content }),
      ...(payload.excerpt !== undefined && {
        excerpt: payload.excerpt,
        metaDescription: payload.excerpt,
      }),
      ...(mongoCategoryId !== undefined && { categoryId: mongoCategoryId }),
      ...(payload.tags !== undefined && {
        tags: mapTagsToObjects(payload.tags),
      }),
      ...(shouldUpdateFeaturedImage && { featuredImage: resolvedFeaturedImage }),
      ...(resolvedContentMedia !== undefined && {
        contentMedia: resolvedContentMedia,
      }),
      ...(resolvedGalleryItems !== undefined && {
        galleryItems: resolvedGalleryItems,
      }),
      ...(payload.relatedArticles !== undefined && {
        relatedArticles: resolveRelatedArticles(payload.relatedArticles, typeof userId === "string" ? new ObjectId(userId) : userId),
      }),
      status: finalStatus, // Gunakan status yang sudah ditentukan berdasarkan role
      ...(payload.scheduledAt !== undefined && {
        scheduledAt: validScheduledAt,
      }),
      updatedAt: new Date(),
    };

    // Auto-set publishedAt when transitioning to PUBLISHED
    if (
      finalStatus === ArticleStatus.PUBLISHED &&
      existing.status !== ArticleStatus.PUBLISHED
    ) {
      updates.publishedAt = new Date();
    }

    // dari PENDING_REVIEW ke published / scheduled / rejected: editor dapat mengisi editorId
    if (
      existing.status === ArticleStatus.PENDING_REVIEW &&
      [
        ArticleStatus.SCHEDULED,
        ArticleStatus.PUBLISHED,
        ArticleStatus.REJECTED,
      ].includes(finalStatus) &&
      role === ROLES.EDITOR
    ) {
      if (!Object.prototype.hasOwnProperty.call(attributionUpdates, "editorId")) {
        updates.editorId =
          typeof userId === "string" ? new ObjectId(userId) : userId;
      }
    }

    // lakukan pengecekan: jika finalstatus nya == publised, dan revisionentry.from dan revisionentry.to nya berbeda, maka pastikan actionnya adalah publish, bukan update serta publishedBy nya diisi dengan userId
    let actionActivity: AuditLogAction = AuditLogAction.UPDATE;
    if (finalStatus === ArticleStatus.PUBLISHED && statusChanged) {
      actionActivity = AuditLogAction.PUBLISH;
      updates.publishedBy =
        typeof userId === "string" ? new ObjectId(userId) : userId;
    }

    const pathFields = await recomputeArticlePublicPathFromUpdates(
      db,
      existing,
      updates,
    );
    updates.publicPath = pathFields.publicPath;
    updates.urlFormat = pathFields.urlFormat;

    // ───────────────── POINT 3: Update Article dengan $set & $push Atomik ──────
    // Gabungkan update regular fields ($set) dan tambah revision ke array ($push)
    await db.collection("articles").updateOne(query, {
      $set: updates,
      $push: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        revisionHistory: { $each: [revisionEntry] } as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    });

    const updated = await db.collection("articles").findOne(query);
    if (!updated) throw new Error("Article not found after update");

    try {
      await createAuditLog(db, {
        actor: {
          _id: typeof actor._id === "string" ? actor._id : actor._id.toString(),
          name: actorName,
          email: actorEmail,
        },
        action:
          finalStatus === ArticleStatus.PUBLISHED
            ? AuditLogAction.PUBLISH
            : finalStatus === ArticleStatus.SCHEDULED
              ? AuditLogAction.SCHEDULE
              : finalStatus === ArticleStatus.REJECTED
                ? AuditLogAction.REJECT
                : AuditLogAction.UPDATE,
        entity: "articles",
        entityId: articleId,
        // details: `Memperbarui artikel "${String(existing.title ?? "").slice(0, 120)}": ${existing.status} → ${finalStatus}`,
        details: `Memperbarui artikel (${updated.format}): "${updated.title}" — status ${finalStatus}`,
        oldValue: mapDocToArticle(existing),
        newValue: mapDocToArticle(updated),
      });
    } catch (auditErr) {
      logger.error(
        { err: auditErr, articleId },
        "createAuditLog gagal setelah updateArticle",
      );
    }

    if (statusChanged) {
      const notifyActor = {
        _id: typeof actor._id === "string" ? actor._id : actor._id.toString(),
        name: actorName,
        email: actorEmail,
      };
      const slugStr = String(updated.slug ?? "");
      const titleStr = String(updated.title ?? existing.title ?? "");

      if (finalStatus === ArticleStatus.PENDING_REVIEW) {
        try {
          const editorDocs = await db
            .collection("users")
            .find({ role: { $regex: /^editor$/i } })
            .project({ _id: 1, name: 1, email: 1, avatar: 1 })
            .toArray();

          const bulkInputs: CreateNotificationInput[] = [];
          for (const u of editorDocs) {
            const email = String(u.email ?? "").trim();
            const name = String(u.name ?? "").trim();
            if (!email || !name) continue;
            const rid =
              u._id instanceof ObjectId ? u._id.toHexString() : String(u._id);
            const av = u.avatar;
            bulkInputs.push({
              receiver: {
                _id: rid,
                name,
                email,
                ...(typeof av === "string" && av.trim()
                  ? { avatarUrl: av.trim() }
                  : {}),
              },
              actor: notifyActor,
              type: NotificationType.ARTICLE_SUBMITTED,
              title: "Artikel menunggu review",
              message: `${actorName} memperbarui artikel "${titleStr}" — menunggu review.`,
              targetId: articleId,
              link: adminPanelHref(`articles/${articleId}`),
              isPushSent: false,
            });
          }

          if (bulkInputs.length > 0) {
            await createBulkNotifications(db, bulkInputs);
          }
        } catch (notifErr) {
          logger.error(
            { err: notifErr, articleId },
            "updateArticle: notifikasi ke editor gagal",
          );
        }
      } else if (finalStatus === ArticleStatus.PUBLISHED) {
        try {
          const rawAid = existing.authorId;
          if (rawAid) {
            const authorOid =
              rawAid instanceof ObjectId
                ? rawAid
                : new ObjectId(String(rawAid));
            const authorDoc = await db
              .collection("users")
              .findOne({ _id: authorOid });
            const remail = String(authorDoc?.email ?? "").trim();
            const rname = String(authorDoc?.name ?? "").trim();
            if (authorDoc && remail && rname) {
              const rav = authorDoc.avatar;
              await createOneNotification(db, {
                receiver: {
                  _id: authorOid.toHexString(),
                  name: rname,
                  email: remail,
                  ...(typeof rav === "string" && rav.trim()
                    ? { avatarUrl: rav.trim() }
                    : {}),
                },
                actor: notifyActor,
                type: NotificationType.ARTICLE_PUBLISHED,
                title: "Artikel telah terbit",
                message: `Artikel Anda "${titleStr}" sudah dipublikasikan.`,
                targetId: articleId,
                link:
                  updated.publicPath
                    ? String(updated.publicPath)
                    : adminPanelHref(`articles/${articleId}`),
                isPushSent: false,
              });
            }
          }
        } catch (notifErr) {
          logger.error(
            { err: notifErr, articleId },
            "updateArticle: notifikasi publish ke penulis gagal",
          );
        }
      } else if (finalStatus === ArticleStatus.SCHEDULED) {
        try {
          const rawAid = existing.authorId;
          const schedRaw = updated.scheduledAt ?? validScheduledAt;
          const schedDate =
            schedRaw instanceof Date
              ? schedRaw
              : schedRaw
                ? new Date(schedRaw as string)
                : null;
          const when =
            schedDate && !Number.isNaN(schedDate.getTime())
              ? schedDate.toLocaleString("id-ID", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })
              : "";

          if (rawAid) {
            const authorOid =
              rawAid instanceof ObjectId
                ? rawAid
                : new ObjectId(String(rawAid));
            const authorDoc = await db
              .collection("users")
              .findOne({ _id: authorOid });
            const remail = String(authorDoc?.email ?? "").trim();
            const rname = String(authorDoc?.name ?? "").trim();
            if (authorDoc && remail && rname) {
              const rav = authorDoc.avatar;
              await createOneNotification(db, {
                receiver: {
                  _id: authorOid.toHexString(),
                  name: rname,
                  email: remail,
                  ...(typeof rav === "string" && rav.trim()
                    ? { avatarUrl: rav.trim() }
                    : {}),
                },
                actor: notifyActor,
                type: NotificationType.ARTICLE_APPROVAL,
                title: "Artikel dijadwalkan terbit",
                message: when
                  ? `Artikel "${titleStr}" dijadwalkan terbit pada ${when}.`
                  : `Artikel "${titleStr}" telah dijadwalkan untuk terbit.`,
                targetId: articleId,
                link: adminPanelHref(`articles/${articleId}`),
                isPushSent: false,
              });
            }
          }
        } catch (notifErr) {
          logger.error(
            { err: notifErr, articleId },
            "updateArticle: notifikasi terjadwal ke penulis gagal",
          );
        }
      }
    }

    // Log aktivitas redaksi dengan structure format revisionHistory
    // POINT 5: Buat EditorActivity dengan action UPDATE, statusFrom/statusTo dari revision

    const aid = updated.authorId
      ? updated.authorId instanceof ObjectId
        ? updated.authorId
        : new ObjectId(String(updated.authorId))
      : null;
    const eid = updated.editorId
      ? updated.editorId instanceof ObjectId
        ? updated.editorId
        : new ObjectId(String(updated.editorId))
      : null;
    const cbid = updated.createdById
      ? updated.createdById instanceof ObjectId
        ? updated.createdById
        : new ObjectId(String(updated.createdById))
      : null;
    const contribIdList = Array.isArray(updated.contributorIds)
      ? (updated.contributorIds as unknown[]).map((x) =>
          x instanceof ObjectId ? x : new ObjectId(String(x)),
        )
      : [];

    const authorPromise = aid
      ? db.collection("users").findOne({ _id: aid })
      : Promise.resolve(null);
    const editorPromise = eid
      ? db.collection("users").findOne({ _id: eid })
      : Promise.resolve(null);
    const createdByPromise = cbid
      ? db.collection("users").findOne({ _id: cbid })
      : Promise.resolve(null);
    const contribPromise =
      contribIdList.length > 0
        ? db
            .collection("users")
            .find({ _id: { $in: contribIdList } })
            .toArray()
        : Promise.resolve([] as Record<string, unknown>[]);

    const [authorRow, editorRow, createdByRow, contribRows] =
      await Promise.all([
        authorPromise,
        editorPromise,
        createdByPromise,
        contribPromise,
      ]);

    const responseAuthor =
      mongoUserToProfile(authorRow as Record<string, unknown> | null) ??
      (updated.author as UserProfile | undefined) ??
      ({
        _id: aid?.toString() ?? "",
        name: "",
        email: "",
        role: "SUBSCRIBER",
      } as UserProfile);
    const responseEditor = mongoUserToProfile(
      editorRow as Record<string, unknown> | null,
    );
    const responseCreatedBy = mongoUserToProfile(
      createdByRow as Record<string, unknown> | null,
    );
    const responseContributors: UserProfile[] = (
      contribRows as Record<string, unknown>[]
    )
      .map((r) => mongoUserToProfile(r))
      .filter((p): p is UserProfile => p != null);

    const articleResponse = await mapDocToArticle({
      ...updated,
      author: responseAuthor,
      editor: responseEditor,
      createdBy: responseCreatedBy,
      contributors: responseContributors,
    });

    const wasPublished = existing.status === ArticleStatus.PUBLISHED;
    const isPublished = finalStatus === ArticleStatus.PUBLISHED;
    if (
      wasPublished ||
      isPublished ||
      finalStatus === ArticleStatus.SCHEDULED
    ) {
      safeRevalidateArticlePublicPage(
        updated.publicPath ? String(updated.publicPath) : null,
        pathFields.previousPublicPath,
      );
    }

    logger.info(
      {
        articleId,
        slug: updated.slug,
        status: updated.status,
      },
      "updateArticle selesai",
    );

    return articleResponse;
  } catch (err) {
    logger.error({ err, articleId }, "updateArticle gagal");
    throw err;
  }
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteArticle(
  db: Db,
  articleId: string,
  actor: ArticleMutationActor,
): Promise<void> {
  logger.info({ articleId }, "deleteArticle dimulai");

  try {
    if (!/^[a-f\d]{24}$/i.test(articleId)) {
      throw Object.assign(new Error("Invalid article ID"), { status: 400 });
    }

    const actorName = actor.name?.trim();
    const actorEmail = actor.email?.trim();
    if (!actorName || !actorEmail) {
      throw Object.assign(
        new Error("name dan email wajib untuk audit artikel"),
        { status: 400 },
      );
    }

    const oid = new ObjectId(articleId);

    const existing = await db.collection("articles").findOne({ _id: oid });
    if (!existing) {
      throw Object.assign(new Error("Article not found"), { status: 404 });
    }
    if (existing.deletedAt) {
      throw Object.assign(new Error("Article already deleted"), {
        status: 410,
      });
    }

    const userId = actor._id?.toString?.() ?? actor._id;
    const role = (actor.role || "").toString().toLowerCase();
    let canDelete = false;

    if (hasPermission(role, "delete_any_article")) {
      canDelete = true;
    } else if (hasPermission(role, "delete_own_article")) {
      const authorId = existing.authorId?.toString?.() ?? existing.authorId;
      if (authorId && userId && authorId === userId) {
        canDelete = true;
      }
    }

    if (!canDelete) {
      throw Object.assign(new Error("Forbidden: missing delete permission"), {
        status: 403,
      });
    }

    const deletedAt = new Date();
    const query = { _id: oid };

    await Promise.all([
      db.collection("articles").updateOne(query, {
        $set: {
          status: ArticleStatus.DELETED,
          deletedAt,
          updatedAt: deletedAt,
        },
      }),
      db
        .collection("article_views")
        .updateMany({ articleId: oid }, { $set: { deletedAt } }),
    ]);

    logger.info(
      { articleId, title: existing.title },
      "deleteArticle: Article soft deleted",
    );

    await createAuditLog(db, {
      actor: {
        _id: typeof actor._id === "string" ? actor._id : actor._id.toString(),
        name: actorName,
        email: actorEmail,
      },
      action: AuditLogAction.DELETE,
      entity: "articles",
      entityId: articleId,
      details: `Menghapus artikel : "${String(existing.title ?? "").slice(0, 120)}"`,
    }).catch((auditErr: unknown) => {
      logger.error(
        { err: auditErr, articleId },
        "createAuditLog gagal setelah deleteArticle",
      );
    });

    if (existing.status === ArticleStatus.PUBLISHED) {
      const existingPath = existing.publicPath
        ? String(existing.publicPath)
        : existing.slug
          ? buildLegacyArticlePath(String(existing.slug))
          : null;
      safeRevalidateArticlePublicPage(existingPath);
    }

    logger.info({ articleId }, "deleteArticle selesai");
  } catch (err) {
    logger.error({ err, articleId }, "deleteArticle gagal");
    throw err;
  }
}
