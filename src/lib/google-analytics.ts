import { Article, Tag } from "@/types/article";

/**
 * Parameter event view_article batch 1 — harus selaras dengan Custom Dimensions
 * dan Custom Metrics yang terdaftar di GA4 Admin (property staging maupun production).
 *
 * Perubahan dari skema lama:
 * - `tag_names` (CSV) dihapus → diganti `tag_1`, `tag_2`, `tag_3`
 * - Tambah: article_age_days, word_count, publish_hour, publish_day_of_week,
 *            has_video, has_gallery, user_type, referrer_type, session_source
 * - Tambah atribusi editor: editor_id, editor_name, editor_slug
 */
export type ArticleGaPayload = {
  article_id: string;
  article_slug: string;
  article_title: string;
  author_id: string;
  author_name: string;
  editor_id: string;
  editor_name: string;
  editor_slug: string;
  category_id: string;
  category_name: string;
  category_slug: string;
  article_format: string;
  tag_1: string;
  tag_2: string;
  tag_3: string;
  is_breaking: string;
  is_headline: string;
  content_page: string;
  has_video: string;
  has_gallery: string;
  publish_day_of_week: string;
  user_type: string;
  referrer_type: string;
  session_source: string;
  page_path: string;
  page_location: string;
  page_title: string;
  /** Custom metrics (numerik) */
  article_age_days: number;
  word_count: number;
  publish_hour: number;
};

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

/** Route yang tidak perlu dikirim ke GA4 (admin & auth). */
export const GA_EXCLUDED_PATH_PREFIXES = ["/admin-xyz", "/login"] as const;

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

const DAY_NAMES_ID = [
  "Minggu",
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
] as const;

const SEARCH_ENGINES = [
  "google",
  "bing",
  "yahoo",
  "duckduckgo",
  "yandex",
  "baidu",
  "ecosia",
];

const SOCIAL_DOMAINS = [
  "facebook.com",
  "twitter.com",
  "x.com",
  "instagram.com",
  "tiktok.com",
  "linkedin.com",
  "youtube.com",
  "t.co",
  "wa.me",
  "whatsapp.com",
  "telegram.me",
  "t.me",
];

export function isGaExcludedPath(pathname: string): boolean {
  return GA_EXCLUDED_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function isGaEnabled(): boolean {
  return (
    typeof window !== "undefined" &&
    Boolean(GA_MEASUREMENT_ID) &&
    typeof window.gtag === "function"
  );
}

function buildPagePath(pathname: string, search: string): string {
  if (!search) return pathname;
  return search.startsWith("?") ? `${pathname}${search}` : `${pathname}?${search}`;
}

export function getCurrentPageContext(): {
  pagePath: string;
  pageLocation: string;
  pageTitle: string;
} {
  if (typeof window === "undefined") {
    return { pagePath: "", pageLocation: "", pageTitle: "" };
  }
  const { pathname, search, href } = window.location;
  return {
    pagePath: buildPagePath(pathname, search),
    pageLocation: href,
    pageTitle: document.title,
  };
}

/**
 * Ekstrak GA client_id dari cookie `_ga` browser.
 * Format: GA1.X.<client_id_part1>.<client_id_part2>
 * Returns empty string jika tidak ada.
 */
export function getGaClientId(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("_ga="));
  if (!match) return "";
  const value = match.slice("_ga=".length);
  // Format: GA1.X.XXXXXXXXXX.XXXXXXXXXX → ambil 2 bagian terakhir sebagai client_id
  const parts = value.split(".");
  if (parts.length >= 4) {
    return `${parts[2]}.${parts[3]}`;
  }
  return value;
}

/**
 * Ambil GA client_id — tunggu gtag siap jika cookie `_ga` belum ada.
 * Mencegah race condition: useEffect artikel sering jalan sebelum gtag menulis cookie.
 */
