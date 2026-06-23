/**
 * Indeks Service: Mengambil daftar artikel yang dipublikasikan untuk halaman indeks berita.
 *
 * Berbeda dengan searchService, halaman indeks:
 * - Tidak memerlukan full-text search
 * - Filter kategori berdasarkan slug → resolve ke `categoryId` (bukan field denormalisasi)
 * - Filter tanggal berdasarkan SATU hari penuh (dateFrom sampai akhir hari itu)
 * - Selalu diurutkan berdasarkan publishedAt DESC (terbaru dulu)
 *
 * Optimasi:
 * - Projection minimal pada query utama (skip field `content`)
 * - Batch populate dengan deduplication ID
 * - Batch populate berjalan paralel dengan minimal projection
 */

import { Db, ObjectId } from "mongodb";
import { ArticleStatus, ArticleListResponse, ArticleUrlFormat } from "@/types/article";
import logger from "@/lib/logger";
import { normalizeFeaturedImage } from "@/lib/helper-article";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Parameter untuk query halaman indeks berita */
export interface IndeksParams {
  /** Slug kategori. Kosong berarti semua kategori. */
  categorySlug?: string;
  /**
   * Tanggal spesifik dalam format ISO (YYYY-MM-DD).
   * Akan mengambil artikel yang publishedAt-nya jatuh pada hari itu.
   * Kosong berarti semua tanggal.
   */
  date?: string;
  /** Nomor halaman, 1-indexed. Default: 1 */
  page?: number;
  /** Jumlah artikel per halaman. Default: 12, maks: 50 */
  limit?: number;
}

/** Response standar dari getIndeksArticles() */
export interface IndeksResult {
  success: true;
  data: ArticleListResponse[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
  };
}

// ─── Projections ──────────────────────────────────────────────────────────────

/**
 * Field yang diambil dari collection `articles` untuk halaman indeks.
 * Field `content` dan `revisionHistory` dikecualikan karena sangat besar.
 */
const ARTICLE_PROJECTION = {
  _id: 1,
  title: 1,
  slug: 1,
  publicPath: 1,
  urlFormat: 1,
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
  featuredImageId: 1,
  isFeatured: 1,
  isHeadline: 1,
  isBreaking: 1,
  viewCount: 1,
  publishedAt: 1,
  updatedAt: 1,
} as const;

