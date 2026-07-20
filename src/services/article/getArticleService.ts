/**
 * Get single article in approval queue (PENDING_REVIEW; serta APPROVED lewat dokumen lama)
 * by id or slug.
 * - Jika restrictToAuthorIfNotApprover=true dan user bukan approver, hanya boleh ambil milik sendiri (authorId)
 */
import { Db, ObjectId } from "mongodb";
import { Article, ArticleStatus } from "@/types/article";
import type { UserProfile } from "@/types/user";
import logger from "@/lib/logger";
import {
  POPULATE_STAGES,
  FEATURED_IMAGE_LOOKUP_STAGES,
  mapDocToArticle,
  distributeSlots,
  normalizeFeaturedImage,
  normalizeGalleryItemDoc,
  normalizeContentMediaItem,
} from "@/lib/helper-article";
import { rewriteArticleContentMediaUrls } from "@/lib/media/public-media-url";
import {
  isValidArticlePublicPath,
  buildLegacyArticlePath,
} from "@/lib/article-public-path";

/**
 * Cari semua slug dari marker `data-read-also` dalam HTML konten artikel,
 * batch-query publicPath-nya dari DB, lalu inject `data-public-path` ke HTML.
 *
 * Prioritas resolusi href per artikel referensi:
 *   1. `publicPath` sudah ada di DB → pakai langsung
 *   2. Ada `category.slug` + `publishedAt` → build structured path
 *   3. Ada `slug` saja → fallback ke /news/{slug}
 *
 * Dipanggil sekali saat hydrasi artikel di server — hasilnya ikut ISR cache.
 * Jika query gagal, HTML dikembalikan tanpa modifikasi (graceful fallback).
 */
async function injectReadAlsoPublicPaths(
  db: Db,
  html: string,
): Promise<string> {
  if (!html || !html.includes('data-read-also="true"')) return html;

  const divPattern = /<div\b([^>]*data-read-also="true"[^>]*)>/g;
  const slugAttrPattern = /data-slug="([^"]+)"/;
  const hasPublicPath = /data-public-path=/;

  const slugs: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = divPattern.exec(html)) !== null) {
    const attrs = m[1];
    if (hasPublicPath.test(attrs)) continue;
    const slugMatch = slugAttrPattern.exec(attrs);
    if (slugMatch?.[1]) slugs.push(slugMatch[1]);
  }

  if (slugs.length === 0) return html;

  const uniqueSlugs = [...new Set(slugs)];

  try {
    const docs = await db
      .collection("articles")
      .find(
        { slug: { $in: uniqueSlugs }, status: ArticleStatus.PUBLISHED },
        {
          projection: {
            slug: 1,
            publicPath: 1,
            publishedAt: 1,
            "category.slug": 1,
            categoryId: 1,
          },
        },
      )
      .toArray();

    const hrefMap = new Map<string, string>();
    for (const doc of docs) {
      if (!doc.slug) continue;
      const slug = String(doc.slug);

      // 1. publicPath sudah ada
      if (doc.publicPath) {
        hrefMap.set(slug, String(doc.publicPath));
        continue;
      }

      // 2. Coba build structured path dari category + publishedAt
      const categorySlug =
        (doc.category as Record<string, unknown> | null)?.slug ??
        undefined;
      if (categorySlug && doc.publishedAt) {
        try {
          const date =
            doc.publishedAt instanceof Date
              ? doc.publishedAt
              : new Date(String(doc.publishedAt));
          if (!Number.isNaN(date.getTime())) {
            const { buildStructuredArticlePath } = await import(
              "@/lib/article-public-path"
            );
            hrefMap.set(
              slug,
              buildStructuredArticlePath({
                categorySlug: String(categorySlug),
                publishedAt: date,
                articleSlug: slug,
              }),
            );
            continue;
          }
        } catch {
          // lanjut ke fallback
        }
      }

      // 3. Fallback: legacy /news/{slug}
      hrefMap.set(slug, buildLegacyArticlePath(slug));
    }

    if (hrefMap.size === 0) return html;

    return html.replace(
      /<div\b([^>]*data-read-also="true"[^>]*)>/g,
      (match, attrs: string) => {
        if (hasPublicPath.test(attrs)) return match;
        const slugMatch = slugAttrPattern.exec(attrs);
        if (!slugMatch?.[1]) return match;
        const href = hrefMap.get(slugMatch[1]);
        if (!href) return match;
        return `<div${attrs} data-public-path="${href}">`;
      },
    );
  } catch (err) {
    logger.warn(
      { err },
      "injectReadAlsoPublicPaths: gagal resolve publicPath, fallback ke HTML asal",
    );
    return html;
  }
}

