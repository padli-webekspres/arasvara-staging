/**
 * Search service: Pencarian artikel dan video ke MongoDB.
 * Menggunakan arsitektur Exclusive Mode — tidak ada cross-collection lookup yang berat.
 * Sorotan khusus (popular, editor_choice, headline) di-resolve dari koleksi `section_articles`.
 *
 * Optimasi resource server:
 * 1. Flag pre-queries dijalankan paralel (bukan sequential)
 * 2. Main article query hanya fetch field yang dibutuhkan (skip `content`)
 * 3. Deduplication ID sebelum batch populate untuk meminimalkan data yang diambil
 * 4. Batch populate hanya fetch field yang diperlukan (projection)
 * 5. `deletedAt` filter diperbaiki agar menangkap dokumen tanpa field tersebut
 */

import { Db, ObjectId } from "mongodb";
import { ArticleStatus, ArticleListResponse } from "@/types/article";
import {
  ArticleSearchParams,
  ArticleSearchResult,
  VideoSearchParams,
  VideoSearchResult,
  VideoItem,
} from "@/types/search";
import logger from "@/lib/logger";
import { normalizeFeaturedImage } from "@/lib/helper-article";

// ─── Constants ────────────────────────────────────────────────────────────────

const MIN_LIMIT = 1;
const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 12;

/** Nilai `flags` dari URL search → field `type` di `section_articles`. */
const SECTION_FLAG_TYPE_MAP: Record<string, string> = {
  popular: "popular",
  editor_choice: "editor choices",
  headline: "headline",
};

/**
 * Field yang diambil dari collection `articles` saat pencarian.
 * Field `content` dan `revisionHistory` sengaja dikecualikan karena
 * bisa sangat besar dan tidak dibutuhkan di halaman list/card.
 */
const ARTICLE_LIST_PROJECTION = {
  _id: 1,
  title: 1,
  slug: 1,
  excerpt: 1,
  format: 1,
  status: 1,
  categoryId: 1,
  "category.name": 1,
  "category.slug": 1,
  authorId: 1,
  "author.name": 1,
  tags: 1,
  featuredImage: 1,
  isFeatured: 1,
  isHeadline: 1,
  isBreaking: 1,
  viewCount: 1,
  publishedAt: 1,
  updatedAt: 1,
} as const;

/** Field yang diambil dari collection `media` saat populate */
const MEDIA_POPULATE_PROJECTION = {
  _id: 1,
  url: 1,
  filename: 1,
  mimetype: 1,
  size: 1,
  caption: 1,
  credit: 1,
  watermark: 1,
} as const;

/** Field yang diambil dari collection `users` saat populate */
const USER_POPULATE_PROJECTION = {
  _id: 1,
  name: 1,
  email: 1,
  avatar: 1,
  role: 1,
} as const;

