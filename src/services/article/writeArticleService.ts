import { Db, Document, ObjectId, type AnyBulkWriteOperation } from "mongodb";
import {
  Article,
  AutosavePayload,
  ApprovalPayload,
  ArticleStatus,
  ArticleRevision,
  STATUS_ROLE_MAP,
  STATUS_NOTIFICATION,
} from "@/types/article";

import logger from "@/lib/logger";
import {
  buildArticleAuditMeta,
  buildArticleSlimSnapshot,
  createAuditLog,
} from "@/services/auditLogService";
import {
  toMongoObjectId,
  mapTagsToObjects,
  generateArticleSlug,
  mapDocToArticle,
  buildRevisionEntry,
} from "@/lib/helper-article";
import {
  assertUniqueArticleSlug,
  assertUniqueArticleTitle,
  isPlaceholderArticleTitle,
  normalizeArticleTitle,
  resolveArticleSlug,
  titleNormalizedForStorage,
} from "@/lib/article-validation";
import { resolveArticleDenormFields } from "@/lib/article-denorm";
import {
  createBulkNotifications,
  createOneNotification,
} from "@/services/notificationService";
import type { CreateNotificationInput } from "@/types/notification";
import { NotificationType } from "@/types/notification";
import { sendPushToUser, notifyCategoryOnArticlePublished } from "@/services/pushNotifService";
import { adminPanelHref } from "@/lib/admin-panel-path";
import { ROLES } from "@/lib/auth-client";
import { AuditLogAction, AuditLogEntity } from "@/types/auditLog";
import { resolveAttributionMongoUpdates, safeRevalidateArticlePublicPage } from "@/services/article/coreWriteArticleService";
import {
  recomputeArticlePublicPath,
  recomputeArticlePublicPathFromUpdates,
} from "@/services/article/articlePublicPathService";

/** Actor sistem untuk audit saat artikel terjadwal terbit otomatis (bukan user login). */
export const SCHEDULER_AUDIT_ACTOR = {
  _id: "000000000000000000000001",
  name: "Penjadwal sistem",
  email: "scheduler@internal.local",
} as const;

function notificationTypeForApprovalStatus(
  status: ArticleStatus,
): NotificationType {
  switch (status) {
    case ArticleStatus.PUBLISHED:
      return NotificationType.ARTICLE_PUBLISHED;
    case ArticleStatus.SCHEDULED:
      return NotificationType.ARTICLE_APPROVAL;
    case ArticleStatus.REJECTED:
      return NotificationType.ARTICLE_REJECTED;
    case ArticleStatus.PENDING_REVIEW:
      return NotificationType.ARTICLE_SUBMITTED;
    case ArticleStatus.TAKEN_DOWN:
      return NotificationType.ARTICLE_TAKEN_DOWN;
    case ArticleStatus.DELETED:
      return NotificationType.ARTICLE_DELETED;
    default:
      return NotificationType.ARTICLE_APPROVAL;
  }
}

// ─── Autosave ─────────────────────────────────────────────────────────────────

