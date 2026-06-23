import { Article, ArticleStatus } from "@/types/article";
import type { ArticleMedia } from "@/types/article";
import { UserProfile } from "@/types/user";
import { Db, ObjectId } from "mongodb";
import { Media } from "@/types/media";
import slugify from "slugify";
import {
  extractMediaKeyFromInput,
  resolvePublicMediaUrl,
  rewriteArticleContentMediaUrls,
} from "@/lib/media/public-media-url";

// ─── Helpers ─────────────────────────────────────────────────────────────────

export const ALLOWED_IMAGE_MIMETYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
];
export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

/** Validasi file gambar sebelum upload: cek mimetype dan ukuran */
export function validateImageFile(file: File): void {
  if (
    !file.type.startsWith("image/") ||
    !ALLOWED_IMAGE_MIMETYPES.includes(file.type)
  ) {
    throw Object.assign(
      new Error(
        `Unsupported image type: ${file.type}. Allowed: jpeg, png, webp, gif, avif`,
      ),
      { status: 400 },
    );
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    throw Object.assign(new Error("Image file size must not exceed 10 MB"), {
      status: 400,
    });
  }
}

/** Ambil data media dari DB dan map ke tipe Media */
export async function fetchMediaById(
  db: Db,
  id: ObjectId,
): Promise<Media | null> {
  const doc = await db.collection("media").findOne({ _id: id });
  if (!doc) return null;
  return {
    _id: doc._id.toString(),
    url: doc.url,
    filename: doc.filename,
    mimetype: doc.mimetype,
    size: doc.size,
    caption: doc.caption,
    credit: doc.credit || doc.takenBy,
    watermark: doc.watermark ?? false,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

// ─── Featured-image & gallery-item normalization helpers ──────────────────────

/** Resolve storage key dari embed artikel atau dokumen media ter-populate. */
function resolveMediaKeyFromSources(
  obj?: Record<string, unknown> | null,
  mediaDoc?: Record<string, unknown> | null,
): string {
  if (obj) {
    if (typeof obj.filename === "string" && obj.filename.trim()) {
      return obj.filename.trim();
    }
    if (typeof obj.url === "string" && obj.url.trim()) {
      const fromUrl = extractMediaKeyFromInput(obj.url);
      if (fromUrl) return fromUrl;
    }
  }
  if (mediaDoc) {
    if (typeof mediaDoc.filename === "string" && mediaDoc.filename.trim()) {
      return mediaDoc.filename.trim();
    }
    if (typeof mediaDoc.url === "string" && mediaDoc.url.trim()) {
      const fromUrl = extractMediaKeyFromInput(mediaDoc.url);
      if (fromUrl) return fromUrl;
    }
  }
  return "";
}

/**
 * Normalises embedded media (featured, contentMedia, gallery) ke ArticleMedia API shape.
 */
export function normalizeArticleMediaItem(
  item: Record<string, unknown>,
  mediaDoc?: Record<string, unknown> | null,
): ArticleMedia {
  const mediaIdRaw = item.mediaId ?? item._id ?? mediaDoc?._id;
  const mediaId =
    mediaIdRaw != null
      ? typeof mediaIdRaw === "object" &&
        typeof (mediaIdRaw as { toString?: () => string }).toString === "function"
        ? (mediaIdRaw as { toString: () => string }).toString()
        : String(mediaIdRaw)
      : "";

  const key = resolveMediaKeyFromSources(item, mediaDoc ?? undefined);

  return {
    mediaId,
    url: key ? resolvePublicMediaUrl(key) : "",
    caption: (item.caption as string) ?? (mediaDoc?.caption as string) ?? "",
    credit:
      (item.credit as string) ??
      (mediaDoc?.credit as string) ??
      (mediaDoc?.takenBy as string) ??
      "",
  };
}

/**
 * Normalises a raw `featuredImage` field from MongoDB into API `ArticleMedia`
 * with CDN url. Handles embedded filename, legacy proxy url, and media lookup.
 */
export function normalizeFeaturedImage(
  fi: unknown,
  mediaPop?: Record<string, unknown> | null,
): ArticleMedia | null {
  if (!fi && !mediaPop) return null;

  if (fi && typeof fi === "object") {
    const obj = fi as Record<string, unknown>;

    if ("mediaId" in obj || "_id" in obj) {
      return normalizeArticleMediaItem(obj, mediaPop ?? undefined);
    }
  }

  if (mediaPop) {
    return normalizeArticleMediaItem({}, mediaPop);
  }

  return null;
}

/**
 * Normalises a single raw gallery-item document.
 */
export function normalizeGalleryItemDoc(
  item: Record<string, unknown>,
  mediaDoc?: Record<string, unknown> | null,
) {
  const normalized = normalizeArticleMediaItem(item, mediaDoc);
  return {
    ...normalized,
    order: typeof item.order === "number" ? item.order : 0,
    ...(mediaDoc !== undefined ? { media: mediaDoc ?? null } : {}),
  };
}

/** Normalises contentMedia array item untuk response API. */
export function normalizeContentMediaItem(
  item: Record<string, unknown>,
  mediaDoc?: Record<string, unknown> | null,
): ArticleMedia {
  return normalizeArticleMediaItem(item, mediaDoc);
}

/**
 * Aggregation stages to populate `featuredImage` from the `media` collection.
 * Works at the TOP-LEVEL document (not inside a nested `articleArr`).
 * Produces `featuredImageMedia` on each doc; consume via `normalizeFeaturedImage`.
 */
export const FEATURED_IMAGE_LOOKUP_STAGES = [
  {
    $lookup: {
      from: "media",
      let: {
        fiId: {
          $cond: {
            if: { $eq: [{ $type: "$featuredImage" }, "objectId"] },
            then: "$featuredImage",
            else: {
              $cond: {
                if: { $eq: [{ $type: "$featuredImage" }, "object"] },
                then: {
                  $ifNull: ["$featuredImage.mediaId", "$featuredImage._id"],
                },
                else: null,
              },
            },
          },
        },
      },
      pipeline: [
        {
          $match: {
            $expr: {
              $and: [{ $ne: ["$$fiId", null] }, { $eq: ["$_id", "$$fiId"] }],
            },
          },
        },
        {
          $project: {
            _id: 1,
            url: 1,
            filename: 1,
            caption: 1,
            credit: 1,
            takenBy: 1,
          },
        },
      ],
      as: "featuredImageMediaArr",
    },
  },
  {
    $addFields: {
      featuredImageMedia: { $arrayElemAt: ["$featuredImageMediaArr", 0] },
    },
  },
  { $project: { featuredImageMediaArr: 0 } },
];

/**
 * Shared aggregation stages to populate category, author, and featuredImage
 * on each article doc. Produces `featuredImageMedia` for use in
 * `normalizeFeaturedImage`; the field is suppressed in the final $project.
 */
export const POPULATE_STAGES = [
  {
    $lookup: {
      from: "categories",
      localField: "categoryId",
      foreignField: "_id",
      as: "categoryObj",
    },
  },
  {
    $lookup: {
      from: "users",
      localField: "authorId",
      foreignField: "_id",
      as: "authorObj",
    },
  },
  // Backward-compat: populate featuredImage media for old ObjectId-ref articles
  ...FEATURED_IMAGE_LOOKUP_STAGES,
  {
    $addFields: {
      category: { $arrayElemAt: ["$categoryObj", 0] },
      author: { $arrayElemAt: ["$authorObj", 0] },
    },
  },
  {
    $project: {
      categoryObj: 0,
      authorObj: 0,
    },
  },
];

/** Map a raw MongoDB document to the typed Article shape */
export async function mapDocToArticle(doc: any): Promise<Article> {
  // Determine format
  const format = doc.format || (doc.galleryItems ? "GALLERY" : "STANDARD");

  // Common fields (BaseArticle)
  const base: any = {
    _id: doc._id?.toString(),
    title: doc.title,
    slug: doc.slug,
    excerpt: doc.excerpt,
    categoryId: doc.categoryId?.toString(),
    category: doc.category,
    tags: doc.tags || [],
    // Normalize featuredImage — handles new embedded, old embedded, and ObjectId-ref formats.
    // `featuredImageMedia` is populated when POPULATE_STAGES (or FEATURED_IMAGE_LOOKUP_STAGES)
    // was used in the pipeline; it's undefined otherwise (new articles still get correct url).
    featuredImage:
      normalizeFeaturedImage(doc.featuredImage, doc.featuredImageMedia) ??
      undefined,
    authorId: doc.authorId?.toString(),
    author: {
      _id: doc.author?._id?.toString?.() ?? doc.author?._id ?? "",
      name: doc.author?.name ?? "",
      email: doc.author?.email ?? "",
      avatar: doc.author?.avatar,
      role: doc.author?.role ?? "SUBSCRIBER",
    } satisfies UserProfile,
    editorId: doc.editorId ? doc.editorId.toString() : null,
    editor: doc.editor ?? null,
    contributors: Array.isArray(doc.contributors)
      ? doc.contributors.map((c: Record<string, unknown>) => ({
          _id:
            c._id instanceof ObjectId ? c._id.toString() : String(c._id ?? ""),
          name: String(c.name ?? ""),
          email: String(c.email ?? ""),
          avatar: c.avatar as UserProfile["avatar"],
          role: (c.role ?? "SUBSCRIBER") as UserProfile["role"],
        }))
      : (doc.contributors ?? undefined),
    contributorIds: Array.isArray(doc.contributorIds)
      ? doc.contributorIds.map((id: unknown) =>
          id instanceof ObjectId ? id.toString() : String(id),
        )
      : undefined,
    createdBy: doc.createdBy
      ? {
          _id:
            doc.createdBy._id instanceof ObjectId
              ? doc.createdBy._id.toString()
              : String(doc.createdBy._id ?? ""),
          name: String((doc.createdBy as Record<string, unknown>).name ?? ""),
          email: String((doc.createdBy as Record<string, unknown>).email ?? ""),
          avatar: (doc.createdBy as Record<string, unknown>)
            .avatar as UserProfile["avatar"],
          role: ((doc.createdBy as Record<string, unknown>).role ??
            "SUBSCRIBER") as UserProfile["role"],
        }
      : undefined,
    status: doc.status,
    isFeatured: !!doc.isFeatured,
    isHeadline: !!doc.isHeadline,
    isBreaking: !!doc.isBreaking,
    isPopular: !!doc.isPopular,
    isEditorChoices: !!doc.isEditorChoices,
    viewCount: doc.viewCount || 0,
    metaTitle: doc.metaTitle,
    metaDesc: doc.metaDesc,
    publishedAt: doc.publishedAt,
    publishedBy: doc.publishedBy?.toString?.() ?? doc.publishedBy,
    scheduledAt: doc.scheduledAt ?? null,
    createdAt: doc.createdAt,
    submittedAt: doc.submittedAt,
    updatedAt: doc.updatedAt,
    deletedAt: doc.deletedAt ?? null,
    revisionHistory: doc.revisionHistory || [],
    relatedArticles: doc.relatedArticles || [],
    publicPath: doc.publicPath ?? null,
    urlFormat: doc.urlFormat ?? "legacy",
  };

  if (format === "GALLERY") {
    return {
      ...base,
      format: "GALLERY",
      content: rewriteArticleContentMediaUrls(doc.content ?? ""),
      galleryItems: Array.isArray(doc.galleryItems)
        ? doc.galleryItems.map((item: Record<string, unknown>) =>
            normalizeGalleryItemDoc(item),
          )
        : [],
    };
  }

  return {
    ...base,
    format: "STANDARD",
    content: rewriteArticleContentMediaUrls(doc.content ?? ""),
    contentMedia: Array.isArray(doc.contentMedia)
      ? doc.contentMedia.map((item: Record<string, unknown>) =>
          normalizeContentMediaItem(item),
        )
      : [],
  };
}

/**
 * Distribute `total` articles across `n` topics as evenly as possible.
 * Remainder slots go to earlier topics (higher priority).
 *
 * Examples (total = 9):
 *   n=1 → [9]
 *   n=2 → [5, 4]
 *   n=3 → [3, 3, 3]
 *   n=4 → [3, 2, 2, 2]
 */
export function distributeSlots(n: number, total = 9): number[] {
  const base = Math.floor(total / n);
  const remainder = total % n;
  return Array.from({ length: n }, (_, i) => (i < remainder ? base + 1 : base));
}

/**
 * Resolve featuredImage storage key ke URL publik CDN.
 */
export function resolveFeaturedImageUrl(
  featuredImage?: string,
): string | undefined {
  if (!featuredImage?.trim()) return undefined;
  const resolved = resolvePublicMediaUrl(featuredImage);
  return resolved || undefined;
}

/** Generate slug from title (tanpa suffix random). */
export function generateArticleSlug(title: string): string {
  const base = slugify(title, { lower: true, strict: true });
  return base || "untitled";
}

/** Convert tags (string[] | {name,slug}[]) to normalized [{name, slug}] */
export function mapTagsToObjects(
  tags: string[] | Array<{ name: string; slug: string }>,
): Array<{ name: string; slug: string }> {
  if (!Array.isArray(tags)) return [];
  return tags.map((t) => {
    if (typeof t === "string") {
      return { name: t, slug: slugify(t, { lower: true, strict: true }) };
    }
    return {
      name: t.name,
      slug: t.slug || slugify(t.name, { lower: true, strict: true }),
    };
  });
}

/**
 * Convert categoryId from EJSON `{$oid: "..."}` or plain string to ObjectId.
 * Returns null if invalid.
 */
export function toMongoObjectId(value: unknown): ObjectId | null {
  if (!value) return null;
  if (typeof value === "string" && /^[a-f\d]{24}$/i.test(value)) {
    return new ObjectId(value);
  }
  if (
    typeof value === "object" &&
    value !== null &&
    "$oid" in value &&
    typeof (value as any).$oid === "string"
  ) {
    return new ObjectId((value as any).$oid);
  }
  return null;
}

// ─── Helper: Build Revision Entry ─────────────────────────────────────────────
/**
 * Membuat entry revisi untuk revisionHistory.
 * Selalu membuat entry baru dengan informasi perubahan dari→ke dan siapa yang melakukan.
 */
export function buildRevisionEntry(
  userId: string | ObjectId,
  fromStatus: ArticleStatus,
  toStatus: ArticleStatus,
  reason?: string,
) {
  return {
    by: userId,
    at: new Date(),
    from: fromStatus,
    to: toStatus,
    ...(reason && { reason }),
  };
}