/** Antrian editorial: baru + dokumen yang masih berstatus APPROVED di DB. */
const APPROVAL_QUEUE_STATUSES: (ArticleStatus | "APPROVED")[] = [
  ArticleStatus.PENDING_REVIEW,
  "APPROVED",
];

const ARTICLE_DETAIL_JOIN_STAGES = [
  {
    $lookup: {
      from: "categories",
      localField: "categoryId",
      foreignField: "_id",
      as: "categoryObj",
    },
  },
  {
    $addFields: {
      category: { $arrayElemAt: ["$categoryObj", 0] },
    },
  },
  {
    $addFields: {
      authorDenorm: "$author",
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
  {
    $addFields: {
      author: { $arrayElemAt: ["$authorObj", 0] },
    },
  },
  {
    $lookup: {
      from: "users",
      localField: "editorId",
      foreignField: "_id",
      as: "editorObj",
    },
  },
  {
    $addFields: {
      editor: { $arrayElemAt: ["$editorObj", 0] },
    },
  },
  {
    $lookup: {
      from: "users",
      localField: "createdById",
      foreignField: "_id",
      as: "createdByObj",
    },
  },
  {
    $addFields: {
      createdBy: { $arrayElemAt: ["$createdByObj", 0] },
    },
  },
  {
    $lookup: {
      from: "users",
      let: { cids: { $ifNull: ["$contributorIds", []] } },
      pipeline: [{ $match: { $expr: { $in: ["$_id", "$$cids"] } } }],
      as: "contributorsLookup",
    },
  },
  {
    $addFields: {
      contributors: {
        $filter: {
          input: {
            $map: {
              input: { $ifNull: ["$contributorIds", []] },
              as: "cid",
              in: {
                $arrayElemAt: [
                  {
                    $filter: {
                      input: "$contributorsLookup",
                      as: "u",
                      cond: { $eq: ["$$u._id", "$$cid"] },
                    },
                  },
                  0,
                ],
              },
            },
          },
          as: "c",
          cond: { $ne: ["$$c", null] },
        },
      },
    },
  },
  {
    $project: {
      categoryObj: 0,
      authorObj: 0,
      editorObj: 0,
      createdByObj: 0,
      contributorsLookup: 0,
    },
  },
] as const;

async function hydrateArticleAggregateDoc(
  db: Db,
  doc: Record<string, unknown>,
): Promise<Article> {
  const category = doc.category ?? null;
  const author = (doc.author as Record<string, unknown> | null | undefined) ?? null;
  const authorDenorm = doc.authorDenorm as
    | Record<string, unknown>
    | null
    | undefined;
  const editorDoc = (doc.editor as Record<string, unknown> | null | undefined) ?? null;
  const createdByDoc = (doc.createdBy as Record<string, unknown> | null | undefined) ?? null;
  const contributorsArr = Array.isArray(doc.contributors) ? doc.contributors : [];

  // ── Batch media lookup: featured, gallery, contentMedia ─────────────────────
  const rawFi = doc.featuredImage;
  const fiIsEmbedded =
    rawFi &&
    typeof rawFi === "object" &&
    ("mediaId" in rawFi || "_id" in rawFi);

  const toObjectId = (value: unknown): ObjectId | null => {
    if (!value) return null;
    if (value instanceof ObjectId) return value;
    try {
      return new ObjectId(String(value));
    } catch {
      return null;
    }
  };

  let featuredImageObjId: ObjectId | null = null;
  if (rawFi && !fiIsEmbedded) {
    featuredImageObjId = toObjectId(rawFi);
  }

  let embeddedFeaturedMediaId: ObjectId | null = null;
  if (fiIsEmbedded && rawFi && typeof rawFi === "object") {
    embeddedFeaturedMediaId = toObjectId(
      (rawFi as { mediaId?: unknown; _id?: unknown }).mediaId ??
        (rawFi as { _id?: unknown })._id,
    );
  }

  const galleryMediaIds: ObjectId[] =
    doc.format === "GALLERY" && Array.isArray(doc.galleryItems)
      ? doc.galleryItems
          .map((item: { mediaId?: unknown }) => toObjectId(item.mediaId))
          .filter((id): id is ObjectId => id != null)
      : [];

  const contentMediaIds: ObjectId[] =
    Array.isArray(doc.contentMedia)
      ? doc.contentMedia
          .map((item: { mediaId?: unknown }) => toObjectId(item.mediaId))
          .filter((id): id is ObjectId => id != null)
      : [];

  const allMediaIds = [
    ...galleryMediaIds,
    ...contentMediaIds,
    ...(featuredImageObjId ? [featuredImageObjId] : []),
    ...(embeddedFeaturedMediaId ? [embeddedFeaturedMediaId] : []),
  ];

  let mediaMap = new Map<string, Record<string, unknown>>();
  if (allMediaIds.length > 0) {
    const mediaDocs = await db
      .collection("media")
      .find({ _id: { $in: allMediaIds } })
      .toArray();
    mediaMap = new Map(
      mediaDocs.map((m) => [m._id.toString(), m as Record<string, unknown>]),
    );
  }

  const featuredLookupId =
    embeddedFeaturedMediaId ?? featuredImageObjId;
  const featuredImageMediaDoc = featuredLookupId
    ? (mediaMap.get(featuredLookupId.toString()) ?? null)
    : null;
  const featuredImage =
    normalizeFeaturedImage(rawFi, featuredImageMediaDoc) ?? undefined;

  let galleryItems = undefined;
  if (doc.format === "GALLERY" && Array.isArray(doc.galleryItems)) {
    galleryItems = doc.galleryItems.map((item: Record<string, unknown>) => {
      const mediaIdStr =
        item.mediaId != null ? String(item.mediaId) : "";
      return normalizeGalleryItemDoc(
        item,
        mediaMap.get(mediaIdStr) ?? null,
      );
    });
  }

  let contentMedia = undefined;
  if (doc.format !== "GALLERY" && Array.isArray(doc.contentMedia)) {
    contentMedia = doc.contentMedia.map((item: Record<string, unknown>) => {
      const mediaIdStr =
        item.mediaId != null ? String(item.mediaId) : "";
      return normalizeContentMediaItem(
        item,
        mediaMap.get(mediaIdStr) ?? null,
      );
    });
  }

  const rewrittenContent = await injectReadAlsoPublicPaths(
    db,
    rewriteArticleContentMediaUrls(
      typeof doc.content === "string" ? doc.content : "",
    ),
  );

  let authorSlug: string | undefined;
  if (author?.slug != null && String(author.slug).trim()) {
    authorSlug = String(author.slug).trim().toLowerCase();
  } else if (authorDenorm?.slug != null && String(authorDenorm.slug).trim()) {
    authorSlug = String(authorDenorm.slug).trim().toLowerCase();
  } else if (doc.authorId) {
    const authorOid =
      doc.authorId instanceof ObjectId
        ? doc.authorId
        : ObjectId.isValid(String(doc.authorId))
          ? new ObjectId(String(doc.authorId))
          : null;
    if (authorOid) {
      const slugDoc = await db
        .collection("users")
        .findOne({ _id: authorOid }, { projection: { slug: 1 } });
      if (slugDoc?.slug) {
        authorSlug = String(slugDoc.slug).trim().toLowerCase();
      }
    }
  }

  return {
    _id: doc._id?.toString(),
    title: doc.title,
    slug: doc.slug,
    excerpt: doc.excerpt,
    content: rewrittenContent,
    categoryId: doc.categoryId?.toString(),
    category,
    tags: doc.tags || [],
    featuredImage,
    authorId: doc.authorId?.toString(),
    author: author
      ? {
          _id: author._id?.toString?.() ?? author._id ?? "",
          name: author.name ?? "",
          slug: authorSlug,
          email: author.email ?? "",
          avatar: author.avatar,
          role: author.role ?? "SUBSCRIBER",
        }
      : {
          _id: "",
          name: "",
          email: "",
          avatar: undefined,
          role: "SUBSCRIBER",
        },
    editorId: doc.editorId ? doc.editorId.toString() : null,
    editor: editorDoc
      ? {
          _id: editorDoc._id?.toString?.() ?? editorDoc._id ?? "",
          name: editorDoc.name ?? "",
          slug: editorDoc.slug ? String(editorDoc.slug) : undefined,
          email: editorDoc.email ?? "",
          avatar: editorDoc.avatar,
          role: editorDoc.role ?? "SUBSCRIBER",
        }
      : null,
    contributors: contributorsArr.map((c: Record<string, unknown>) => ({
      _id: (c._id as { toString?: () => string })?.toString?.() ?? String(c._id ?? ""),
      name: String(c.name ?? ""),
      slug: c.slug ? String(c.slug) : undefined,
      email: String(c.email ?? ""),
      avatar: c.avatar as UserProfile["avatar"],
      role: (c.role ?? "SUBSCRIBER") as UserProfile["role"],
    })),
    contributorIds: Array.isArray(doc.contributorIds)
      ? doc.contributorIds.map((id: unknown) =>
          id instanceof ObjectId ? id.toString() : String(id),
        )
      : [],
    createdBy: createdByDoc
      ? {
          _id:
            createdByDoc._id?.toString?.() ?? createdByDoc._id ?? "",
          name: createdByDoc.name ?? "",
          email: createdByDoc.email ?? "",
          avatar: createdByDoc.avatar,
          role: createdByDoc.role ?? "SUBSCRIBER",
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
    scheduledAt: doc.scheduledAt ?? null,
    contentUpdatedAt: doc.contentUpdatedAt ?? null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    format: doc.format,
    galleryItems,
    publicPath: doc.publicPath ?? null,
    urlFormat: doc.urlFormat ?? "legacy",
    ...(contentMedia !== undefined ? { contentMedia } : {}),
  } as Article;
}

async function getArticleDetailByMatch(
  db: Db,
  match: Record<string, unknown>,
  notFoundLabel: string,
): Promise<Article | null> {
  const pipeline: any[] = [
    {
      $match: {
        ...match,
        deletedAt: { $in: [null, ""] },
      },
    },
    ...ARTICLE_DETAIL_JOIN_STAGES,
    { $limit: 1 },
  ];

  try {
    const doc = await db.collection("articles").aggregate(pipeline).next();
    if (!doc) {
      logger.error({ match: notFoundLabel }, "getArticleDetailByMatch: not found");
      return null;
    }
    return hydrateArticleAggregateDoc(db, doc as Record<string, unknown>);
  } catch (error) {
    logger.error({ match: notFoundLabel, error }, "getArticleDetailByMatch: error");
    throw error;
  }
}

// Get single article by id or slug (with category join)
export async function getArticleByIdOrSlug(
  db: Db,
  idOrSlug: string,
): Promise<Article | null> {
  const match: Record<string, unknown> = {};
  if (/^[a-f\d]{24}$/i.test(idOrSlug)) {
    match._id = new ObjectId(idOrSlug);
  } else {
    match.slug = idOrSlug;
  }
  return getArticleDetailByMatch(db, match, idOrSlug);
}

/** Lookup artikel PUBLISHED by exact denormalized publicPath. */
export async function getPublishedArticleByPublicPath(
  db: Db,
  publicPath: string,
): Promise<Article | null> {
  const normalized = publicPath.trim();
  if (!normalized || !isValidArticlePublicPath(normalized)) {
    return null;
  }
  return getArticleDetailByMatch(
    db,
    { publicPath: normalized, status: ArticleStatus.PUBLISHED },
    normalized,
  );
}

// Get articles by category id or slug, with pagination and category info
export async function getArticlesByCategoryIdOrSlug(
  db: Db,
  idOrSlug: string,
  {
    limit = 9,
    status = "PUBLISHED",
    cursor,
  }: { limit?: number; status?: string; cursor?: string } = {},
): Promise<{ category: any; articles: Article[]; nextCursor: string | null }> {
  // Find category by id or slug
  const catMatch: any = {};
  if (/^[a-f\d]{24}$/i.test(idOrSlug)) {
    catMatch._id = new ObjectId(idOrSlug);
  } else {
    catMatch.slug = idOrSlug;
  }
  const category = await db.collection("categories").findOne(catMatch);
  if (!category) {
    return { category: null, articles: [], nextCursor: null };
  }

  const articleMatch: any = {
    categoryId: category._id,
    deletedAt: { $in: [null, ""] },
    ...(status ? { status } : {}),
  };
  if (cursor) {
    articleMatch.publishedAt = { $lt: new Date(cursor) };
  }

  const pipeline: any[] = [
    { $match: articleMatch },
    { $sort: { publishedAt: -1, createdAt: -1 } },
    {
      $lookup: {
        from: "categories",
        localField: "categoryId",
        foreignField: "_id",
        as: "categoryObj",
      },
    },
    {
      $addFields: {
        category: { $arrayElemAt: ["$categoryObj", 0] },
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
    {
      $addFields: {
        author: { $arrayElemAt: ["$authorObj", 0] },
      },
    },
    // Backward-compat: populate featuredImage media for old ObjectId-ref articles
    ...FEATURED_IMAGE_LOOKUP_STAGES,
    { $project: { categoryObj: 0, authorObj: 0 } },
    { $limit: limit },
  ];

  const docs = await db.collection("articles").aggregate(pipeline).toArray();
  // mapDocToArticle handles format branching, featuredImage normalisation, and galleryItems mapping
  const articles: Article[] = await Promise.all(
    docs.map((doc) => mapDocToArticle(doc)),
  );
  const nextCursor =
    articles.length >= limit
      ? (() => {
          const last = [...articles].reverse().find((a) => a.publishedAt);
          return last?.publishedAt?.toISOString() ?? null;
        })()
      : null;
  return { category, articles, nextCursor };
}
/**
 * Fetch the latest articles from each given category slug, distributed so the
 * combined result contains exactly `total` articles (default 9).
 *
 * Steps:
 *  1. Resolve all slugs to category ObjectIds in one query.
 *  2. Run per-category aggregation queries in parallel (each with its own limit).
 *  3. Deduplicate by _id, merge, and sort by publishedAt desc.
 */
export async function getArticlesBySelectedTopics(
  db: Db,
  topicSlugs: string[],
  total = 9,
): Promise<Article[]> {
  if (!topicSlugs.length) return [];

  // 1. Resolve slugs → category documents (single query)
  const categories = await db
    .collection("categories")
    .find({ slug: { $in: topicSlugs } })
    .project({ _id: 1, slug: 1 })
    .toArray();

  const slugToCategory = new Map(categories.map((c) => [c.slug as string, c]));

  // Keep only slugs that resolved to a real category, preserving input order
  const resolvedSlugs = topicSlugs.filter((s) => slugToCategory.has(s));
  if (!resolvedSlugs.length) return [];

  const slots = distributeSlots(resolvedSlugs.length, total);

  // 2. Fetch articles per category in parallel
  const perTopicDocs = await Promise.all(
    resolvedSlugs.map((slug, i) => {
      const cat = slugToCategory.get(slug)!;
      return db
        .collection("articles")
        .aggregate([
          { $match: { status: "PUBLISHED", categoryId: cat._id } },
          { $sort: { publishedAt: -1 } },
          { $limit: slots[i] },
          ...POPULATE_STAGES,
        ])
        .toArray();
    }),
  );

  // 3. Flatten, deduplicate, and sort by publishedAt desc
  const seen = new Set<string>();
  const merged = perTopicDocs
    .flat()
    .filter((doc) => {
      const id = doc._id.toString();
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
    );

  // mapDocToArticle handles both format, featuredImage normalisation, and galleryItems
  return Promise.all(merged.map((doc) => mapDocToArticle(doc)));
}

/**
 * Get articles that are in the approval queue (PENDING_REVIEW; legacy APPROVED di DB).
 * Mendukung filter: category, search, pagination (page/limit atau cursor), authorId (opsional).
 * Jika restrictToAuthorIfNotApprover=true dan user bukan approver, hanya tampilkan milik authorId.
 */
export async function getApprovalQueue(
  db: Db,
  params: {
    limit?: number;
    page?: number;
    categorySlug?: string;
    search?: string;
    cursor?: string;
    authorId?: string;
    isApprover?: boolean;
    restrictToAuthorIfNotApprover?: boolean;
  } = {},
): Promise<{ articles: Article[]; nextCursor: string | null; total: number }> {
  const {
    limit: rawLimit = 10,
    page: rawPage = 1,
    categorySlug,
    search,
    cursor,
    authorId,
    isApprover = false,
    restrictToAuthorIfNotApprover = false,
  } = params;
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(rawLimit, 1), 100)
    : 10;
  const page = Number.isFinite(rawPage) ? Math.max(rawPage, 1) : 1;

  // Resolve category slug once so count and list use the same filter.
  let categoryId: ObjectId | undefined;
  if (categorySlug) {
    const categoryDoc = await db
      .collection("categories")
      .findOne({ slug: categorySlug }, { projection: { _id: 1 } });
    if (!categoryDoc?._id) {
      return { articles: [], nextCursor: null, total: 0 };
    }
    categoryId = categoryDoc._id as ObjectId;
  }

  const normalizedSearch = search?.trim();
  const escapeRegex = (value: string) =>
    value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const match: any = {
    deletedAt: { $in: [null, ""] },
    status: {
      $in: APPROVAL_QUEUE_STATUSES,
    },
    ...(categoryId ? { categoryId } : {}),
  };

  // Jika restrictToAuthorIfNotApprover aktif dan user bukan approver, wajib filter authorId
  if (restrictToAuthorIfNotApprover && !isApprover) {
    if (!authorId) {
      throw Object.assign(
        new Error("Forbidden: Only your own articles are visible."),
        { status: 403 },
      );
    }
    match.authorId =
      typeof authorId === "string" && /^[a-f\d]{24}$/i.test(authorId)
        ? new ObjectId(authorId)
        : authorId;
  }

  if (normalizedSearch) {
    const pattern = new RegExp(escapeRegex(normalizedSearch), "i");
    match.$or = [
      { title: pattern },
      { excerpt: pattern },
      { "tags.name": pattern },
      { "tags.slug": pattern },
    ];
  }
  if (cursor) {
    const cursorDate = new Date(cursor);
    if (!isNaN(cursorDate.getTime())) {
      match.updatedAt = { $lt: cursorDate };
    }
  }

  const pipeline: any[] = [
    { $match: match },
    { $sort: { updatedAt: -1, createdAt: -1 } },
    ...POPULATE_STAGES,
  ];

  // Pagination
  if (cursor) {
    pipeline.push({ $limit: limit });
  } else {
    pipeline.push({ $skip: (page - 1) * limit }, { $limit: limit });
  }

  // Total count (tanpa pagination)
  const total = await db.collection("articles").countDocuments(match);

  const docs = await db.collection("articles").aggregate(pipeline).toArray();

  // Batch media lookup for gallery items across all docs
  const allRawGalleryItems = docs
    .filter((doc) => doc.format === "GALLERY" && Array.isArray(doc.galleryItems))
    .flatMap((doc) => doc.galleryItems || []);
  const uniqueGalleryMediaIds = [
    ...new Set(
      allRawGalleryItems.map((item: any) =>
        typeof item.mediaId === "object" && item.mediaId?.toString
          ? item.mediaId.toString()
          : String(item.mediaId),
      ),
    ),
  ];
  let galleryMediaMap: Record<string, any> = {};
  if (uniqueGalleryMediaIds.length > 0) {
    const mediaDocs = await db
      .collection("media")
      .find({ _id: { $in: uniqueGalleryMediaIds.map((id) => new ObjectId(id)) } })
      .toArray();
    galleryMediaMap = Object.fromEntries(
      mediaDocs.map((m) => [m._id?.toString?.() ?? m._id, m]),
    );
  }

  const articles: Article[] = await Promise.all(
    docs.map(async (doc) => {
      // Inject populated gallery media onto the raw doc so mapDocToArticle can use it
      let patchedDoc = doc;
      if (doc.format === "GALLERY" && Array.isArray(doc.galleryItems)) {
        patchedDoc = {
          ...doc,
          galleryItems: doc.galleryItems.map((item: any) => {
            const mediaIdStr = item.mediaId?.toString?.() ?? item.mediaId;
            return normalizeGalleryItemDoc(item, galleryMediaMap[mediaIdStr] ?? null);
          }),
        };
      }
      return mapDocToArticle(patchedDoc);
    }),
  );
  const lastWithCreatedAt = [...articles].reverse().find((a) => a.updatedAt);
  const nextCursor =
    lastWithCreatedAt && lastWithCreatedAt.updatedAt
      ? lastWithCreatedAt.updatedAt.toISOString()
      : null;
  return { articles, nextCursor, total };
}

export async function getApprovalQueueArticleByIdOrSlug(
  db: Db,
  idOrSlug: string,
  opts: {
    authorId?: string;
    isApprover?: boolean;
    restrictToAuthorIfNotApprover?: boolean;
  } = {},
): Promise<Article | null> {
  const {
    authorId,
    isApprover = false,
    restrictToAuthorIfNotApprover = false,
  } = opts;
  const match: any = {
    deletedAt: { $in: [null, ""] },
    status: { $in: APPROVAL_QUEUE_STATUSES },
  };
  if (/^[a-f\d]{24}$/i.test(idOrSlug)) {
    match._id = new ObjectId(idOrSlug);
  } else {
    match.slug = idOrSlug;
  }
  // Jika restrictToAuthorIfNotApprover aktif dan user bukan approver, wajib filter authorId
  if (restrictToAuthorIfNotApprover && !isApprover) {
    if (!authorId) {
      throw Object.assign(
        new Error("Forbidden: Only your own articles are visible."),
        { status: 403 },
      );
    }
    match.authorId =
      typeof authorId === "string" && /^[a-f\d]{24}$/i.test(authorId)
        ? new ObjectId(authorId)
        : authorId;
  }

  const pipeline: any[] = [
    { $match: match },
    ...POPULATE_STAGES,
    { $limit: 1 },
  ];

  let doc;
  try {
    doc = await db.collection("articles").aggregate(pipeline).next();
    if (!doc) {
      const err = Object.assign(new Error("Article not found"), {
        status: 404,
      });
      logger.error(
        { idOrSlug },
        "getApprovalQueueArticleByIdOrSlug: Article not found",
      );
      throw err;
    }
  } catch (error) {
    logger.error(
      { idOrSlug, error },
      "getApprovalQueueArticleByIdOrSlug: Error fetching article",
    );
    throw error;
  }

  // Populate galleryItems.media if format is GALLERY
  let patchedDoc = doc;
  if (doc.format === "GALLERY" && Array.isArray(doc.galleryItems)) {
    const mediaIds = [
      ...new Set(
        doc.galleryItems.map((item: any) =>
          typeof item.mediaId === "object" && item.mediaId?.toString
            ? item.mediaId.toString()
            : String(item.mediaId),
        ),
      ),
    ];
    let mediaMap: Record<string, any> = {};
    if (mediaIds.length > 0) {
      const mediaDocs = await db
        .collection("media")
        .find({ _id: { $in: mediaIds.map((id) => new ObjectId(id)) } })
        .toArray();
      mediaMap = Object.fromEntries(
        mediaDocs.map((m) => [m._id?.toString?.() ?? m._id, m]),
      );
    }
    patchedDoc = {
      ...doc,
      galleryItems: doc.galleryItems.map((item: any) => {
        const mediaIdStr = item.mediaId?.toString?.() ?? item.mediaId;
        return normalizeGalleryItemDoc(item, mediaMap[mediaIdStr] ?? null);
      }),
    };
  }

  return mapDocToArticle(patchedDoc);
}

// get related article from article id, get relatedArticles. kemudian populate ke ArticleListResponse (tanpa content) untuk ditampilkan di related section. relatedArticles adalah array of SectionArticleItem { article_id, title, slug, publishedAt, featuredImageId }
import { ArticleListResponse } from "@/types/article";

/**
 * Ambil related articles dari field relatedArticles pada artikel utama,
 * populate ke ArticleListResponse (tanpa content) untuk ditampilkan di related section.
 * @param db MongoDB Db
 * @param idOrSlug string
 * @returns Promise<ArticleListResponse[]>
 */
export async function getRelatedArticles(
  db: Db,
  idOrSlug: string,
): Promise<ArticleListResponse[]> {
  // 1. Ambil artikel utama
  const article = await db
    .collection("articles")
    .findOne(
      /^[a-f\d]{24}$/i.test(idOrSlug)
        ? { _id: new ObjectId(idOrSlug) }
        : { slug: idOrSlug },
      { projection: { relatedArticles: 1 } },
    );
  if (
    !article ||
    !Array.isArray(article.relatedArticles) ||
    article.relatedArticles.length === 0
  ) {
    return [];
  }
  // 2. Ambil semua article_id dari relatedArticles
  const relatedIds = article.relatedArticles.map((r: any) =>
    typeof r.article_id === "object" && r.article_id?.toString
      ? r.article_id.toString()
      : String(r.article_id),
  );
  if (!relatedIds.length) return [];
  // 3. Query semua artikel terkait dengan populate category, author, editor, featuredImage
  const relatedDocs = await db
    .collection("articles")
    .aggregate([
      {
        $match: {
          _id: { $in: relatedIds.map((id) => new ObjectId(id)) },
          status: "PUBLISHED",
        },
      },
      // Populate category
      {
        $lookup: {
          from: "categories",
          localField: "categoryId",
          foreignField: "_id",
          as: "categoryObj",
        },
      },
      {
        $addFields: {
          category: { $arrayElemAt: ["$categoryObj", 0] },
        },
      },
      // Populate author
      {
        $lookup: {
          from: "users",
          localField: "authorId",
          foreignField: "_id",
          as: "authorObj",
        },
      },
      {
        $addFields: {
          author: { $arrayElemAt: ["$authorObj", 0] },
        },
      },
      // Populate editor
      {
        $lookup: {
          from: "users",
          localField: "editorId",
          foreignField: "_id",
          as: "editorObj",
        },
      },
      {
        $addFields: {
          editor: { $arrayElemAt: ["$editorObj", 0] },
        },
      },
      // Backward-compat: populate featuredImage media for old ObjectId-ref articles
      ...FEATURED_IMAGE_LOOKUP_STAGES,
      {
        $project: {
          _id: 1,
          title: 1,
          slug: 1,
          publicPath: 1,
          urlFormat: 1,
          excerpt: 1,
          category: 1,
          tags: 1,
          featuredImage: 1,
          featuredImageMedia: 1,
          author: 1,
          editor: 1,
          status: 1,
          isFeatured: 1,
          isHeadline: 1,
          isBreaking: 1,
          viewCount: 1,
          publishedAt: 1,
          updatedAt: 1,
        },
      },
    ])
    .toArray();

  // 4. Map ke ArticleListResponse dan urutkan sesuai urutan relatedArticles
  const idToDoc = Object.fromEntries(
    relatedDocs.map((doc) => [doc._id.toString(), doc]),
  );
  const result: ArticleListResponse[] = relatedIds
    .map((id) => idToDoc[id])
    .filter(Boolean)
    .map((doc) => ({
      _id: doc._id?.toString(),
      title: doc.title,
      slug: doc.slug,
      publicPath: doc.publicPath ?? null,
      urlFormat: doc.urlFormat ?? "legacy",
      excerpt: doc.excerpt,
      category: doc.category ?? null,
      tags: doc.tags || [],
      featuredImage: normalizeFeaturedImage(
        doc.featuredImage,
        doc.featuredImageMedia,
      ),
      author: doc.author
        ? {
            _id: doc.author._id?.toString?.() ?? doc.author._id ?? "",
            name: doc.author.name ?? "",
            slug: doc.author.slug ? String(doc.author.slug) : undefined,
            email: doc.author.email ?? "",
            avatar: doc.author.avatar,
            role: doc.author.role ?? "SUBSCRIBER",
          }
        : {
            _id: "",
            name: "",
            email: "",
            avatar: undefined,
            role: "SUBSCRIBER",
          },
      editor: doc.editor
        ? {
            _id: doc.editor._id?.toString?.() ?? doc.editor._id ?? "",
            name: doc.editor.name ?? "",
            slug: doc.editor.slug ? String(doc.editor.slug) : undefined,
            email: doc.editor.email ?? "",
            avatar: doc.editor.avatar,
            role: doc.editor.role ?? "SUBSCRIBER",
          }
        : null,
      status: doc.status,
      isFeatured: doc.isFeatured,
      isHeadline: doc.isHeadline,
      isBreaking: doc.isBreaking,
      viewCount: doc.viewCount || 0,
      publishedAt: doc.publishedAt,
      updatedAt: doc.updatedAt,
    }));
  return result;
}
