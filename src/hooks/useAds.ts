import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/axios";
import { AxiosError } from "axios";
import {
  AdsPosition,
  AdsSingleArticlePlacement,
  adsHomepageEffectiveSpan,
  type HomepageAdItem,
  type HomepageAdsGrouped,
  type SingleArticleAdItem,
} from "@/types/ads";

// ─── Konstanta ─────────────────────────────────────────────────────────────────

const STALE_TIME_MS = 1000 * 60 * 5; // 5 menit

// ─── Tipe API respons ─────────────────────────────────────────────────────────

interface HomepageAdsApiResponse {
  success: boolean;
  ads: RawHomepageAdItem[];
  total: number;
  page: number;
  limit: number;
}

/** Respons GET `/api/ads/single-article`. */
interface ArticleAdsApiResponse {
  success: boolean;
  ads: RawSingleArticleAdItem[];
  total: number;
  page: number;
  limit: number;
}

interface RawSingleArticleAdItem {
  _id: string;
  name?: string;
  placement?: string;
  linkUrl?: string;
  order?: number;
  banner?: {
    url?: string;
    filename?: string;
    mimetype?: string;
    size?: number;
  };
  categories?: Array<{ _id?: unknown; slug?: string }>;
  startedAt?: string;
  endedAt?: string;
  isActive?: boolean;
  clicks?: number;
  variant?: string;
  span?: number;
}

/**
 * Shape mentah yang dikembalikan JSON dari `/api/ads/homepage`.
 * `startedAt`/`endedAt` sudah menjadi ISO string setelah JSON serialization.
 * `banner` adalah satu objek (bukan array) sesuai skema DB.
 */
interface RawHomepageAdItem {
  _id: string;
  name: string;
  position: string;
  span?: number;
  linkUrl: string;
  order: number;
  banner: {
    url: string;
    filename: string;
    mimetype: string;
    size: number;
  };
  startedAt: string;
  endedAt: string;
  isActive: boolean;
  clicks: number;
}

// ─── Normalisasi & validasi ───────────────────────────────────────────────────

/** Set nilai AdsPosition yang valid untuk runtime validation. */
const VALID_POSITIONS = new Set<string>(Object.values(AdsPosition));

function isValidPosition(value: string): value is AdsPosition {
  return VALID_POSITIONS.has(value);
}

/**
 * Normalisasi satu item mentah dari API ke `HomepageAdItem`.
 * - Position yang tidak dikenal dibuang (return null).
 * - `span` dinormalisasi via `adsHomepageEffectiveSpan`.
 * - `banner` divalidasi: harus memiliki `url` string non-kosong.
 */
function normalizeAdItem(raw: RawHomepageAdItem): HomepageAdItem | null {
  if (!isValidPosition(raw.position)) return null;
  if (typeof raw.banner?.url !== "string" || !raw.banner.url) return null;

  const position = raw.position;
  const span = adsHomepageEffectiveSpan(position, raw.span);

  return {
    _id: raw._id,
    name: typeof raw.name === "string" ? raw.name : "",
    position,
    span,
    linkUrl: typeof raw.linkUrl === "string" ? raw.linkUrl : "",
    order: typeof raw.order === "number" ? raw.order : 0,
    banner: {
      url: raw.banner.url,
      filename: raw.banner.filename ?? "",
      mimetype: raw.banner.mimetype ?? "",
      size: raw.banner.size ?? 0,
    },
    startedAt: raw.startedAt,
    endedAt: raw.endedAt,
    isActive: Boolean(raw.isActive),
    clicks: typeof raw.clicks === "number" ? raw.clicks : 0,
  };
}

// ─── Fetcher ──────────────────────────────────────────────────────────────────

/**
 * Ambil semua iklan homepage dari API dengan filter:
 * - `isActive: true`
 * - `filterByDate: true` → startedAt ≤ now ≤ endedAt
 * - Semua posisi (tanpa filter posisi)
 */
async function fetchAllHomepageAds(): Promise<HomepageAdItem[]> {
  try {
    const { data } = await api.get<HomepageAdsApiResponse>("/ads/homepage", {
      params: {
        isActive: "true",
        filterByDate: "true",
        limit: 200,
        page: 1,
      },
    });

    if (!data.success || !Array.isArray(data.ads)) {
      throw new Error("Respons API tidak valid");
    }

    return data.ads
      .map(normalizeAdItem)
      .filter((item): item is HomepageAdItem => item !== null);
  } catch (error) {
    if (error instanceof AxiosError) {
      const body = error.response?.data as { error?: string } | undefined;
      throw new Error(body?.error ?? "Gagal mengambil data iklan homepage");
    }
    throw error;
  }
}

// ─── Single article ads (halaman detail berita) ───────────────────────────────

const VALID_ARTICLE_PLACEMENTS = new Set<string>(
  Object.values(AdsSingleArticlePlacement),
);

