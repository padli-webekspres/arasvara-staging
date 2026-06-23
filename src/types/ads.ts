// ─── Core enums ──────────────────────────────────────────────────────────────

import { ObjectId } from "mongodb";

export enum AdsVariant {
  HORIZONTAL_LONG = "horizontalLong",
  HORIZONTAL = "horizontal",
  POTRAIT = "potrait",
  SQUARE = "square",
}

/**
 * Carousel headline (admin): satu gambar per slot, rasio iklan billboard.
 * Untuk API/backend gunakan `AdsVariant.HORIZONTAL` pada satu elemen `banner`.
 */
export const HEADLINE_CAROUSEL_BANNER_WIDTH = 728;
export const HEADLINE_CAROUSEL_BANNER_HEIGHT = 90;
export const HEADLINE_CAROUSEL_BANNER_ASPECT = "728×90" as const;

/** Metadata slot carousel headline tanpa file banner (payload persist JSON). */
export interface HeadlineCarouselAdSlotMeta {
  _id: string;
  name: string;
  linkUrl: string;
  order: number;
  startedAt: string;
  endedAt: string;
}

export enum AdsPosition {
  HEADLINE = "headline",
  TIKTOK = "tiktok",
  YOUTUBE = "youtube",
  REELS = "reels",
  POPULAR = "popular",
  PHOTOGRAPHY = "photography",
  EDITOR_CHOICE = "editor_choice",
  FEATURED = "featured",
  HORIZONTAL_FEATURED = "horizontal_featured",
}

/**
 * Posisi yang punya kolom `span` (1 atau 2) di admin & dokumen DB.
 * Posisi lain menyimpan span efektif = 1.
 */
export const ADS_HOMEPAGE_SPAN_ELIGIBLE_POSITIONS: readonly AdsPosition[] = [
  AdsPosition.TIKTOK,
  AdsPosition.YOUTUBE,
  AdsPosition.REELS,
  AdsPosition.POPULAR,
  AdsPosition.PHOTOGRAPHY,
  AdsPosition.EDITOR_CHOICE,
] as const;

const ADS_HOMEPAGE_SPAN_ELIGIBLE_SET = new Set<AdsPosition>(
  ADS_HOMEPAGE_SPAN_ELIGIBLE_POSITIONS,
);

export function adsHomepageSupportsSpan(position: AdsPosition): boolean {
  return ADS_HOMEPAGE_SPAN_ELIGIBLE_SET.has(position);
}

/** Normalisasi span untuk penyimpanan: non-eligible → selalu 1; lainnya 1 | 2. */
export function adsHomepageEffectiveSpan(
  position: AdsPosition,
  span?: number,
): 1 | 2 {
  if (!adsHomepageSupportsSpan(position)) return 1;
  return span === 2 ? 2 : 1;
}

/** Urutan section panel kiri di halaman admin iklan homepage. */
export const ADS_HOMEPAGE_SECTION_ORDER: readonly AdsPosition[] = [
  AdsPosition.HEADLINE,
  AdsPosition.TIKTOK,
  AdsPosition.YOUTUBE,
  AdsPosition.REELS,
  AdsPosition.POPULAR,
  AdsPosition.PHOTOGRAPHY,
  AdsPosition.EDITOR_CHOICE,
] as const;

/** Label tampilan untuk dropdown / heading section. */
export function adsHomepagePositionLabel(position: AdsPosition): string {
  const map: Record<AdsPosition, string> = {
    [AdsPosition.HEADLINE]: "Headline",
    [AdsPosition.TIKTOK]: "TikTok",
    [AdsPosition.YOUTUBE]: "YouTube",
    [AdsPosition.REELS]: "Reels",
    [AdsPosition.POPULAR]: "Terpopuler",
    [AdsPosition.PHOTOGRAPHY]: "Fotografi",
    [AdsPosition.EDITOR_CHOICE]: "Pilihan Editor",
    [AdsPosition.FEATURED]: "Featured",
    [AdsPosition.HORIZONTAL_FEATURED]: "Featured Horizontal",
  };
  return map[position];
}

/** Spesifikasi crop & preview banner generik (dipakai homepage & single article). */
export interface AdsBannerCropSpec {
  /** Rasio lebar ÷ tinggi untuk CropImageModal. */
  aspect: number;
  label: string;
  previewAspectClass: string;
}

/** Alias untuk backward-compatibility — identik dengan `AdsBannerCropSpec`. */
export type AdsHomepageBannerCropSpec = AdsBannerCropSpec;

function homepageCropSpec(
  aspect: number,
  label: string,
  previewAspectClass: string,
): AdsBannerCropSpec {
  return { aspect, label, previewAspectClass };
}

