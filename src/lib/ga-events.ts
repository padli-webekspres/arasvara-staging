/**
 * GA4 centralized event tracking — Fase 3 & 4.
 *
 * Semua event dikirim via browser `window.gtag`.
 * Guard `isGaEnabled()` memastikan tidak ada error saat gtag belum siap atau di SSR.
 *
 * Fase 3: select_content, article_share, search
 * Fase 4: ad_impression, ad_click (GA), push_open, author_profile_view
 *
 * CATATAN: `trackGaAdClick` (di file ini, GA4) berbeda dari `trackAdClick`
 * di `src/lib/trackAdClick.ts` yang mencatat klik ke MongoDB.
 */

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

function isGaReady(): boolean {
  return typeof window !== "undefined" && typeof window.gtag === "function";
}

// ─── Fase 3 ───────────────────────────────────────────────────────────────────

/**
 * Klik pada kartu/headline artikel — menggantikan event GA4 standar `select_content`.
 *
 * Dikirim dari: HeroCard, SecondaryNewsCard, NewsCard, SidebarArticleItem.
 *
 * `click_location` values: "homepage_headline" | "homepage_card" |
 *   "category_listing" | "sidebar" | "related" | "search_result"
 */
export function trackSelectContent(params: {
  article_id: string;
  article_slug: string;
  article_title: string;
  category_name: string;
  click_location: string;
  position?: number;
}): void {
  if (!isGaReady()) return;
  window.gtag!("event", "select_content", {
    content_type: "article",
    item_id: params.article_id,
    article_id: params.article_id,
    article_slug: params.article_slug,
    article_title: params.article_title,
    category_name: params.category_name,
    click_location: params.click_location,
    ...(params.position !== undefined ? { position: params.position } : {}),
  });
}

/**
 * Klik tombol share artikel.
 *
 * `share_method` values: "facebook" | "x" | "linkedin" | "whatsapp" | "telegram" | "copy_link"
 */
export function trackArticleShare(params: {
  article_id: string;
  article_slug: string;
  article_title: string;
  category_name: string;
  share_method: string;
}): void {
  if (!isGaReady()) return;
  window.gtag!("event", "article_share", params);
}

/**
 * Submit site search.
 * Dikirim dari: SearchClient setelah results diterima dari API.
 */
export function trackSearch(params: {
  search_term: string;
  results_count: number;
}): void {
  if (!isGaReady()) return;
  window.gtag!("event", "search", params);
}

// ─── Fase 4 ───────────────────────────────────────────────────────────────────

/**
 * Banner iklan masuk viewport.
 *
 * Dikirim dari: AdsCarousel, SidebarSingleArticle (via useAdImpressionTracking).
 * `ad_position` = enum AdsPosition string atau "article_vertical" / "article_horizontal".
 */
export function trackAdImpression(params: {
  ad_id: string;
  ad_position: string;
  ad_size: string;
  ad_sponsor: string;
  page_location: string;
}): void {
  if (!isGaReady()) return;
  window.gtag!("event", "ad_impression", params);
}

/**
 * Klik pada banner iklan — GA4 side.
 *
 * Dipanggil bersamaan dengan `trackAdClick` (MongoDB) dari trackAdClick.ts.
 * Nama berbeda untuk menghindari konflik import.
 */
export function trackGaAdClick(params: {
  ad_id: string;
  ad_position: string;
  ad_size: string;
  ad_sponsor: string;
  ad_destination_url: string;
}): void {
  if (!isGaReady()) return;
  window.gtag!("event", "ad_click", params);
}

/**
 * Artikel dibuka via push notification (URL memiliki ?ref=push).
 * Dikirim sekali per artikel per sesi.
 */
export function trackPushOpen(params: {
  notification_id: string;
  notification_title: string;
  article_id: string;
  category_name: string;
}): void {
  if (!isGaReady()) return;
  window.gtag!("event", "push_open", params);
}

/**
 * Halaman profil penulis dikunjungi.
 * Dikirim dari: AuthorClient pada mount.
 */
export function trackAuthorProfileView(params: {
  author_id: string;
  author_slug: string;
  author_name: string;
}): void {
  if (!isGaReady()) return;
  window.gtag!("event", "author_profile_view", params);
}