function isValidArticlePlacement(
  value: string,
): value is AdsSingleArticlePlacement {
  return VALID_ARTICLE_PLACEMENTS.has(value);
}

function normalizeSingleArticleAdItem(
  raw: RawSingleArticleAdItem,
): SingleArticleAdItem | null {
  if (
    !raw.placement ||
    !isValidArticlePlacement(raw.placement) ||
    typeof raw.banner?.url !== "string" ||
    !raw.banner.url
  ) {
    return null;
  }

  const categories =
    Array.isArray(raw.categories) && raw.categories.length > 0
      ? raw.categories.map((c) => ({
          _id:
            c._id !== undefined && c._id !== null ? String(c._id) : "",
          slug: typeof c.slug === "string" ? c.slug : "",
        }))
      : [];

  const spanRaw = raw.span;
  const span =
    spanRaw === 1 || spanRaw === 2 ? (spanRaw as 1 | 2) : undefined;

  return {
    _id: raw._id,
    categories,
    placement: raw.placement,
    variant: raw.variant,
    span,
    name: typeof raw.name === "string" ? raw.name : "",
    banner: {
      url: raw.banner.url,
      filename: raw.banner.filename ?? "",
      mimetype: raw.banner.mimetype ?? "",
      size: raw.banner.size ?? 0,
    },
    linkUrl: typeof raw.linkUrl === "string" ? raw.linkUrl : "",
    order: typeof raw.order === "number" ? raw.order : 0,
    isActive: Boolean(raw.isActive),
    startedAt:
      typeof raw.startedAt === "string" ? raw.startedAt : String(raw.startedAt),
    endedAt: typeof raw.endedAt === "string" ? raw.endedAt : String(raw.endedAt),
    clicks: typeof raw.clicks === "number" ? raw.clicks : 0,
  };
}

async function fetchArticleAdsForPlacement(
  placement: AdsSingleArticlePlacement,
  categorySlug?: string,
  categoryId?: string,
): Promise<SingleArticleAdItem[]> {
  const params: Record<string, string | number> = {
    isActive: "true",
    filterByDate: "true",
    limit: 50,
    page: 1,
    placement,
  };
  const slug = categorySlug?.trim();
  const id = categoryId?.trim();
  if (slug) params.categorySlug = slug;
  if (id) params.categoryId = id;

  if (!slug && !id) {
    throw new Error("categorySlug atau categoryId wajib untuk iklan artikel");
  }

  try {
    const { data } = await api.get<ArticleAdsApiResponse>(
      "/ads/single-article",
      { params },
    );

    if (!data.success || !Array.isArray(data.ads)) {
      throw new Error("Respons API iklan artikel tidak valid");
    }

    return data.ads
      .map(normalizeSingleArticleAdItem)
      .filter((item): item is SingleArticleAdItem => item !== null)
      .sort((a, b) => a.order - b.order);
  } catch (error) {
    if (error instanceof AxiosError) {
      const body = error.response?.data as { error?: string } | undefined;
      throw new Error(body?.error ?? "Gagal mengambil iklan artikel");
    }
    throw error;
  }
}

export interface ArticlePageAdsData {
  vertical: SingleArticleAdItem[];
  horizontal: SingleArticleAdItem[];
}

/**
 * Iklan halaman artikel untuk satu kategori (slug dan/atau id dari artikel).
 * Ambil vertikal + horizontal paralel, aktif & dalam rentang tanggal.
 */
export function useArticlePageAds(params: {
  categorySlug?: string;
  categoryId?: string;
  enabled?: boolean;
}) {
  const { categorySlug, categoryId, enabled = true } = params;
  const slug = categorySlug?.trim();
  const id =
    categoryId !== undefined && categoryId !== null
      ? String(categoryId).trim()
      : "";

  const shouldRun =
    enabled && (Boolean(slug) || Boolean(id));

  return useQuery<ArticlePageAdsData, Error>({
    queryKey: ["article-page-ads", slug ?? "", id],
    queryFn: async () => {
      const [vertical, horizontal] = await Promise.all([
        fetchArticleAdsForPlacement(
          AdsSingleArticlePlacement.VERTICAL,
          slug,
          id || undefined,
        ),
        fetchArticleAdsForPlacement(
          AdsSingleArticlePlacement.HORIZONTAL,
          slug,
          id || undefined,
        ),
      ]);
      return { vertical, horizontal };
    },
    staleTime: STALE_TIME_MS,
    retry: 2,
    refetchOnWindowFocus: false,
    enabled: shouldRun,
  });
}

/** Petakan `SingleArticleAdItem` ke bentuk yang dipakai `AdsCarousel` (`HomepageAdItem`). */
export function singleArticleAdToCarouselItem(
  ad: SingleArticleAdItem,
): HomepageAdItem {
  return {
    _id: ad._id,
    name: ad.name,
    position: AdsPosition.HEADLINE,
    span: adsHomepageEffectiveSpan(AdsPosition.HEADLINE, ad.span),
    linkUrl: ad.linkUrl,
    order: ad.order,
    banner: ad.banner,
    startedAt: ad.startedAt,
    endedAt: ad.endedAt,
    isActive: ad.isActive,
    clicks: ad.clicks,
  };
}

