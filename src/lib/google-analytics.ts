import { Article, Tag } from "@/types/article";

/** Parameter event view_article — harus selaras dengan Custom Dimensions di GA4 Admin. */
export type ArticleGaPayload = {
  article_id: string;
  article_slug: string;
  article_title: string;
  author_id: string;
  author_name: string;
  category_id: string;
  category_name: string;
  category_slug: string;
  article_format: string;
  tag_names: string;
  is_breaking: string;
  is_headline: string;
  content_page: string;
  page_path: string;
  page_location: string;
  page_title: string;
};

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

/** Route yang tidak perlu dikirim ke GA4 (admin & auth). */
export const GA_EXCLUDED_PATH_PREFIXES = ["/admin-xyz", "/login"] as const;

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

export function buildArticleGaParams(
  article: Article,
  contentPage: number | "all",
  pageContext?: { pagePath: string; pageLocation: string; pageTitle: string },
): ArticleGaPayload | null {
  const articleId = String(article._id ?? "").trim();
  if (!articleId) return null;

  const ctx = pageContext ?? getCurrentPageContext();

  return {
    article_id: articleId,
    article_slug: article.slug ?? "",
    article_title: article.title ?? "",
    author_id: String(article.authorId ?? ""),
    author_name: article.author?.name ?? "Anonim",
    category_id: String(article.categoryId ?? article.category?._id ?? ""),
    category_name: article.category?.name ?? "Uncategorized",
    category_slug: article.category?.slug ?? "",
    article_format: article.format ?? "STANDARD",
    tag_names: (article.tags ?? []).map((t: Tag) => t.name).join(", "),
    is_breaking: article.isBreaking ? "true" : "false",
    is_headline: article.isHeadline ? "true" : "false",
    content_page: contentPage === "all" ? "all" : String(contentPage),
    page_path: ctx.pagePath,
    page_location: ctx.pageLocation,
    page_title: article.title ?? ctx.pageTitle,
  };
}

/** Event editorial — metadata artikel untuk Looker Studio. */
export function trackArticleView(
  article: Article,
  contentPage: number | "all",
): void {
  if (!isGaEnabled()) return;

  const params = buildArticleGaParams(article, contentPage);
  if (!params) return;

  window.gtag!("event", "view_article", params);
}