export async function autosaveArticle(
  db: Db,
  payload: AutosavePayload,
  author: { _id: ObjectId | string; name?: string },
): Promise<{ articleId: string; created: boolean }> {
  const {
    articleId,
    title,
    content = "",
    excerpt = "",
    categoryId,
    tags = [],
    featuredImage,
    status = "DRAFT",
  } = payload;

  const mongoCategoryId = toMongoObjectId(categoryId);
  const tagsArray = mapTagsToObjects(tags);
  const resolvedTitle = title?.trim() ? title.trim() : "Untitled";

  if (articleId && /^[a-f\d]{24}$/i.test(articleId)) {
    const oid = new ObjectId(articleId);
    const existing = await db.collection("articles").findOne({
      _id: oid,
      authorId:
        typeof author._id === "string" ? new ObjectId(author._id) : author._id,
    });

    if (!existing) {
      throw Object.assign(new Error("Article not found"), { status: 404 });
    }

    const existingTitle = String(existing.title ?? "");
    const titleChanged =
      normalizeArticleTitle(resolvedTitle) !==
      normalizeArticleTitle(existingTitle);

    const setFields: Record<string, unknown> = {
      title: resolvedTitle,
      content,
      excerpt,
      ...(mongoCategoryId && { categoryId: mongoCategoryId }),
      tags: tagsArray,
      featuredImage: featuredImage || null,
      updatedAt: new Date(),
    };

    if (titleChanged) {
      await assertUniqueArticleTitle(db, resolvedTitle, articleId);

      const newSlug = isPlaceholderArticleTitle(resolvedTitle)
        ? resolveArticleSlug(resolvedTitle, oid)
        : generateArticleSlug(resolvedTitle);
      await assertUniqueArticleSlug(db, newSlug, articleId);

      setFields.titleNormalized = titleNormalizedForStorage(resolvedTitle);
      setFields.slug = newSlug;
      setFields.metaTitle = resolvedTitle;
    }

    if (mongoCategoryId) {
      Object.assign(
        setFields,
        await resolveArticleDenormFields(db, existing.authorId, mongoCategoryId),
      );
    }

    await db.collection("articles").updateOne(
      {
        _id: oid,
        authorId:
          typeof author._id === "string"
            ? new ObjectId(author._id)
            : author._id,
      },
      { $set: setFields },
    );
    return { articleId, created: false };
  }

  await assertUniqueArticleTitle(db, resolvedTitle);

  const draftSlugId = new ObjectId();
  const slug = isPlaceholderArticleTitle(resolvedTitle)
    ? resolveArticleSlug(resolvedTitle, draftSlugId)
    : generateArticleSlug(resolvedTitle);
  await assertUniqueArticleSlug(db, slug);

  const authorObjectId =
    typeof author._id === "string" ? new ObjectId(author._id) : author._id;

  const denormFields = await resolveArticleDenormFields(
    db,
    authorObjectId,
    mongoCategoryId,
  );

  const doc = {
    title: resolvedTitle,
    titleNormalized: titleNormalizedForStorage(resolvedTitle),
    slug,
    content,
    excerpt,
    categoryId: mongoCategoryId,
    tags: tagsArray,
    featuredImage: featuredImage || null,
    authorId: authorObjectId,
    createdById: authorObjectId,
    editorId: null,
    status,
    isFeatured: false,
    isHeadline: false,
    isBreaking: false,
    viewCount: 0,
    metaTitle: resolvedTitle,
    metaDescription: excerpt,
    scheduledAt: null,
    publishedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...denormFields,
  };

  const result = await db.collection("articles").insertOne(doc);
  return { articleId: result.insertedId.toString(), created: true };
}

// ─── Publish Scheduled Articles ─────────────────────────────────────────────

/** Pastikan artikel benar-benar baru saja diterbitkan dari jadwal (bukan race / data lama). */
function scheduledPublishTimesMatch(
  publishedAtStored: unknown,
  scheduledSource: unknown,
): boolean {
  const tPublished =
    publishedAtStored instanceof Date
      ? publishedAtStored.getTime()
      : new Date(String(publishedAtStored ?? "")).getTime();
  const tScheduled =
    scheduledSource instanceof Date
      ? scheduledSource.getTime()
      : new Date(String(scheduledSource ?? "")).getTime();
  return (
    !Number.isNaN(tPublished) &&
    !Number.isNaN(tScheduled) &&
    tPublished === tScheduled
  );
}

function coerceStoredDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (value == null || value === "") return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Publish semua artikel yang statusnya SCHEDULED dan scheduledAt <= now.
 * Mengembalikan jumlah artikel yang dipublish dan total yang ditemukan.
 * Alur: satu bulkWrite MongoDB, satu query users untuk penulis unik,
 * bulk insert notifikasi in-app (fallback per-doc jika gagal), audit & push paralel.
 *
 * publishedAt: pertahankan nilai lama jika artikel pernah publish; jika belum,
 * pakai scheduledAt (termasuk jadwal waktu lampau yang menunggu cron berikutnya).
 */
