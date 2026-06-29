import { ArticleListResponse } from "./article";

// ─── Article Search ───────────────────────────────────────────────────────────

/**
 * Parameter yang diterima oleh `searchArticles()`.
 * Menggunakan OR intra-filter dan AND inter-filter.
 */
export interface ArticleSearchParams {
  // Full-text search (title, metaDesc/metaDescription, excerpt, tags, category, author)
  search?: string;

  // Filter format artikel (OR) — STANDARD | GALLERY
  format?: string[];

  // Filter kategori berdasarkan category slug (OR)
  categories?: string[];

  // Filter tag berdasarkan slug (OR)
  tags?: string[];

  // Filter sorotan khusus (OR): "popular" | "editor_choice" | "headline"
  flags?: string[];

  /**
   * Satu nilai status artikel (case-insensitive).
   * - Omitted / kosong / `"published"` → hanya `PUBLISHED` (default)
   * - `"all"` → tidak memfilter status (semua status selama tidak terhapus)
   * - Lainnya → salah satu nilai `ArticleStatus` (mis. `DRAFT`, `pending_review`)
   */
  status?: string;

  /** Filter satu penulis (ObjectId hex) — dipakai CMS untuk role writer/reporter */
  authorId?: string;

  // Filter rentang tanggal berdasarkan publishedAt (AND)
  dateFrom?: string; // ISO date string, e.g. "2024-01-01"
  dateTo?: string;   // ISO date string, e.g. "2024-12-31"

  // Sorting — Default: publishedAt desc
  sortBy?: "date" | "title" | "views" | "updatedAt";
  sortOrder?: "asc" | "desc";

  // Paginasi berbasis halaman
  page?: number;
  limit?: number;
  /** Offset dokumen (mengabaikan perhitungan page jika diset). */
  skip?: number;
}

// ─── Video Search ─────────────────────────────────────────────────────────────

/**
 * Parameter yang diterima oleh `searchVideos()`.
 */
export interface VideoSearchParams {
  // Full-text search hanya pada field title
  search?: string;

  // Filter platform (OR): "tiktok" | "instagram" | "youtube"
  platforms?: string[];

  // Filter rentang tanggal berdasarkan createdAt (AND)
  dateFrom?: string;
  dateTo?: string;

  // Sorting — Default: createdAt desc (views tidak tersedia untuk video)
  sortOrder?: "asc" | "desc";

  // Paginasi berbasis halaman
  page?: number;
  limit?: number;
}

// ─── Response ─────────────────────────────────────────────────────────────────

/** Metadata paginasi yang dikembalikan oleh semua endpoint search */
export interface SearchMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
}

/** Response standar untuk pencarian artikel */
export interface ArticleSearchResult {
  success: true;
  data: ArticleListResponse[];
  meta: SearchMeta;
}

/** Item video dari collection video_section */
export interface VideoItem {
  _id: string;
  title: string;
  type: "tiktok" | "instagram" | "youtube";
  url: string;
  embedId?: string;
  thumbnailUrl?: string;
  createdAt: Date;
}

/** Response standar untuk pencarian video */
export interface VideoSearchResult {
  success: true;
  data: VideoItem[];
  meta: SearchMeta;
}

// ─── Legacy (backward compat) ─────────────────────────────────────────────────
// Dipertahankan agar tidak merusak komponen lain yang masih menggunakan tipe lama

/** @deprecated Gunakan ArticleSearchParams */
export interface SearchPayload {
  search?: string;
  categoryId?: string;
  dateRange?: { from: string; to: string };
  tags?: string[];
  sortBy?: "name" | "date" | "views";
  sortOrder?: "asc" | "desc";
  cursor?: string;
  page?: number;
  pageSize?: number;
  limit?: number;
}

/** @deprecated Gunakan ArticleSearchResult */
export interface SearchResult {
  articles: ArticleListResponse[];
  pagination: {
    total: number;
    limit: number;
    page?: number;
    totalPages?: number;
    cursor?: string;
    hasNextPage: boolean;
  };
}
