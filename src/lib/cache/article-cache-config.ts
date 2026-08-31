/** TTL ISR halaman detail artikel publik (detik). Default 300 (5 menit). */
export function getArticleRevalidateSeconds(): number {
  const n = Number(process.env.ARTICLE_PAGE_REVALIDATE_SECONDS);
  return Number.isFinite(n) && n > 0 ? n : 300;
}

export function getArticleCacheTag(slug: string): string {
  return `article-${slug}`;
}

export function getArticleCacheTagFromPublicPath(publicPath: string): string {
  const normalized = publicPath.trim();
  if (!normalized) return "article-path-empty";
  return `article-path-${Buffer.from(normalized, "utf8").toString("base64url")}`;
}

/** Tag koleksi untuk fetch listing homepage (headline, terbaru). */
export const ARTICLE_LISTING_CACHE_TAG = "articles-listing";