export async function publishScheduledArticles(
  db: Db,
): Promise<{ published: number; total: number }> {
  const now = new Date();
  const scheduled = await db
    .collection("articles")
    .find({
      status: "SCHEDULED",
      scheduledAt: { $lte: now },
    })
    .toArray();

  logger.info(`Jumlah artikel terjadwal yang memenuhi syarat: ${scheduled.length}`);

  if (!scheduled.length) {
    return { published: 0, total: 0 };
  }

  const ops: AnyBulkWriteOperation<Document>[] = scheduled.map((article) => {
    const priorPublishedAt = coerceStoredDate(article.publishedAt);
    const publishAt = priorPublishedAt ?? article.scheduledAt;
    const contentUpdatedAt = priorPublishedAt ? now : article.scheduledAt;
    return {
      updateOne: {
        filter: { _id: article._id, status: "SCHEDULED" },
        update: {
          $set: {
            status: ArticleStatus.PUBLISHED,
            publishedAt: publishAt,
            contentUpdatedAt,
            updatedAt: now,
          },
        },
      },
    };
  });

  await db.collection("articles").bulkWrite(ops, { ordered: false });

  const scheduledById = new Map<string, Document>(
    scheduled.map((s) => [String(s._id), s as Document]),
  );
  const idList = scheduled.map((s) => s._id);

  const freshDocs = await db
    .collection("articles")
    .find({ _id: { $in: idList } })
    .toArray();

  const succeeded: Document[] = [];
  for (const doc of freshDocs) {
    const key = String(doc._id);
    const orig = scheduledById.get(key);
    if (!orig) continue;
    if (doc.status !== ArticleStatus.PUBLISHED) continue;

    const priorPublishedAt = coerceStoredDate(orig.publishedAt);
    const expectedPublishedAt = priorPublishedAt ?? orig.scheduledAt;
    // First publish: publishedAt === scheduledAt.
    // Republish: publishedAt dipertahankan = publishedAt asli.
    if (!scheduledPublishTimesMatch(doc.publishedAt, expectedPublishedAt)) {
      continue;
    }
    succeeded.push(doc);
  }

  const succeededIdSet = new Set(succeeded.map((d) => String(d._id)));
  for (const s of scheduled) {
    if (!succeededIdSet.has(String(s._id))) {
      logger.warn(
        { articleId: s._id.toString() },
        "Failed to update article status",
      );
    }
  }

  for (const article of succeeded) {
    try {
      const pathFields = await recomputeArticlePublicPath(db, article, {
        status: ArticleStatus.PUBLISHED,
        publishedAt:
          article.publishedAt instanceof Date
            ? article.publishedAt
            : article.publishedAt
              ? new Date(String(article.publishedAt))
              : null,
      });
      await db.collection("articles").updateOne(
        { _id: article._id },
        {
          $set: {
            publicPath: pathFields.publicPath,
            urlFormat: pathFields.urlFormat,
          },
        },
      );
      article.publicPath = pathFields.publicPath;
      article.urlFormat = pathFields.urlFormat;

      if (pathFields.publicPath) {
        safeRevalidateArticlePublicPage(
          pathFields.publicPath,
          pathFields.previousPublicPath,
        );
      }
    } catch (pathErr) {
      logger.error(
        { err: pathErr, articleId: article._id?.toString?.() },
        "publishScheduledArticles: recompute publicPath gagal",
      );
    }
  }

  await Promise.all(
    succeeded.map(async (article) => {
      try {
        await createAuditLog(db, {
          actor: {
            _id: SCHEDULER_AUDIT_ACTOR._id,
            name: SCHEDULER_AUDIT_ACTOR.name,
            email: SCHEDULER_AUDIT_ACTOR.email,
          },
          action: AuditLogAction.PUBLISH,
          entity: AuditLogEntity.ARTICLES,
          entityId: article._id,
          details: `Terbit otomatis dari jadwal: "${String(article.title ?? "").slice(0, 120)}"`,
          oldValue: buildArticleSlimSnapshot({
            status: ArticleStatus.SCHEDULED,
            title: String(article.title ?? ""),
            slug: String(article.slug ?? ""),
            scheduledAt: article.scheduledAt ?? null,
          }),
          newValue: buildArticleSlimSnapshot({
            status: ArticleStatus.PUBLISHED,
            title: String(article.title ?? ""),
            slug: String(article.slug ?? ""),
            scheduledAt: article.scheduledAt ?? null,
          }),
          meta: buildArticleAuditMeta({
            statusFrom: ArticleStatus.SCHEDULED,
            statusTo: ArticleStatus.PUBLISHED,
            articleTitle: String(article.title ?? ""),
          }),
        });
      } catch (auditErr) {
        logger.error(
          { err: auditErr, articleId: article._id.toString() },
          "createAuditLog gagal setelah publishScheduledArticles",
        );
      }
    }),
  );

  const authorOidList: ObjectId[] = [];
  const seenAuthors = new Set<string>();
  for (const doc of succeeded) {
    if (!doc.authorId) continue;
    let oid: ObjectId;
    if (doc.authorId instanceof ObjectId) {
      oid = doc.authorId;
    } else {
      const rawId = String(doc.authorId).trim();
      if (!/^[a-f\d]{24}$/i.test(rawId)) {
        logger.warn(
          { articleId: doc._id.toString(), authorId: doc.authorId },
          "Invalid authorId format skipped during scheduled publishing",
        );
        continue;
      }
      oid = new ObjectId(rawId);
    }
    const hex = oid.toHexString();
    if (seenAuthors.has(hex)) continue;
    seenAuthors.add(hex);
    authorOidList.push(oid);
  }

  const authorsByHex = new Map<
    string,
    { email: string; name: string; avatar?: string }
  >();

  if (authorOidList.length > 0) {
    const userDocs = await db
      .collection("users")
      .find({ _id: { $in: authorOidList } })
      .toArray();
    for (const u of userDocs) {
      const rawId = u._id;
      if (!(rawId instanceof ObjectId)) continue;
      const remail = String(u.email ?? "").trim();
      const rname = String(u.name ?? "").trim();
      if (!remail || !rname) continue;
      const rav = u.avatar;
      authorsByHex.set(rawId.toHexString(), {
        email: remail,
        name: rname,
        ...(typeof rav === "string" && rav.trim()
          ? { avatar: rav.trim() }
          : {}),
      });
    }
  }

  const notificationInputs: CreateNotificationInput[] = [];
  for (const article of succeeded) {
    if (!article.authorId) continue;
    let authorOid: ObjectId;
    if (article.authorId instanceof ObjectId) {
      authorOid = article.authorId;
    } else {
      const rawId = String(article.authorId).trim();
      if (!/^[a-f\d]{24}$/i.test(rawId)) {
        continue;
      }
      authorOid = new ObjectId(rawId);
    }
    const hex = authorOid.toHexString();
    const author = authorsByHex.get(hex);
    if (!author) continue;

    notificationInputs.push({
      receiver: {
        _id: authorOid.toHexString(),
        name: author.name,
        email: author.email,
        ...(author.avatar ? { avatarUrl: author.avatar } : {}),
      },
      actor: {
        _id: SCHEDULER_AUDIT_ACTOR._id,
        name: SCHEDULER_AUDIT_ACTOR.name,
        email: SCHEDULER_AUDIT_ACTOR.email,
      },
      type: NotificationType.SCHEDULE_PUBLISHED,
      title: "Artikel terjadwal telah dipublikasikan",
      message: `Artikel "${article.title}" telah terbit sesuai jadwal.`,
      targetId: article._id.toString(),
      link:
        article.publicPath
          ? String(article.publicPath)
          : adminPanelHref(`articles/${article._id.toString()}`),
      icon: "calendar",
      meta: { articleId: article._id.toString() },
      isPushSent: false,
    });
  }

  if (notificationInputs.length > 0) {
    try {
      await createBulkNotifications(db, notificationInputs);
    } catch (bulkErr) {
      logger.error(
        { err: bulkErr, count: notificationInputs.length },
        "publishScheduledArticles: bulk notifikasi gagal, fallback per item",
      );
      await Promise.allSettled(
        notificationInputs.map((input) => createOneNotification(db, input)),
      );
    }
  }

  await Promise.allSettled(
    succeeded.map((article) => {
      if (!article.authorId) {
        return Promise.resolve();
      }
      return sendPushToUser(db, article.authorId.toString(), {
        title: "Artikel terjadwal terbit!",
        body: `"${article.title}" telah dipublikasikan sesuai jadwal.`,
        link:
          article.publicPath
            ? String(article.publicPath)
            : adminPanelHref(`articles/${article._id.toString()}`),
      }).catch((pushErr) => {
        logger.error(
          { err: pushErr, articleId: article._id.toString() },
          "publishScheduledArticles: push gagal",
        );
      });
    }),
  );

  await Promise.allSettled(
    succeeded.map((article) =>
      notifyCategoryOnArticlePublished(db, {
        title: String(article.title ?? ""),
        publicPath: article.publicPath ? String(article.publicPath) : null,
        featuredImage: article.featuredImage,
        categoryId: article.categoryId,
      }).catch((catPushErr) => {
        logger.error(
          { err: catPushErr, articleId: article._id?.toString?.() },
          "publishScheduledArticles: push kategori gagal",
        );
      }),
    ),
  );

  return { published: succeeded.length, total: scheduled.length };
}

