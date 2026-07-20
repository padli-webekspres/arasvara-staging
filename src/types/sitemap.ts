export interface SitemapArticle {
	slug: string;
	publicPath?: string | null;
	title: string;
	publishedAt: string;
	updatedAt: string;
	/** Preferensi lastmod SEO jika ada (substantive content edit). */
	contentUpdatedAt?: string | null;
}

export interface SitemapCategory {
	slug: string;
	name: string;
}

export interface SitemapAuthor {
	slug: string;
	name: string;
	updatedAt: string;
}

export interface SitemapResponse {
	articles: SitemapArticle[];
	categories: SitemapCategory[];
	authors: SitemapAuthor[];
}