export function adsHomepageBannerCropSpec(
  position: AdsPosition,
  span: 1 | 2 = 1,
): AdsBannerCropSpec {
  switch (position) {
    case AdsPosition.HEADLINE:
      return homepageCropSpec(728 / 90, "728×90", "aspect-[728/90]");
    case AdsPosition.TIKTOK:
    case AdsPosition.REELS:
      if (span === 2) {
        return homepageCropSpec(9 / 8, "9:8", "aspect-[9/8]");
      }
      return homepageCropSpec(9 / 16, "9:16", "aspect-[9/16]");
    case AdsPosition.YOUTUBE:
      if (span === 2) {
        return homepageCropSpec(32 / 9, "32:9", "aspect-[32/9]");
      }
      return homepageCropSpec(16 / 9, "16:9", "aspect-video");
    case AdsPosition.PHOTOGRAPHY:
      if (span === 2) {
        return homepageCropSpec(8 / 5, "8:5", "aspect-[8/5]");
      }
      return homepageCropSpec(4 / 5, "4:5", "aspect-[4/5]");
    case AdsPosition.POPULAR:
    case AdsPosition.EDITOR_CHOICE:
      if (span === 2) {
        return homepageCropSpec(2, "2:1", "aspect-[2/1]");
      }
      return homepageCropSpec(1, "1:1", "aspect-square");
    case AdsPosition.FEATURED:
      return homepageCropSpec(9 / 16, "9:16", "aspect-[9/16]");
    case AdsPosition.HORIZONTAL_FEATURED:
      return homepageCropSpec(3 / 2, "3:2", "aspect-[3/2]");
    default:
      return homepageCropSpec(728 / 90, "728×90", "aspect-[728/90]");
  }
}

// ─── Core interfaces ──────────────────────────────────────────────────────────

export interface AdsBanner {
  url: string;
  filename: string;
  mimetype: string;
  size: number;
  variant: AdsVariant;
}

/** File banner tanpa `variant` (homepage menyimpan variant di level dokumen). */
export type AdsBannerFileFields = Omit<AdsBanner, "variant">;

export interface CreateAdsPayload {
  name: string;
  span?: number;
  /** Carousel headline: biasanya satu elemen (728×90, variant `HORIZONTAL`). */
  banner: AdsBanner[];
  linkUrl: string;
  position: AdsPosition;
  variant?: AdsVariant;
  order?: number;
  startedAt: string | Date;
  endedAt: string | Date;
}

/** Rekaman iklan di database / API. */
export interface Ads extends CreateAdsPayload {
  _id: string | ObjectId;
  isActive?: boolean;
  clicks?: number;
  createdAt: string | Date;
  updatedAt: string | Date;
  deletedAt: string | Date | null;
}

// ─── Homepage service types ───────────────────────────────────────────────────

/** Role yang boleh mengelola iklan homepage lewat API admin. */
export const ADS_HOMEPAGE_ADMIN_ROLES = [
  "admin",
  "editor-in-chief",
  "managing-editor",
] as const;

/** Payload untuk membuat satu dokumen iklan (satu banner per dokumen). */
export interface CreateAdsHomepagePayload {
  /** Nama internal / label slot iklan (admin). */
  name: string;
  variant?: string;
  span?: number;
  /** Satu banner per dokumen (variant disimpan di level dokumen, bukan di banner). */
  banner: AdsBannerFileFields;
  linkUrl: string;
  position: string;
  order?: number;
  startedAt: string | Date;
  endedAt: string | Date;
  isActive?: boolean;
  clicks?: number;
}

export interface AdsHomepagePresignResponse {
  uploadUrl: string;
  fileKey: string;
  expiresIn: number;
}

export interface AdsHomepageFinalizeResponse {
  fileKey: string;
  banner: AdsBannerFileFields;
}

export interface AdsHomepagePresignRequestBody {
  action: "presign";
  filename: string;
  contentType: string;
}

export interface AdsHomepageFinalizeRequestBody {
  action: "finalize";
  fileKey: string;
}

export type AdsHomepageMediaPostBody =
  | AdsHomepagePresignRequestBody
  | AdsHomepageFinalizeRequestBody;

// ─── Bulk upsert types ───────────────────────────────────────────────────────

/**
 * Satu item dalam payload bulk-upsert iklan homepage.
 * Jika `serverId` diisi → update dokumen yang sudah ada.
 * Jika `serverId` kosong → insert dokumen baru.
 */
