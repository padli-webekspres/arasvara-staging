/**
 * Search articles with comprehensive filtering, sorting, and pagination
 * Supports both cursor-based and page-based pagination
 */

import { Db, ObjectId } from "mongodb";
import { ArticleStatus, ArticleListResponse } from "@/types/article";
import { SearchPayload, SearchResult } from "@/types/search";
import logger from "@/lib/logger";

/**
 * Helper: Encode cursor from numeric offset
 * Cursor is base64-encoded string of the skip offset
 */
function encodeCursor(offset: number): string {
	return Buffer.from(offset.toString()).toString("base64");
}

/**
 * Helper: Decode cursor to numeric offset
 * Returns offset or 0 if invalid cursor
 */
function decodeCursor(cursor: string): number {
	try {
		return parseInt(Buffer.from(cursor, "base64").toString(), 10);
	} catch {
		logger.warn({ cursor }, "Invalid cursor provided");
		return 0;
	}
}

/**
 * Search articles based on provided filters and pagination options
 * Default behavior: Returns latest published articles
 *
 * @param db Database connection
 * @param payload Search parameters (filters, sorting, pagination)
 * @returns SearchResult with articles and pagination metadata
 */
export async function searchArticles(
	db: Db,
	payload: SearchPayload,
): Promise<SearchResult> {
	try {
		// Build filter for published articles
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const filter: Record<string, any> = {
			status: ArticleStatus.PUBLISHED,
			deletedAt: { $in: [null, ""] },
		};

		// Apply search filter (text search in title and content)
		if (payload.search && payload.search.trim()) {
			const searchRegex = { $regex: payload.search.trim(), $options: "i" };
			filter.$or = [
				{ title: searchRegex },
				{ excerpt: searchRegex },
				{ content: searchRegex },
			];
		}

		// Apply category filter
		if (payload.categoryId) {
			try {
				filter.categoryId = new ObjectId(payload.categoryId);
			} catch {
				filter.categoryId = payload.categoryId;
			}
		}

		// Apply date range filter
		if (payload.dateRange?.from || payload.dateRange?.to) {
			filter.publishedAt = {};
			if (payload.dateRange.from) {
				filter.publishedAt.$gte = new Date(payload.dateRange.from);
			}
			if (payload.dateRange.to) {
				filter.publishedAt.$lte = new Date(payload.dateRange.to);
			}
		}

		// Apply tags filter
		if (payload.tags && payload.tags.length > 0) {
			const tagFilters = payload.tags.map((t) => {
				try {
					return { _id: new ObjectId(t).toString() };
				} catch {
					return { name: t };
				}
			});
			filter.tags = {
				$elemMatch: {
					$or: tagFilters,
				},
			};
		}

		// Determine sort field and order
		const sortBy = payload.sortBy || "date";
		const sortField =
			sortBy === "date"
				? "publishedAt"
				: sortBy === "views"
					? "viewCount"
					: "title";
		const sortOrder = payload.sortOrder === "asc" ? 1 : -1;

		// Determine pagination method
		const useCursorPagination = !!payload.cursor;
		const limit = Math.min(payload.limit || payload.pageSize || 10, 50);
		const page = payload.page || 1;

		let skip = 0;
		if (useCursorPagination && payload.cursor) {
			skip = decodeCursor(payload.cursor);
		} else if (page && page > 0) {
			skip = (page - 1) * limit;
		}

		// Count total matching documents
		const total = await db.collection("articles").countDocuments(filter);

		// Fetch documents (limit + 1 to detect hasNextPage)
		const articles = await db
			.collection("articles")
			.aggregate([
				{ $match: filter },
				{ $sort: { [sortField]: sortOrder } },
				{ $skip: skip },
				{ $limit: limit + 1 },
				{
					$lookup: {
						from: "categories",
						localField: "categoryId",
						foreignField: "_id",
						as: "categoryObj",
					},
				},
				{
					$addFields: {
						category: { $arrayElemAt: ["$categoryObj", 0] },
					},
				},
				{
					$lookup: {
						from: "users",
						localField: "authorId",
						foreignField: "_id",
						as: "authorObj",
					},
				},
				{
					$addFields: {
						author: { $arrayElemAt: ["$authorObj", 0] },
					},
				},
				{
					$lookup: {
						from: "users",
						localField: "editorId",
						foreignField: "_id",
						as: "editorObj",
					},
				},
				{
					$addFields: {
						editor: { $arrayElemAt: ["$editorObj", 0] },
					},
				},
				{ $project: { categoryObj: 0, authorObj: 0, editorObj: 0 } },
			])
			.toArray();
		const hasNextPage = articles.length > limit;
		const result = articles.slice(0, limit);

		// Normalize articles (convert to ArticleListResponse type)
		const normalizedArticles: ArticleListResponse[] = result.map((doc) => {
			const docId = doc._id instanceof ObjectId ? doc._id.toString() : doc._id;
			
			const mapUser = (u: any) => u ? {
				_id: u._id?.toString() ?? "",
				name: u.name ?? "",
				email: u.email ?? "",
				avatar: u.avatar,
				role: u.role ?? "SUBSCRIBER",
			} : undefined;

			return {
				_id: docId,
				title: doc.title ?? "",
				slug: doc.slug ?? "",
				excerpt: doc.excerpt ?? "",
				category: doc.category,
				tags: doc.tags ?? [],
				featuredImage: doc.featuredImage,
				author: mapUser(doc.author) || { _id: "", name: "", email: "", role: "SUBSCRIBER" },
				editor: mapUser(doc.editor),
				status: doc.status,
				isFeatured: doc.isFeatured ?? false,
				isHeadline: doc.isHeadline ?? false,
				isBreaking: doc.isBreaking ?? false,
				viewCount: doc.viewCount ?? 0,
				publishedAt: doc.publishedAt ?? new Date(),
				updatedAt: doc.updatedAt ?? new Date(),
			};
		});

		// Generate cursor for next page
		let nextCursor: string | undefined;
		if (hasNextPage && result.length > 0) {
			const nextOffset = skip + limit;
			nextCursor = encodeCursor(nextOffset);
		}

		// Build response
		const response: SearchResult = {
			articles: normalizedArticles,
			pagination: {
				total,
				limit,
				hasNextPage,
			},
		};

		// Add pagination metadata based on method used
		if (useCursorPagination) {
			response.pagination.cursor = nextCursor;
		} else {
			response.pagination.page = page;
			response.pagination.totalPages = Math.ceil(total / limit);
		}

		return response;
	} catch (error) {
		logger.error({ error, payload }, "Error searching articles");
		throw error;
	}
}