/**
 * Service untuk approval/perubahan status artikel (status & schedule saja)
 * - Validasi role manual per status
 * - Logger & audit log
 * - Kirim notifikasi ke role terkait
 */
function auditActionForApprovalStatus(status: ArticleStatus): AuditLogAction {
  switch (status) {
    case ArticleStatus.PUBLISHED:
      return AuditLogAction.PUBLISH;
    case ArticleStatus.SCHEDULED:
      return AuditLogAction.SCHEDULE;
    case ArticleStatus.REJECTED:
      return AuditLogAction.REJECT;
    default:
      return AuditLogAction.UPDATE;
  }
}

type ApprovalFlowUser = {
  _id: ObjectId | string;
  role?: string;
  name?: string;
  email: string;
};

/** Konversi aman untuk field yang bisa berupa ObjectId atau string dari MongoDB. */
function coerceToObjectId(value: unknown): ObjectId | null {
  if (value === undefined || value === null || value === "") return null;
  try {
    if (value instanceof ObjectId) return value;
    const s = String(value);
    return ObjectId.isValid(s) ? new ObjectId(s) : null;
  } catch {
    return null;
  }
}

function uniqueObjectIds(ids: ObjectId[]): ObjectId[] {
  const byHex = new Map<string, ObjectId>();
  for (const id of ids) byHex.set(id.toHexString(), id);
  return [...byHex.values()];
}

