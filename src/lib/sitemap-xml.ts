import type { SitemapArticle, SitemapCategory } from "@/types/sitemap";
import { isStructuredPublicPath } from "@/lib/article-public-path";

/** Basis URL publik dari NEXT_PUBLIC_BASE_URL (tanpa trailing slash). */
export function getSitemapBaseUrl(): string {
	const raw =
		process.env.NEXT_PUBLIC_BASE_URL?.trim() || "https://arasvara.id";
	return raw.replace(/\/+$/, "");
}

export function escapeXml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");
}

function buildLoc(baseUrl: string, path: string): string {
	const normalizedPath = path.startsWith("/") ? path : `/${path}`;
	return escapeXml(`${baseUrl}${normalizedPath}`);
}

/** Google News: artikel dalam ~48 jam terakhir. */
export function isRecentNewsArticle(
	publishedAtIso: string,
	maxAgeHours = 48,
): boolean {
	const publishedAt = new Date(publishedAtIso);
	if (Number.isNaN(publishedAt.getTime())) return false;
	return Date.now() - publishedAt.getTime() <= maxAgeHours * 60 * 60 * 1000;
}

const STATIC_PAGES = [
	{ path: "/", priority: "1.0", changefreq: "hourly" },
	{ path: "/about-us", priority: "0.6", changefreq: "monthly" },
	{ path: "/disclaimer", priority: "0.4", changefreq: "yearly" },
	{ path: "/pedoman-media-siber", priority: "0.4", changefreq: "yearly" },
] as const;

function staticUrlXml(baseUrl: string): string {
	return STATIC_PAGES.map(
		(page) => `
  <url>
    <loc>${buildLoc(baseUrl, page.path)}</loc>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`,
	).join("");
}

function categoryUrlXml(baseUrl: string, categories: SitemapCategory[]): string {
	return categories
		.map(
			(category) => `
  <url>
    <loc>${buildLoc(baseUrl, `/category/${encodeURIComponent(category.slug)}`)}</loc>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>`,
		)
		.join("");
}

function articleUrlXml(baseUrl: string, articles: SitemapArticle[]): string {
	return articles
		.flatMap((article) => {
			const path = article.publicPath?.trim();
			if (!path || !isStructuredPublicPath(path)) return [];

			const lastmod = escapeXml(article.updatedAt);
			const newsBlock = isRecentNewsArticle(article.publishedAt)
				? `
    <news:news>
      <news:publication>
        <news:name>Arasvara</news:name>
        <news:language>id</news:language>
      </news:publication>
      <news:publication_date>${escapeXml(article.publishedAt)}</news:publication_date>
      <news:title>${escapeXml(article.title || article.slug)}</news:title>
    </news:news>`
				: "";

			return `
  <url>
    <loc>${buildLoc(baseUrl, path)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>${newsBlock}
  </url>`;
		})
		.join("");
}

export function buildSitemapXml(
	baseUrl: string,
	articles: SitemapArticle[],
	categories: SitemapCategory[],
): string {
	return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">${staticUrlXml(baseUrl)}${categoryUrlXml(baseUrl, categories)}${articleUrlXml(baseUrl, articles)}
</urlset>`;
}