/** Field yang diambil dari collection `media` saat populate */
const MEDIA_PROJECTION = {
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
const USER_PROJECTION = {
  _id: 1,
  name: 1,
  email: 1,
  avatar: 1,
  role: 1,
} as const;

/** Field yang diambil dari collection `categories` saat populate */
const CATEGORY_PROJECTION = {
  _id: 1,
  name: 1,
  slug: 1,
  description: 1,
  parentId: 1,
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MIN_LIMIT = 1;
const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 12;

function clampLimit(raw: number | undefined): number {
  const value = raw ?? DEFAULT_LIMIT;
  return Math.max(MIN_LIMIT, Math.min(value, MAX_LIMIT));
}

/**
 * Konversi nilai ke ObjectId secara aman.
 * Return null jika nilai tidak valid sebagai ObjectId.
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
 * Kumpulkan ID unik dari array dokumen berdasarkan nama field.
 * Menggunakan Set untuk deduplication — jika 12 artikel ditulis oleh 2 author,
 * hanya 2 ObjectId yang dihasilkan (bukan 12).
 */
function collectUniqueIds(
  docs: Record<string, unknown>[],
  fieldName: string,
): ObjectId[] {
  const seen = new Set<string>();
  const ids: ObjectId[] = [];

  for (const doc of docs) {
    const rawValue = doc[fieldName];
    if (!rawValue) continue;

    const idString = String(rawValue);
    if (seen.has(idString)) continue;

    const objectId = toObjectId(rawValue);
    if (objectId) {
      seen.add(idString);
      ids.push(objectId);
    }
  }

  return ids;
}

/** Kumpulkan ID media unik dari featuredImageId atau embedded featuredImage.mediaId */
function collectFeaturedImageIds(
  docs: Record<string, unknown>[],
): ObjectId[] {
  const seen = new Set<string>();
  const ids: ObjectId[] = [];

  const add = (value: unknown) => {
    if (!value) return;
    const idString = String(value);
    if (seen.has(idString)) return;
    const objectId = toObjectId(value);
    if (objectId) {
      seen.add(idString);
      ids.push(objectId);
    }
  };

  for (const doc of docs) {
    add(doc.featuredImageId);
    const fi = doc.featuredImage;
    if (fi && typeof fi === "object" && "mediaId" in fi) {
      add((fi as { mediaId?: unknown }).mediaId);
    }
  }

  return ids;
}

// ─── Service Function ─────────────────────────────────────────────────────────

/**
 * Mengambil daftar artikel yang dipublikasikan untuk halaman indeks berita.
 *
 * Filter:
 * - Hanya artikel yang `status === PUBLISHED` dan `deletedAt === null`
 * - Opsional: filter `categoryId` dari slug kategori (satu kategori)
 * - Opsional: filter `publishedAt` dalam satu hari penuh (00:00:00 – 23:59:59 UTC)
 *
 * Sorting: publishedAt DESC (terbaru dulu), tidak bisa diubah dari luar.
 */
export async function getIndeksArticles(
  db: Db,
  params: IndeksParams,
): Promise<IndeksResult> {
  try {
    // ── Build Filter ──
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: Record<string, any> = {
      status: ArticleStatus.PUBLISHED,
      deletedAt: null,
    };

    // Filter kategori: resolve slug → ObjectId, lalu filter categoryId
    const categorySlug = params.categorySlug?.trim() ?? "";
    if (categorySlug.length > 0) {
      const matchedCategory = await db
        .collection("categories")
        .findOne({ slug: categorySlug }, { projection: { _id: 1 } });

      if (!matchedCategory?._id) {
        const limit = clampLimit(params.limit);
        const page = Math.max(1, params.page ?? 1);
        return {
          success: true,
          data: [],
          meta: {
            page,
            limit,
            total: 0,
            totalPages: 0,
            hasNextPage: false,
          },
        };
      }

      filter.categoryId = matchedCategory._id;
    }

    // Filter satu hari penuh berdasarkan publishedAt
    // Contoh: date = "2026-04-28" → gte 2026-04-28T00:00:00Z, lte 2026-04-28T23:59:59.999Z
    if (params.date && params.date.trim().length > 0) {
      const dayStart = new Date(`${params.date}T00:00:00.000Z`);
      const dayEnd = new Date(`${params.date}T23:59:59.999Z`);

      // Validasi: pastikan tanggal yang diberikan adalah tanggal yang valid
      if (!isNaN(dayStart.getTime()) && !isNaN(dayEnd.getTime())) {
        filter.publishedAt = { $gte: dayStart, $lte: dayEnd };
      }
    }

    // ── Paginasi ──
    const limit = clampLimit(params.limit);
    const page = Math.max(1, params.page ?? 1);
    const skip = (page - 1) * limit;

    // ── Query Utama: count + fetch berjalan paralel ──
    const [total, rawArticles] = await Promise.all([
      db.collection("articles").countDocuments(filter),
      db
        .collection<Record<string, unknown>>("articles")
        .find(filter, { projection: ARTICLE_PROJECTION })
        .sort({ publishedAt: -1 }) // Selalu terbaru dulu
        .skip(skip)
        .limit(limit)
        .toArray(),
    ]);

    // ── Batch Populate dengan Deduplication ──
    // Kumpulkan hanya ID unik dari halaman ini untuk meminimalkan data yang difetch
    const featuredImageIds = collectFeaturedImageIds(rawArticles);
    const authorIds = collectUniqueIds(rawArticles, "authorId");
    const categoryIds = collectUniqueIds(rawArticles, "categoryId");

    // ── Fetch ketiga collection populasi secara paralel ──
    const [mediaDocs, userDocs, categoryDocs] = await Promise.all([
      featuredImageIds.length > 0
        ? db
            .collection("media")
            .find(
              { _id: { $in: featuredImageIds } },
              { projection: MEDIA_PROJECTION },
            )
            .toArray()
        : [],
      authorIds.length > 0
        ? db
            .collection("users")
            .find({ _id: { $in: authorIds } }, { projection: USER_PROJECTION })
            .toArray()
        : [],
      categoryIds.length > 0
        ? db
            .collection("categories")
            .find(
              { _id: { $in: categoryIds } },
              { projection: CATEGORY_PROJECTION },
            )
            .toArray()
        : [],
    ]);

    // ── Buat Map untuk lookup O(1) ──
    const mediaMap = new Map(mediaDocs.map((m) => [m._id.toString(), m]));
    const userMap = new Map(userDocs.map((u) => [u._id.toString(), u]));
    const categoryMap = new Map(categoryDocs.map((c) => [c._id.toString(), c]));

    // ── Normalisasi ke ArticleListResponse ──
    const data: ArticleListResponse[] = rawArticles.map((doc) => {
      const docId =
        doc._id instanceof ObjectId ? doc._id.toString() : String(doc._id);

      const embeddedFi =
        doc.featuredImage && typeof doc.featuredImage === "object"
          ? (doc.featuredImage as Record<string, unknown>)
          : null;
      const featuredImageIdStr =
        doc.featuredImageId?.toString?.() ??
        embeddedFi?.mediaId?.toString?.() ??
        null;
      const authorIdStr = doc.authorId?.toString?.() ?? null;
      const categoryIdStr = doc.categoryId?.toString?.() ?? null;

      const populatedMedia = featuredImageIdStr
        ? (mediaMap.get(featuredImageIdStr) ?? null)
        : null;
      const populatedAuthor = authorIdStr
        ? (userMap.get(authorIdStr) ?? null)
        : null;
      const populatedCategory = categoryIdStr
        ? (categoryMap.get(categoryIdStr) ?? null)
        : null;

      return {
        _id: docId,
        title: String(doc.title ?? ""),
        slug: String(doc.slug ?? ""),
        publicPath: doc.publicPath ? String(doc.publicPath) : null,
        urlFormat:
          doc.urlFormat === "structured"
            ? ("structured" as ArticleUrlFormat)
            : ("legacy" as ArticleUrlFormat),
        excerpt: String(doc.excerpt ?? ""),

        // Gunakan data dari collection `categories` jika ada, fallback ke denormalisasi
        category: populatedCategory
          ? {
              _id: populatedCategory._id?.toString(),
              name: populatedCategory.name ?? "",
              slug: populatedCategory.slug ?? "",
              description: populatedCategory.description,
              parentId: populatedCategory.parentId?.toString?.() ?? undefined,
            }
          : doc.category
            ? (doc.category as ArticleListResponse["category"])
            : {
                _id: "",
                name: "",
                slug: "",
                description: undefined,
                parentId: undefined,
              },

        tags: (doc.tags as ArticleListResponse["tags"]) ?? [],

        featuredImage:
          normalizeFeaturedImage(doc.featuredImage, populatedMedia) ??
          undefined,

        // Gunakan data dari collection `users` jika ada, fallback ke denormalisasi
        author: populatedAuthor
          ? {
              _id: populatedAuthor._id?.toString() ?? "",
              name: populatedAuthor.name ?? "",
              email: populatedAuthor.email ?? "",
              avatar: populatedAuthor.avatar ?? undefined,
              role: populatedAuthor.role ?? "writer",
            }
          : (doc.author as ArticleListResponse["author"]),

        status: doc.status as ArticleListResponse["status"],
        format: doc.format as ArticleListResponse["format"],
        isFeatured: Boolean(doc.isFeatured),
        isHeadline: Boolean(doc.isHeadline),
        isBreaking: Boolean(doc.isBreaking),
        viewCount: Number(doc.viewCount ?? 0),
        publishedAt: doc.publishedAt
          ? new Date(doc.publishedAt as string)
          : new Date(0),
        updatedAt: doc.updatedAt
          ? new Date(doc.updatedAt as string)
          : new Date(0),
      };
    });

    const totalPages = Math.ceil(total / limit);

    return {
      success: true,
      data,
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
      },
    };
  } catch (error) {
    logger.error(
      { error, params },
      "getIndeksArticles: Gagal mengambil artikel indeks",
    );
    throw error;
  }
}