function approvalUserToObjectId(user: ApprovalFlowUser): ObjectId {
  return typeof user._id === "string" ? new ObjectId(user._id) : user._id;
}

/** Validasi tanggal jadwal sebelum update dokumen.
 * Backdate / waktu lampau diizinkan — cron memakai scheduledAt <= now.
 */
function assertApprovalScheduledDateValid(payload: ApprovalPayload): void {
  if (payload.status !== ArticleStatus.SCHEDULED || !payload.scheduledAt)
    return;
  const scheduled = new Date(payload.scheduledAt);
  if (Number.isNaN(scheduled.getTime())) {
    throw Object.assign(new Error("Tanggal jadwal tidak valid."), {
      status: 400,
    });
  }
}

/**
 * Field $set untuk perubahan status persetujuan (termasuk editorId & submittedAt).
 */
function buildApprovalStatusUpdates(
  articleDoc: Document,
  payload: ApprovalPayload,
  actorOid: ObjectId,
  normalizedRole: string,
): Record<string, unknown> {
  const prevStatus = articleDoc.status as ArticleStatus;
  const updates: Record<string, unknown> = {
    status: payload.status,
    updatedAt: new Date(),
  };

  const priorPublishedAt = coerceStoredDate(articleDoc.publishedAt);

  if (payload.status === ArticleStatus.SCHEDULED && payload.scheduledAt) {
    updates.scheduledAt = new Date(payload.scheduledAt);
    // Jangan hapus publishedAt asli; biarkan null hanya jika belum pernah publish
    updates.publishedAt = priorPublishedAt;
    updates.publishedBy = actorOid;
  } else if (payload.status === ArticleStatus.PUBLISHED) {
    const publishNow = new Date();
    updates.publishedAt = priorPublishedAt ?? publishNow;
    updates.contentUpdatedAt = publishNow;
    updates.scheduledAt = null;
    updates.publishedBy = actorOid;
  } else {
    updates.scheduledAt = null;
    if (payload.status !== ArticleStatus.SCHEDULED) {
      updates.publishedAt = articleDoc.publishedAt ?? null;
    }
  }

  const editorAssignsFromPendingReview =
    prevStatus === ArticleStatus.PENDING_REVIEW &&
    [
      ArticleStatus.PUBLISHED,
      ArticleStatus.SCHEDULED,
      ArticleStatus.REJECTED,
    ].includes(payload.status as ArticleStatus) &&
    normalizedRole === ROLES.EDITOR;

  if (editorAssignsFromPendingReview) {
    updates.editorId = actorOid;
  }

  if (payload.status === ArticleStatus.PENDING_REVIEW) {
    const hasPreviousPendingReview = (
      (articleDoc.revisionHistory as ArticleRevision[] | undefined) ?? []
    ).some((entry) => entry.to === ArticleStatus.PENDING_REVIEW);
    if (!hasPreviousPendingReview) {
      updates.submittedAt = new Date();
    }
  }

  return updates;
}

/**
 * Pengguna yang berhak dapat notifikasi (penulis oleh role pada artikel, editor oleh role di koleksi users).
 * Satu query `users` untuk semua kandidat.
 */