export function getGaClientIdAsync(timeoutMs = 2500): Promise<string> {
  if (typeof window === "undefined") return Promise.resolve("");

  const fromCookie = getGaClientId();
  if (fromCookie) return Promise.resolve(fromCookie);

  const measurementId = GA_MEASUREMENT_ID;
  if (!measurementId || typeof window.gtag !== "function") {
    return Promise.resolve("");
  }

  return new Promise((resolve) => {
    let settled = false;

    const finish = (value: string) => {
      if (settled) return;
      settled = true;
      resolve(value || getGaClientId());
    };

    const timer = window.setTimeout(() => finish(getGaClientId()), timeoutMs);

    try {
      window.gtag!("get", measurementId, "client_id", (clientId: string) => {
        window.clearTimeout(timer);
        finish(clientId);
      });
    } catch {
      window.clearTimeout(timer);
      finish(getGaClientId());
    }
  });
}

/**
 * Klasifikasikan referrer URL menjadi tipe sumber traffic.
 * Dipanggil hanya dari browser (butuh document.referrer).
 */
export function buildReferrerType(
  referrer: string,
  currentHostname?: string,
): "direct" | "search" | "social" | "internal" | "other" {
  if (!referrer) return "direct";

  let hostname = "";
  try {
    hostname = new URL(referrer).hostname.toLowerCase();
  } catch {
    return "direct";
  }

  const host = currentHostname ?? (typeof window !== "undefined" ? window.location.hostname : "");
  if (host && hostname === host) return "internal";
  if (SEARCH_ENGINES.some((se) => hostname.includes(se))) return "search";
  if (SOCIAL_DOMAINS.some((sd) => hostname.includes(sd))) return "social";
  return "other";
}

/**
 * Tentukan session source dari URL (cek query param `?ref=push`).
 */
export function buildSessionSource(
  url: string,
): "push_notification" | "organic" {
  try {
    const params = new URL(url).searchParams;
    if (params.get("ref") === "push") return "push_notification";
  } catch {
    // URL tidak valid, abaikan
  }
  return "organic";
}

// ─── Helpers untuk komputasi parameter artikel ───────────────────────────────

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function countWords(html: string): number {
  const text = stripHtml(html);
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
}

function hasVideoEmbed(html: string): boolean {
  if (!html) return false;
  return (
    /<video[\s>]/i.test(html) ||
    /<iframe[^>]+(?:youtube|vimeo|youtu\.be|dailymotion)[^>]*>/i.test(html)
  );
}

/** Konversi Date ke WIB (UTC+7). */
function toWibDate(date: Date): Date {
  return new Date(date.getTime() + WIB_OFFSET_MS);
}

function getArticleAgeDays(publishedAt: Date | null | undefined): number {
  if (!publishedAt) return 0;
  const pub = new Date(publishedAt);
  if (isNaN(pub.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - pub.getTime()) / 86_400_000));
}

function getPublishHourWib(publishedAt: Date | null | undefined): number {
  if (!publishedAt) return 0;
  const pub = new Date(publishedAt);
  if (isNaN(pub.getTime())) return 0;
  return toWibDate(pub).getUTCHours();
}

function getPublishDayOfWeek(publishedAt: Date | null | undefined): string {
  if (!publishedAt) return "";
  const pub = new Date(publishedAt);
  if (isNaN(pub.getTime())) return "";
  return DAY_NAMES_ID[toWibDate(pub).getUTCDay()];
}

// ─── page_view ────────────────────────────────────────────────────────────────

/** Kirim page_view manual — dipakai GaRouteTracker untuk SPA navigation. */
export function trackPageView(opts: {
  pagePath: string;
  pageLocation?: string;
  pageTitle?: string;
}): void {
  if (!isGaEnabled()) return;

  window.gtag!("event", "page_view", {
    page_path: opts.pagePath,
    page_location: opts.pageLocation ?? "",
    page_title: opts.pageTitle ?? "",
  });
}

// ─── view_article ─────────────────────────────────────────────────────────────