/** Field yang diambil dari collection `categories` saat populate */
const CATEGORY_POPULATE_PROJECTION = {
  _id: 1,
  name: 1,
  slug: 1,
  description: 1,
  parentId: 1,
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clampLimit(raw: number | undefined): number {
  const value = raw ?? DEFAULT_LIMIT;
  return Math.max(MIN_LIMIT, Math.min(value, MAX_LIMIT));
}

/**
 * Normalisasi param status untuk filter koleksi `articles`.
 * @returns `ArticleStatus` untuk filter tepat satu status; `null` berarti tanpa filter status (`all`).
 */
function resolveArticleSearchStatusFilter(
  raw: string | undefined,
): ArticleStatus | null {
  const s = raw?.trim().toLowerCase() ?? "";
  if (!s || s === "published") return ArticleStatus.PUBLISHED;
  if (s === "all") return null;

  const upper = s.replace(/-/g, "_").toUpperCase();
  const allowed = Object.values(ArticleStatus) as string[];
  if (allowed.includes(upper)) return upper as ArticleStatus;

  return ArticleStatus.PUBLISHED;
}

/**
 * Konversi string atau ObjectId ke ObjectId dengan aman.
 * Return null jika nilai tidak valid.
 */
function toObjectId(value: unknown): ObjectId | null {
  if (value instanceof ObjectId) return value;
  try {
    return new ObjectId(String(value));
  } catch {
    return null;
  }
}

/**
 * Kumpulkan ID unik dari array dokumen.
 * Menggunakan Set<string> untuk deduplication sebelum konversi ke ObjectId.
 */
function collectUniqueIds(
  docs: Record<string, unknown>[],
  field: string,
): ObjectId[] {
  const seen = new Set<string>();
  const ids: ObjectId[] = [];

  for (const doc of docs) {
    const raw = doc[field];
    if (!raw) continue;
    const str = String(raw);
    if (seen.has(str)) continue; // Lewati duplikat
    const id = toObjectId(raw);
    if (id) {
      seen.add(str);
      ids.push(id);
    }
  }

  return ids;
}

// ─── Article Search ───────────────────────────────────────────────────────────

/**
 * Mencari artikel berdasarkan berbagai filter.
 * Default: hanya status `PUBLISHED`; gunakan `status=all` untuk semua status.
 *
 * Aturan kombinasi filter:
 * - Intra-filter (contoh: kategori A ATAU kategori B) → logika OR ($in)
 * - Inter-filter (contoh: kategori A DAN teks "Buah") → logika AND ($and)
 */
export async function searchArticles(
  db: Db,
  params: ArticleSearchParams,
): Promise<ArticleSearchResult> {
  try {
    // ── Kondisi wajib (selalu diterapkan) ──
    // Gunakan flat filter untuk dua kondisi wajib agar query planner lebih efisien.
    // `deletedAt: null` juga menangkap dokumen yang tidak memiliki field ini
    // karena MongoDB memperlakukan field yang tidak ada sebagai null dalam perbandingan.
    const statusFilter = resolveArticleSearchStatusFilter(params.status);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const baseFilter: Record<string, any> = {
      deletedAt: null,
    };
    if (statusFilter !== null) {
      baseFilter.status = statusFilter;
    }

    // Kondisi tambahan dari filter user (digabung via $and setelah base filter)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const extraConditions: Record<string, any>[] = [];

    // ── Filter Teks ──
    // Mencari di title, metaDesc, tags.name, category.name, author.name secara OR.
    // Data category.name dan author.name harus sudah didenormalisasi di dalam dokumen.
    if (params.search && params.search.trim().length > 0) {
      const regex = { $regex: params.search.trim(), $options: "i" };
      extraConditions.push({
        $or: [
          { title: regex },
          { metaDesc: regex },
          { "tags.name": regex },
          { "category.name": regex },
          { "author.name": regex },
        ],
      });
    }

    // ── Filter Format (STANDARD / GALLERY) — OR intra-filter ──
    if (params.format && params.format.length > 0) {
      extraConditions.push({ format: { $in: params.format } });
    }

    // ── Filter Kategori berdasarkan slug — OR intra-filter ──
    if (params.categories && params.categories.length > 0) {
      const matchedCats = await db
        .collection("categories")
        .find({ slug: { $in: params.categories } }, { projection: { _id: 1 } })
        .toArray();
      
      const categoryIds = matchedCats.map((c) => c._id);
      
      if (categoryIds.length > 0) {
        extraConditions.push({ categoryId: { $in: categoryIds } });
      } else {
        // Jika kategori yang dicari tidak ditemukan sama sekali, kembalikan hasil kosong langsung
        return buildEmptyArticleResult(params);
      }
    }

    // ── Filter Tag berdasarkan slug — OR intra-filter (Case Insensitive) ──
    if (params.tags && params.tags.length > 0) {
      const normalizedTags = params.tags.map((t) => t.toLowerCase().trim()).filter(Boolean);
      extraConditions.push({ "tags.slug": { $in: normalizedTags } });
    }

    // ── Filter satu penulis (CMS / restraksi role) ──
    if (params.authorId?.trim() && ObjectId.isValid(params.authorId.trim())) {
      extraConditions.push({
        authorId: new ObjectId(params.authorId.trim()),
      });
    }

    // ── Filter Sorotan Khusus (section_articles — sama dengan admin popular/editor/headline) ──
    if (params.flags && params.flags.length > 0) {
      const sectionTypes = [
        ...new Set(
          params.flags
            .map((flag) => SECTION_FLAG_TYPE_MAP[flag])
            .filter((t): t is string => Boolean(t)),
        ),
      ];

      if (sectionTypes.length === 0) {
        return buildEmptyArticleResult(params);
      }

      const sectionDocs = await db
        .collection("section_articles")
        .find(
          { type: { $in: sectionTypes } },
          { projection: { article_id: 1 } },
        )
        .toArray();

      const seenIds = new Set<string>();
      const allFlagIds: ObjectId[] = [];
      for (const doc of sectionDocs) {
        const id = toObjectId(doc.article_id);
        if (!id) continue;
        const key = id.toString();
        if (seenIds.has(key)) continue;
        seenIds.add(key);
        allFlagIds.push(id);
      }

      if (allFlagIds.length > 0) {
        extraConditions.push({ _id: { $in: allFlagIds } });
      } else {
        return buildEmptyArticleResult(params);
      }
    }

    // ── Filter Rentang Tanggal (publishedAt) ──
    if (params.dateFrom || params.dateTo) {
      const dateFilter: Record<string, Date> = {};
      if (params.dateFrom) dateFilter.$gte = new Date(params.dateFrom);
      if (params.dateTo) dateFilter.$lte = new Date(params.dateTo);
      extraConditions.push({ publishedAt: dateFilter });
    }

    // ── Build final filter ──
    // Gabungkan base filter (flat) + extra conditions ($and) untuk efisiensi query planner.
    const filter =
      extraConditions.length > 0
        ? { ...baseFilter, $and: extraConditions }
        : baseFilter;

    // ── Sort ──
    const sortField =
      params.sortBy === "views"
        ? "viewCount"
        : params.sortBy === "title"
          ? "title"
          : params.sortBy === "updatedAt"
            ? "updatedAt"
            : "publishedAt";
    const sortDirection = params.sortOrder === "asc" ? 1 : -1;

    // ── Paginasi ──
    const limit = clampLimit(params.limit);
    const page = Math.max(1, params.page ?? 1);
    const skip = (page - 1) * limit;

    // ── Query utama ke database (count + fetch paralel) ──
    // Projection penting: SKIP field `content` dan `revisionHistory`
    // yang bisa mencapai ratusan KB per dokumen.
    const [total, rawArticles] = await Promise.all([
      db.collection("articles").countDocuments(filter),
      db
        .collection<Record<string, unknown>>("articles")
        .find(filter, { projection: ARTICLE_LIST_PROJECTION })
        .sort({ [sortField]: sortDirection })
        .skip(skip)
        .limit(limit)
        .toArray(),
    ]);

    // ── Batch Populate dengan Deduplication ──
    // Kumpulkan ID media secara robust dari featuredImage (bisa bare ObjectId atau embedded object)
    const featuredImageIds: ObjectId[] = [];
    const seenMediaIds = new Set<string>();
    for (const doc of rawArticles) {
      const fi = doc.featuredImage;
      if (!fi) continue;
      let mediaId: ObjectId | null = null;
      if (fi instanceof ObjectId) {
        mediaId = fi;
      } else if (typeof fi === "string") {
        try { mediaId = new ObjectId(fi); } catch {}
      } else if (typeof fi === "object" && fi !== null) {
        const obj = fi as Record<string, unknown>;
        const rawId = obj.mediaId ?? obj._id;
        if (rawId) {
          if (rawId instanceof ObjectId) {
            mediaId = rawId;
          } else if (typeof rawId === "string") {
            try { mediaId = new ObjectId(rawId); } catch {}
          }
        }
      }
      if (mediaId) {
        const idStr = mediaId.toString();
        if (!seenMediaIds.has(idStr)) {
          seenMediaIds.add(idStr);
          featuredImageIds.push(mediaId);
        }
      }
    }

    const authorIds = collectUniqueIds(rawArticles, "authorId");
    const categoryIds = collectUniqueIds(rawArticles, "categoryId");

    // ── Fetch collection populasi secara paralel dengan projection minimal ──
    const [mediaDocs, userDocs, categoryDocs] = await Promise.all([
      featuredImageIds.length > 0
        ? db
            .collection("media")
            .find({ _id: { $in: featuredImageIds } }, { projection: MEDIA_POPULATE_PROJECTION })
            .toArray()
        : [],
      authorIds.length > 0
        ? db
            .collection("users")
            .find({ _id: { $in: authorIds } }, { projection: USER_POPULATE_PROJECTION })
            .toArray()
        : [],
      categoryIds.length > 0
        ? db
            .collection("categories")
            .find({ _id: { $in: categoryIds } }, { projection: CATEGORY_POPULATE_PROJECTION })
            .toArray()
        : [],
    ]);

    // ── Buat Map untuk lookup O(1) per dokumen ──
    const mediaMap = new Map(mediaDocs.map((m) => [m._id.toString(), m]));
    const userMap = new Map(userDocs.map((u) => [u._id.toString(), u]));
    const categoryMap = new Map(categoryDocs.map((c) => [c._id.toString(), c]));

    // ── Normalisasi hasil ke ArticleListResponse ──
    const data: ArticleListResponse[] = rawArticles.map((doc) => {
      const docId = doc._id instanceof ObjectId ? doc._id.toString() : String(doc._id);

      let featuredImageIdStr: string | null = null;
      const fi = doc.featuredImage;
      if (fi) {
        if (fi instanceof ObjectId) {
          featuredImageIdStr = fi.toString();
        } else if (typeof fi === "string") {
          featuredImageIdStr = fi;
        } else if (typeof fi === "object" && fi !== null) {
          const obj = fi as Record<string, unknown>;
          const rawId = obj.mediaId ?? obj._id;
          if (rawId) {
            featuredImageIdStr = rawId.toString();
          }
        }
      }

      const authorIdStr = doc.authorId?.toString?.() ?? null;
      const categoryIdStr = doc.categoryId?.toString?.() ?? null;

      const rawMedia = featuredImageIdStr ? (mediaMap.get(featuredImageIdStr) ?? null) : null;
      const rawAuthor = authorIdStr ? (userMap.get(authorIdStr) ?? null) : null;
      const rawCategory = categoryIdStr ? (categoryMap.get(categoryIdStr) ?? null) : null;

      return {
        _id: docId,
        title: String(doc.title ?? ""),
        slug: String(doc.slug ?? ""),
        publicPath: doc.publicPath ? String(doc.publicPath) : null,
        urlFormat:
          doc.urlFormat === "structured"
            ? ("structured" as const)
            : doc.urlFormat === "legacy"
              ? ("legacy" as const)
              : undefined,
        excerpt: String(doc.excerpt ?? ""),

        category: rawCategory
          ? {
              _id: rawCategory._id?.toString(),
              name: rawCategory.name ?? "",
              slug: rawCategory.slug ?? "",
              description: rawCategory.description,
              parentId: rawCategory.parentId?.toString?.() ?? undefined,
            }
          : doc.category
            ? (doc.category as ArticleListResponse["category"])
            : { _id: "", name: "", slug: "", description: undefined, parentId: undefined },

        tags: (doc.tags as ArticleListResponse["tags"]) ?? [],

        featuredImage: normalizeFeaturedImage(doc.featuredImage, rawMedia),

        author: rawAuthor
          ? {
              _id: rawAuthor._id?.toString() ?? "",
              name: rawAuthor.name ?? "",
              email: rawAuthor.email ?? "",
              avatar: rawAuthor.avatar ?? undefined,
              role: rawAuthor.role ?? "writer",
            }
          : (doc.author as ArticleListResponse["author"]),

        status: doc.status as ArticleListResponse["status"],
        format:
          doc.format === "GALLERY"
            ? "GALLERY"
            : doc.format === "STANDARD"
              ? "STANDARD"
              : undefined,
        isFeatured: Boolean(doc.isFeatured),
        isHeadline: Boolean(doc.isHeadline),
        isBreaking: Boolean(doc.isBreaking),
        viewCount: Number(doc.viewCount ?? 0),
        publishedAt: doc.publishedAt ? new Date(doc.publishedAt as string) : new Date(0),
        updatedAt: doc.updatedAt ? new Date(doc.updatedAt as string) : new Date(0),
      };
    });

    const totalPages = Math.ceil(total / limit);

    return {
      success: true,
      data,
      meta: { page, limit, total, totalPages, hasNextPage: page < totalPages },
    };
  } catch (error) {
    logger.error({ error, params }, "searchArticles: Gagal mencari artikel");
    throw error;
  }
}

/** Helper: kembalikan hasil kosong tanpa menyentuh database */
function buildEmptyArticleResult(params: ArticleSearchParams): ArticleSearchResult {
  const limit = clampLimit(params.limit);
  return {
    success: true,
    data: [],
    meta: { page: params.page ?? 1, limit, total: 0, totalPages: 0, hasNextPage: false },
  };
}

// ─── Video Search ─────────────────────────────────────────────────────────────

/**
 * Mencari video dari collection `video_section`.
 * Tidak menggunakan data dari collection articles — Exclusive Mode.
 * Video tidak mendukung sorting berdasarkan view count.
 */
export async function searchVideos(
  db: Db,
  params: VideoSearchParams,
): Promise<VideoSearchResult> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: Record<string, any> = {};

    // ── Filter Teks — hanya pada field title ──
    if (params.search && params.search.trim().length > 0) {
      filter.title = { $regex: params.search.trim(), $options: "i" };
    }

    // ── Filter Platform (tiktok / instagram / youtube) — OR intra-filter ──
    if (params.platforms && params.platforms.length > 0) {
      filter.type = { $in: params.platforms };
    }

    // ── Filter Rentang Tanggal (createdAt) ──
    if (params.dateFrom || params.dateTo) {
      const dateFilter: Record<string, Date> = {};
      if (params.dateFrom) dateFilter.$gte = new Date(params.dateFrom);
      if (params.dateTo) dateFilter.$lte = new Date(params.dateTo);
      filter.createdAt = dateFilter;
    }

    // ── Sort — hanya berdasarkan createdAt (video tidak punya viewCount) ──
    const sortDirection = params.sortOrder === "asc" ? 1 : -1;

    // ── Paginasi ──
    const limit = clampLimit(params.limit);
    const page = Math.max(1, params.page ?? 1);
    const skip = (page - 1) * limit;

    // ── Query ke database (count + fetch paralel, dengan projection minimal) ──
    const [total, rawVideos] = await Promise.all([
      db.collection("video_section").countDocuments(filter),
      db
        .collection<Record<string, unknown>>("video_section")
        .find(filter, {
          projection: {
            _id: 1,
            title: 1,
            type: 1,
            video_url: 1,
            embedId: 1,
            thumbnail_url: 1,
            thumbnail: 1,
            createdAt: 1,
          },
        })
        .sort({ createdAt: sortDirection })
        .skip(skip)
        .limit(limit)
        .toArray(),
    ]);

    // ── Normalisasi ke VideoItem ──
    const data: VideoItem[] = rawVideos.map((doc) => {
      // Dapatkan thumbnail URL secara robust, baik dari thumbnail_url (string) maupun subdokumen thumbnail (Media)
      const thumbUrl =
        typeof doc.thumbnail_url === "string" && doc.thumbnail_url.trim()
          ? doc.thumbnail_url
          : typeof doc.thumbnail === "object" && doc.thumbnail !== null
            ? String((doc.thumbnail as any).url ?? "")
            : "";

      return {
        _id: doc._id instanceof ObjectId ? doc._id.toString() : String(doc._id),
        title: String(doc.title ?? ""),
        type: (doc.type as VideoItem["type"]) ?? "youtube",
        url: String(doc.video_url ?? doc.url ?? ""),
        embedId: doc.embedId ? String(doc.embedId) : undefined,
        thumbnailUrl: thumbUrl || undefined,
        createdAt: doc.createdAt ? new Date(doc.createdAt as string) : new Date(0),
      };
    });

    const totalPages = Math.ceil(total / limit);

    return {
      success: true,
      data,
      meta: { page, limit, total, totalPages, hasNextPage: page < totalPages },
    };
  } catch (error) {
    logger.error({ error, params }, "searchVideos: Gagal mencari video");
    throw error;
  }
}
