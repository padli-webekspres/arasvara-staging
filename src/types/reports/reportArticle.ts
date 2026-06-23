import { Article } from "../article";
import { UserProfile } from "../user";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Article Writer Report
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface ArticleWriterReport {
	user: UserProfile;
	totalArticles: number;
	articlesLast30Days: number;
	readersLast30Days: number;
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Article Engagement Report
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Simplified article data untuk engagement report
 */
export interface ArticleEngagementData {
	_id: string;
	title: string;
	slug: string;
	excerpt: string;
	viewCount: number;
	publishedAt: Date;
	createdAt: Date;
}

export interface ArticleEngagementReport {
	article: ArticleEngagementData;
	totalViews: number;
	viewsLast30Days: number;
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Query Parameters
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface ArticleReportQuery {
	search?: string;
	page?: number;
	limit?: number;
}