export function buildArticleGaParams(
  article: Article,
  contentPage: number | "all",
  pageContext?: { pagePath: string; pageLocation: string; pageTitle: string },
  userType?: "logged_in" | "guest",
): ArticleGaPayload | null {
  const articleId = String(article._id ?? "").trim();
  if (!articleId) return null;

  const ctx = pageContext ?? getCurrentPageContext();
  const tags: Tag[] = article.tags ?? [];

  const content = "content" in article && article.content ? article.content : "";

  const publishedAt = article.publishedAt ? new Date(article.publishedAt) : null;

  const referrer =
    typeof document !== "undefined" ? document.referrer : "";
  const currentUrl =
    typeof window !== "undefined" ? window.location.href : ctx.pageLocation;

  return {
    article_id: articleId,
    article_slug: article.slug ?? "",
    article_title: article.title ?? "",
    author_id: String(article.authorId ?? ""),
    author_name: article.author?.name ?? "Anonim",
    editor_id: String(article.editorId ?? article.editor?._id ?? ""),
    editor_name: article.editor?.name ?? "",
    editor_slug: article.editor?.slug ?? "",
    category_id: String(article.categoryId ?? article.category?._id ?? ""),
    category_name: article.category?.name ?? "Uncategorized",
    category_slug: article.category?.slug ?? "",
    article_format: article.format ?? "STANDARD",
    tag_1: tags[0]?.name ?? "",
    tag_2: tags[1]?.name ?? "",
    tag_3: tags[2]?.name ?? "",
    is_breaking: article.isBreaking ? "true" : "false",
    is_headline: article.isHeadline ? "true" : "false",
    content_page: contentPage === "all" ? "all" : String(contentPage),
    has_video: hasVideoEmbed(content) ? "true" : "false",
    has_gallery: article.format === "GALLERY" ? "true" : "false",
    publish_day_of_week: getPublishDayOfWeek(publishedAt),
    user_type: userType ?? "guest",
    referrer_type: buildReferrerType(referrer),
    session_source: buildSessionSource(currentUrl),
    page_path: ctx.pagePath,
    page_location: ctx.pageLocation,
    page_title: article.title ?? ctx.pageTitle,
    article_age_days: getArticleAgeDays(publishedAt),
    word_count: countWords(content),
    publish_hour: getPublishHourWib(publishedAt),
  };
}

/**
 * Kirim view_article via browser gtag.
 *
 * @deprecated Sejak Fase 1, view_article dikirim server-only via Measurement Protocol
 * di /api/analytics/view-article. Fungsi ini tidak dipanggil lagi dari useArticleTracking.
 * Tetap ada untuk backward-compat jika dibutuhkan di konteks non-server (misal preview admin).
 */
export function trackArticleView(
  article: Article,
  contentPage: number | "all",
  userType?: "logged_in" | "guest",
): void {
  if (!isGaEnabled()) return;

  const params = buildArticleGaParams(article, contentPage, undefined, userType);
  if (!params) return;

  window.gtag!("event", "view_article", params);
}

// ─── article_read_complete ────────────────────────────────────────────────────

/**
 * Parameter event article_read_complete (Fase 2).
 * Dikirim saat user mencapai akhir konten artikel (scroll_depth = 80).
 */
export type ArticleReadCompletePayload = {
  article_id: string;
  article_slug: string;
  article_title: string;
  category_name: string;
  article_format: string;
  editor_id: string;
  editor_name: string;
  editor_slug: string;
  /** Fixed value: 80 — penanda threshold yang dicapai */
  scroll_depth: number;
  /** Detik sejak halaman di-load sampai marker masuk viewport */
  time_on_page_seconds: number;
  content_page: string;
};

/** Kirim event article_read_complete via browser gtag (Fase 2 — scroll depth). */
export function trackArticleReadComplete(
  article: Article,
  timeOnPageSeconds: number,
  contentPage: number | "all",
): void {
  if (!isGaEnabled()) return;

  const articleId = String(article._id ?? "").trim();
  if (!articleId) return;

  const payload: ArticleReadCompletePayload = {
    article_id: articleId,
    article_slug: article.slug ?? "",
    article_title: article.title ?? "",
    category_name: article.category?.name ?? "Uncategorized",
    article_format: article.format ?? "STANDARD",
    editor_id: String(article.editorId ?? article.editor?._id ?? ""),
    editor_name: article.editor?.name ?? "",
    editor_slug: article.editor?.slug ?? "",
    scroll_depth: 80,
    time_on_page_seconds: Math.max(0, Math.round(timeOnPageSeconds)),
    content_page: contentPage === "all" ? "all" : String(contentPage),
  };

  window.gtag!("event", "article_read_complete", payload);
}
