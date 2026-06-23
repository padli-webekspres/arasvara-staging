import { connectToDatabase } from "@/lib/db/db";
import { ArticleStatus } from "@/types/article";
import {
	SitemapArticle,
	SitemapCategory,
	SitemapResponse,
} from "@/types/sitemap";

function toIsoString(value: unknown): string | null {
	if (value == null) return null;
	const date = value instanceof Date ? value : new Date(String(value));
	return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export async function getSitemapArticles(): Promise<SitemapArticle[]> {
	const db = await connectToDatabase();
	const articles = await db
		.collection("articles")
		.find({
			status: ArticleStatus.PUBLISHED,
			$or: [{ deletedAt: { $exists: false } }, { deletedAt: null }],
		})
		.project({ slug: 1, publicPath: 1, title: 1, publishedAt: 1, updatedAt: 1, _id: 0 })
		.sort({ publishedAt: -1 })
		.toArray();

	return articles.flatMap((article): SitemapArticle[] => {
		const publishedAt = toIsoString(article.publishedAt);
		const updatedAt =
			toIsoString(article.updatedAt) ?? publishedAt ?? new Date().toISOString();
		const slug = String(article.slug ?? "").trim();

		if (!publishedAt || !slug) return [];

		return [
			{
				slug,
				publicPath: article.publicPath ? String(article.publicPath).trim() : null,
				title: String(article.title ?? article.slug ?? "").trim(),
				publishedAt,
				updatedAt,
			},
		];
	});
}

export async function getSitemapCategories(): Promise<SitemapCategory[]> {
	const db = await connectToDatabase();
	const categories = await db
		.collection("categories")
		.find({})
		.project({ slug: 1, name: 1, _id: 0 })
		.toArray();

	return categories
		.map((category) => ({
			slug: String(category.slug ?? "").trim(),
			name: String(category.name ?? category.slug ?? "").trim(),
		}))
		.filter((category) => Boolean(category.slug));
}

export async function getSitemapData(): Promise<SitemapResponse> {
	const [articles, categories] = await Promise.all([
		getSitemapArticles(),
		getSitemapCategories(),
	]);
	return { articles, categories };
}
