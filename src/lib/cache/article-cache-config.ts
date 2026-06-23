/** TTL ISR halaman detail artikel publik (detik). Default 3600 (1 jam). */
export function getArticleRevalidateSeconds(): number {
  const n = Number(process.env.ARTICLE_PAGE_REVALIDATE_SECONDS);
  return Number.isFinite(n) && n > 0 ? n : 3600;
}

export function getArticleCacheTag(slug: string): string {
  return `article-${slug}`;
}

export function getArticleCacheTagFromPublicPath(publicPath: string): string {
  const normalized = publicPath.trim();
  if (!normalized) return "article-path-empty";
  return `article-path-${Buffer.from(normalized, "utf8").toString("base64url")}`;
}