async function loadApprovalNotificationReceiverDocs(
  db: Db,
  updated: Article,
  notifyRoles: string[],
): Promise<Document[]> {
  if (!notifyRoles.length) return [];

  const authorRole = (updated.author?.role ?? "").toString().toLowerCase();
  const notifyAuthor =
    Boolean(updated.authorId) && notifyRoles.includes(authorRole);

  const authorOid = coerceToObjectId(updated.authorId);
  const editorOid = coerceToObjectId(updated.editorId);

  const candidates = uniqueObjectIds(
    [notifyAuthor && authorOid ? authorOid : null, editorOid].filter(
      (oid): oid is ObjectId => Boolean(oid),
    ),
  );

  if (!candidates.length) return [];

  const users = await db
    .collection("users")
    .find({ _id: { $in: candidates } })
    .toArray();

  const byHex = new Map(
    users.map((u) => [(u._id as ObjectId).toHexString(), u]),
  );
  const receiverDocs: Document[] = [];
  const seenHex = new Set<string>();

  for (const oid of candidates) {
    const hex = oid.toHexString();
    if (seenHex.has(hex)) continue;

    const u = byHex.get(hex);
    if (!u) continue;

    let eligible = false;
    if (notifyAuthor && authorOid && hex === authorOid.toHexString()) {
      eligible = true;
    }

    const edHex = editorOid?.toHexString();
    if (
      edHex &&
      hex === edHex &&
      typeof u.role === "string" &&
      notifyRoles.includes(u.role.toLowerCase())
    ) {
      eligible = true;
    }

    if (eligible) {
      seenHex.add(hex);
      receiverDocs.push(u);
    }
  }

  return receiverDocs;
}

function approvalActorPayload(
  actorOid: ObjectId,
  name: string,
  email: string,
): CreateNotificationInput["actor"] {
  return { _id: actorOid.toHexString(), name, email };
}

async function sendArticleApprovalNotifications(
  db: Db,
  articleId: string,
  payload: ApprovalPayload,
  updated: Article,
  actorOid: ObjectId,
  actorName: string,
  actorEmail: string,
): Promise<void> {
  const notifConf = STATUS_NOTIFICATION[payload.status];
  if (!notifConf.roles.length) return;

  const receivers = await loadApprovalNotificationReceiverDocs(
    db,
    updated,
    notifConf.roles,
  );

  const inputs: CreateNotificationInput[] = [];
  const actorPayload = approvalActorPayload(actorOid, actorName, actorEmail);
  const notifLink =
    payload.status === ArticleStatus.PUBLISHED
      ? updated.publicPath
        ? String(updated.publicPath)
        : adminPanelHref(`articles/${articleId}`)
      : adminPanelHref(`articles/${articleId}`);
  const notifType = notificationTypeForApprovalStatus(
    payload.status as ArticleStatus,
  );

  for (const ru of receivers) {
    const remail = String(ru.email ?? "").trim();
    const rname = String(ru.name ?? "").trim();
    if (!remail || !rname) continue;
    const rid = ru._id as ObjectId;
    const receiverId = rid.toHexString();
    const rav = ru.avatar;
    inputs.push({
      receiver: {
        _id: receiverId,
        name: rname,
        email: remail,
        ...(typeof rav === "string" && rav.trim()
          ? { avatarUrl: rav.trim() }
          : {}),
      },
      actor: actorPayload,
      type: notifType,
      title: `Status artikel: ${payload.status}`,
      message: notifConf.getMessage(updated, payload.reason),
      targetId: articleId,
      link: notifLink,
      meta: {
        articleId,
        status: payload.status,
        reason: payload.reason,
      },
      isPushSent: false,
    });
  }

  if (!inputs.length) return;

  try {
    await createBulkNotifications(db, inputs);
  } catch (bulkErr) {
    logger.error(
      { err: bulkErr, articleId, count: inputs.length },
      "approveArticleStatus: bulk notifikasi gagal, fallback per item",
    );
    await Promise.allSettled(
      inputs.map((input) => createOneNotification(db, input)),
    );
  }
}