export interface BulkUpsertAdsItem {
  /** MongoDB _id dari dokumen yang sudah ada (opsional untuk item baru). */
  serverId?: string;
  name: string;
  banner: AdsBannerFileFields;
  linkUrl: string;
  order: number;
  startedAt: string | Date;
  endedAt: string | Date;
  variant?: string;
  span?: number;
  isActive?: boolean;
}

export interface BulkUpsertAdsPayload {
  position: string;
  items: BulkUpsertAdsItem[];
}

// ─── Single article ads types ────────────────────────────────────────────────

/** Slot di halaman artikel: satu vertikal vs beberapa horizontal (carousel). */
export enum AdsSingleArticlePlacement {
  VERTICAL = "vertical",
  HORIZONTAL = "horizontal",
}

/** Urutan seksi di panel admin single article. */
export const ADS_SINGLE_ARTICLE_SECTION_ORDER = [
  AdsSingleArticlePlacement.VERTICAL,
  AdsSingleArticlePlacement.HORIZONTAL,
] as const;

export function adsSingleArticlePlacementLabel(
  p: AdsSingleArticlePlacement,
): string {
  const map: Record<AdsSingleArticlePlacement, string> = {
    [AdsSingleArticlePlacement.VERTICAL]: "Vertikal (Sidebar)",
    [AdsSingleArticlePlacement.HORIZONTAL]: "Horizontal (Carousel)",
  };
  return map[p] ?? p;
}

/**
 * Spesifikasi crop banner per placement article.
 * - VERTICAL  = 9:16 (portrait sidebar)
 * - HORIZONTAL = 16:9 (landscape carousel)
 */
export function adsSingleArticleBannerCropSpec(
  p: AdsSingleArticlePlacement,
): AdsBannerCropSpec {
  if (p === AdsSingleArticlePlacement.VERTICAL) {
    return {
      aspect: 9 / 16,
      label: "9:16",
      previewAspectClass: "aspect-[9/16]",
    };
  }
  return {
    aspect: 728 / 90,
    label: "728×90",
    previewAspectClass: "aspect-[728/90]",
  };
}

/** Kolom audit seperti koleksi `ads_homepage`. */
export interface AdsMongoTimestamps {
  createdAt: string | Date;
  updatedAt: string | Date;
  deletedAt: string | Date | null;
}

/**
 * Referensi kategori yang dilampirkan ke satu dokumen iklan artikel.
 * Satu iklan bisa berlaku untuk banyak kategori sekaligus.
 */
export interface AdsArticleCategory {
  _id: string | ObjectId;
  slug: string;
}

/**
 * Satu dokumen koleksi `ads_article`.
 * - `placement: vertical` → maksimal satu aktif ditampilkan di halaman artikel.
 * - `placement: horizontal` → banyak dokumen dengan `order` membentuk carousel.
 * - `categories` → array kategori yang menerima iklan ini.
 */
export interface AdsSingleArticleDocument extends AdsMongoTimestamps {
  _id: string | ObjectId;
  name: string;
  variant?: AdsVariant | string;
  span?: 1 | 2;
  banner: AdsBannerFileFields;
  linkUrl: string;
  categories: AdsArticleCategory[];
  placement: AdsSingleArticlePlacement;
  order: number;
  isActive: boolean;
  startedAt: string | Date;
  endedAt: string | Date;
  clicks: number;
}

/**
 * Bentuk JSON API publik (tanggal string), dipakai komponen UI.
 * Selaras strukturnya dengan `HomepageAdItem`.
 */
export interface SingleArticleAdItem {
  _id: string;
  categories: AdsArticleCategory[];
  placement: AdsSingleArticlePlacement;
  variant?: AdsVariant | string;
  span?: 1 | 2;
  name: string;
  banner: AdsBannerFileFields;
  linkUrl: string;
  order: number;
  isActive: boolean;
  startedAt: string;
  endedAt: string;
  clicks: number;
}

/** Respons per kategori untuk halaman publik artikel. */
export interface SingleArticleAdsGrouped {
  /** Satu iklan vertikal (sidebar) — null jika tidak ada yang aktif. */
  vertical: SingleArticleAdItem | null;
  /** Daftar iklan horizontal (carousel), diurutkan `order ASC`. */
  horizontal: SingleArticleAdItem[];
}

/** Narrowing placement untuk type-safety di UI. */
export type AdsSingleArticleVertical = SingleArticleAdItem & {
  placement: AdsSingleArticlePlacement.VERTICAL;
};

export type AdsSingleArticleHorizontal = SingleArticleAdItem & {
  placement: AdsSingleArticlePlacement.HORIZONTAL;
};

// ─── Bulk upsert article ads ─────────────────────────────────────────────────

/**
 * Satu item dalam payload bulk-upsert `ads_article`.
 * `serverId` berisi → update dokumen yang ada; tanpa `serverId` → insert baru.
 */