// ─── Grouping ─────────────────────────────────────────────────────────────────

/** Buat objek `HomepageAdsGrouped` dengan array kosong untuk setiap posisi. */
function createEmptyGrouped(): HomepageAdsGrouped {
  return Object.values(AdsPosition).reduce((acc, pos) => {
    acc[pos] = [];
    return acc;
  }, {} as HomepageAdsGrouped);
}

/**
 * Kelompokkan `HomepageAdItem[]` per `AdsPosition`, diurutkan `order ASC`.
 */
function groupAdsByPosition(ads: HomepageAdItem[]): HomepageAdsGrouped {
  const grouped = createEmptyGrouped();

  for (const ad of ads) {
    grouped[ad.position].push(ad);
  }

  for (const pos of Object.values(AdsPosition)) {
    grouped[pos].sort((a, b) => a.order - b.order);
  }

  return grouped;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

/**
 * React Query: semua iklan homepage aktif dalam rentang tanggal,
 * dikelompokkan per `AdsPosition`.
 *
 * Data di-cache 5 menit dan tidak di-refetch saat window focus.
 */
export function useHomepageAds() {
  return useQuery<HomepageAdsGrouped, Error>({
    queryKey: ["homepage-ads-grouped"],
    queryFn: async () => {
      const ads = await fetchAllHomepageAds();
      return groupAdsByPosition(ads);
    },
    staleTime: STALE_TIME_MS,
    retry: 2,
    refetchOnWindowFocus: false,
  });
}

/**
 * Backward-compatible: mengembalikan hanya iklan posisi `headline`.
 * Digunakan oleh `SnapWrapper` / `HeadlineSlider`.
 */
export function useHeadlineAds() {
  const { data, ...rest } = useHomepageAds();
  return { data: data?.[AdsPosition.HEADLINE], ...rest };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Hook turunan: seluruh data iklan homepage sudah terbagi per posisi.
 * Gunakan ini di halaman publik untuk mengakses semua slot iklan sekaligus.
 */
export function useHomepageAdsGrouped() {
  const { data, isLoading, isError, error } = useHomepageAds();

  const grouped = useMemo(() => data ?? createEmptyGrouped(), [data]);

  const headlineAds = grouped[AdsPosition.HEADLINE];
  const tiktokAds = grouped[AdsPosition.TIKTOK];
  const youtubeAds = grouped[AdsPosition.YOUTUBE];
  const reelsAds = grouped[AdsPosition.REELS];
  const popularAds = grouped[AdsPosition.POPULAR];
  const photographyAds = grouped[AdsPosition.PHOTOGRAPHY];
  const editorChoiceAds = grouped[AdsPosition.EDITOR_CHOICE];
  const featuredAds = grouped[AdsPosition.FEATURED];
  const horizontalFeaturedAds = grouped[AdsPosition.HORIZONTAL_FEATURED];

  return {
    isLoading,
    isError,
    error,
    headlineAds,
    tiktokAds,
    youtubeAds,
    reelsAds,
    popularAds,
    photographyAds,
    editorChoiceAds,
    featuredAds,
    horizontalFeaturedAds,
  };
}

// ─── Ads History Types & Hooks ──────────────────────────────────────────────

export interface AdsHistoryItem {
  _id: string;
  name: string;
  type: "homepage" | "article";
  positionOrPlacement: string;
  startedAt: string;
  endedAt: string;
  deletedAt: string | null;
  status: "habis masa pakai" | "taken down";
  clicks: number;
  bannerUrl: string;
}

interface AdsHistoryApiResponse {
  success: boolean;
  history: AdsHistoryItem[];
}

/**
 * useAdsHistory
 * Mengambil histori data iklan terpadu (baik homepage maupun single article) yang sudah selesai
 * atau telah dihapus (soft-delete), dengan kalkulasi status habis masa pakai vs taken down.
 */
export function useAdsHistory({
  enabled = true,
}: {
  enabled?: boolean;
} = {}) {
  return useQuery({
    queryKey: ["adsHistory"],
    queryFn: async () => {
      const response = await api.get<AdsHistoryApiResponse>("/ads/history");
      return response.data;
    },
    enabled,
    staleTime: STALE_TIME_MS,
    retry: 2,
    refetchOnWindowFocus: false,
  });
}

// ─── AE Dashboard Stats ───────────────────────────────────────────────────────

export type {
  AEDashboardData,
  AEDashboardStats,
} from "@/types/analytics/aeDashboard";

export {
  useAEDashboard,
  useAEDashboardStats,
} from "@/hooks/useDashboardAnalytics";