export async function approveArticleStatus(
  db: Db,
  articleId: string,
  payload: ApprovalPayload,
  user: ApprovalFlowUser,
): Promise<Article> {
  try {
    if (!/^[a-f\d]{24}$/i.test(articleId)) {
      throw Object.assign(new Error("ID artikel tidak valid."), {
        status: 400,
      });
    }
    const role = (user.role || "").toString().toLowerCase();
    const allowedRoles = STATUS_ROLE_MAP[payload.status];
    if (!allowedRoles.includes(role) && role !== "admin") {
      throw Object.assign(
        new Error(
          "Anda tidak memiliki izin untuk mengubah status artikel ini.",
        ),
        { status: 403 },
      );
    }
    const query = {
      _id: new ObjectId(articleId),
      deletedAt: { $in: [null, ""] },
    };
    const article = await db.collection("articles").findOne(query);
    if (!article)
      throw Object.assign(new Error("Artikel tidak ditemukan."), {
        status: 404,
      });

    const actorName = user.name?.trim();
    const actorEmail = user.email?.trim();
    if (!actorName || !actorEmail) {
      throw Object.assign(
        new Error("name dan email wajib untuk audit persetujuan artikel"),
        { status: 400 },
      );
    }

    assertApprovalScheduledDateValid(payload);

    const actorOid = approvalUserToObjectId(user);
    const baseApprovalUpdates = buildApprovalStatusUpdates(
      article,
      payload,
      actorOid,
      role,
    );
    const attributionUpdates = await resolveAttributionMongoUpdates(db, role, {
      authorId: payload.authorId,
      editorId: payload.editorId,
      contributorIds: payload.contributorIds,
    });
    const updates: Record<string, unknown> = {
      ...baseApprovalUpdates,
      ...attributionUpdates,
    };

    const pathFields = await recomputeArticlePublicPathFromUpdates(
      db,
      article,
      updates,
    );
    updates.publicPath = pathFields.publicPath;
    updates.urlFormat = pathFields.urlFormat;

    const revisionEntry = buildRevisionEntry(
      actorOid,
      article.status as ArticleStatus,
      payload.status as ArticleStatus,
      payload.reason,
    );

    await db.collection("articles").updateOne(query, {
      $set: updates,
      $push: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        revisionHistory: { $each: [revisionEntry] } as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    });
    const updatedRaw = await db.collection("articles").findOne(query);
    if (!updatedRaw) throw new Error("Artikel tidak ditemukan setelah update.");
    const updated = await mapDocToArticle(updatedRaw);

    const oldArticleSnapshot = buildArticleSlimSnapshot({
      status: String(article.status ?? ""),
      title: String(article.title ?? ""),
      slug: String(article.slug ?? ""),
      scheduledAt: article.scheduledAt ?? null,
    });
    const newArticleSnapshot = buildArticleSlimSnapshot({
      status: String(updated.status ?? ""),
      title: String(updated.title ?? ""),
      slug: String(updated.slug ?? ""),
      scheduledAt: updated.scheduledAt ?? null,
    });

    try {
      await createAuditLog(db, {
        actor: {
          _id: actorOid.toHexString(),
          name: actorName,
          email: actorEmail,
        },
        action: auditActionForApprovalStatus(payload.status as ArticleStatus),
        entity: AuditLogEntity.ARTICLES,
        entityId: articleId,
        details: payload.reason
          ? `Perubahan status ${article.status} → ${payload.status}. Alasan: ${payload.reason}`
          : `Perubahan status ${article.status} → ${payload.status}`,
        oldValue: oldArticleSnapshot,
        newValue: newArticleSnapshot,
        meta: buildArticleAuditMeta({
          statusFrom: String(article.status ?? ""),
          statusTo: String(payload.status ?? ""),
          articleTitle: String(updated.title ?? ""),
          reason: payload.reason,
        }),
      });
    } catch (auditErr) {
      logger.error(
        { err: auditErr, articleId },
        "createAuditLog gagal setelah approveArticleStatus",
      );
    }

    await sendArticleApprovalNotifications(
      db,
      articleId,
      payload,
      updated,
      actorOid,
      actorName,
      actorEmail,
    );

    const wasPublished = article.status === ArticleStatus.PUBLISHED;
    const isPublished = payload.status === ArticleStatus.PUBLISHED;
    if (wasPublished || isPublished) {
      safeRevalidateArticlePublicPage(
        updated.publicPath ? String(updated.publicPath) : null,
        pathFields.previousPublicPath,
      );
    }

    return updated;
  } catch (err) {
    logger.error({ err, articleId }, "approveArticleStatus gagal");
    throw err;
  }
}