export interface BulkUpsertAdsArticleItem {
  serverId?: string;
  name: string;
  banner: AdsBannerFileFields;
  linkUrl: string;
  order: number;
  startedAt: string | Date;
  endedAt: string | Date;
  variant?: string;
  span?: 1 | 2;
  isActive?: boolean;
}

/**
 * Payload bulk-upsert `ads_article`.
 * Scope operasi ditentukan oleh kombinasi `categories` + `placement`:
 * semua dokumen yang cocok scope tersebut akan di-sync (upsert / soft-delete).
 */
export interface BulkUpsertAdsArticlePayload {
  /** Wajib minimal 1. */
  categories: AdsArticleCategory[];
  placement: AdsSingleArticlePlacement;
  items: BulkUpsertAdsArticleItem[];
}

/** Payload untuk membuat satu dokumen `ads_article` baru. */
export interface CreateAdsArticlePayload {
  name: string;
  categories: AdsArticleCategory[];
  placement: AdsSingleArticlePlacement;
  banner: AdsBannerFileFields;
  linkUrl: string;
  order?: number;
  variant?: string;
  span?: 1 | 2;
  startedAt: string | Date;
  endedAt: string | Date;
  isActive?: boolean;
}

/** Opsi query untuk `AdsSingleArticleService.getArticleAds`. */
export interface GetArticleAdsOptions {
  /** Filter berdasarkan slug kategori artikel yang sedang dibuka (case-insensitive). */
  categorySlug?: string;
  /**
   * Beberapa slug — dokumen cocok jika salah satu slug ada di `categories`.
   * Digabung dengan `categorySlug` (dideduplikasi).
   */
  categorySlugs?: string[];
  /**
   * Cocokkan juga `_id` kategori di array `categories` (Mongo ObjectId atau string).
   * Berguna jika slug tidak sama persis dengan yang ada di dokumen iklan.
   */
  categoryId?: string;
  placement?: AdsSingleArticlePlacement;
  /** Default: true (hanya aktif). */
  isActive?: boolean;
  /** Default: false (tidak sertakan soft-deleted). */
  includeDeleted?: boolean;
  /**
   * Saat `true`, hanya mengembalikan iklan aktif pada saat ini:
   * `startedAt ≤ now ≤ endedAt`.
   */
  filterByDate?: boolean;
  page?: number;
  limit?: number;
}

// ─── Carousel UI types ────────────────────────────────────────────────────────

export enum AdsCarouselVariant {
  SQUARE = "square",
  VERTICAL = "vertical",
  VERTICAL_LONG = "vertical_long",
  HORIZONTAL = "horizontal",
  HORIZONTAL_LONG = "horizontal_long",
}

export interface AdsCarouselItem {
  id: string | number;
  alt?: string;
  src?: string;
  link?: string;
}

export interface AdsCarouselProps {
  ads: HomepageAdItem[];
  variant: AdsCarouselVariant;
  className?: string;
  autoplay?: boolean;
}

// ─── Homepage public API types ────────────────────────────────────────────────

/**
 * Shape satu dokumen iklan yang dikembalikan GET /api/ads/homepage.
 * `banner` adalah satu objek (bukan array), sesuai skema DB.
 * `span` sudah dinormalisasi ke 1 | 2 oleh hook.
 */
export interface HomepageAdItem {
  _id: string;
  name: string;
  position: AdsPosition;
  span: 1 | 2;
  linkUrl: string;
  order: number;
  banner: AdsBannerFileFields;
  startedAt: string;
  endedAt: string;
  isActive: boolean;
  clicks: number;
}

/** Iklan homepage yang sudah dikelompokkan per `AdsPosition` oleh `useHomepageAds`. */
export type HomepageAdsGrouped = Record<AdsPosition, HomepageAdItem[]>;

// ─── Card UI types ────────────────────────────────────────────────────────────

export enum AdsCardVariant {
  NEWS = "news",
  VIDEO = "video",
  FEATURED = "featured",
}

export enum AdsCardSpan {
  SINGLE = "single",
  WIDE = "wide",
}

export const ADS_CARD_DEFAULT_BANNER = "/ads-banner/Banner-728x90.png";

export interface AdsCardProps {
  variant?: AdsCardVariant;
  /** Enum preset atau nilai numerik 1 | 2 dari carousel. */
  span?: AdsCardSpan | 1 | 2;
  /** Posisi slot homepage — menentukan rasio kartu VIDEO (TikTok/Reels/YouTube). */
  position?: AdsPosition;
  bannerUrl?: string;
  className?: string;
  alt?: string;
}
