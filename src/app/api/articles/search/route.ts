/**
 * GET /api/articles/search
 *
 * Search for published articles with filtering, sorting, and pagination
 *
 * Query Parameters:
 * - search: Full-text search in title and content
 * - categoryId: Filter by category ID
 * - dateFrom: Start date (ISO format, e.g., 2024-01-01)
 * - dateTo: End date (ISO format, e.g., 2024-12-31)
 * - tags: Comma-separated tag names or IDs
 * - sortBy: Sort field (name, date, views) - default: date
 * - sortOrder: Sort order (asc, desc) - default: desc
 * - cursor: Cursor for cursor-based pagination
 * - page: Page number (1-indexed) - default: 1
 * - pageSize: Items per page - default: 10, max: 50
 * - limit: Items per page (alias for pageSize) - default: 10, max: 50
 *
 * Example Usage:
 * GET /api/articles/search?search=technology&categoryId=123&page=1&pageSize=10
 * GET /api/articles/search?search=politics&cursor=eyIwIjp9&limit=20
 */

import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/db";
import { searchArticles } from "@/services/article/searchArticleService";
import { SearchPayload } from "@/types/search";
import logger from "@/lib/logger";

export async function GET(req: NextRequest) {
	try {
		const db = await connectToDatabase();
		const searchParams = req.nextUrl.searchParams;

		// Parse search payload from query parameters
		const payload: SearchPayload = {
			search: searchParams.get("search") || undefined,
			categoryId: searchParams.get("categoryId") || undefined,
			dateRange:
				searchParams.get("dateFrom") && searchParams.get("dateTo")
					? {
							from: searchParams.get("dateFrom")!,
							to: searchParams.get("dateTo")!,
						}
					: undefined,
			tags: searchParams.get("tags")
				? searchParams
						.get("tags")!
						.split(",")
						.map((t) => t.trim())
				: undefined,
			sortBy:
				(searchParams.get("sortBy") as "name" | "date" | "views") || "date",
			sortOrder: (searchParams.get("sortOrder") as "asc" | "desc") || "desc",
			cursor: searchParams.get("cursor") || undefined,
			page: searchParams.get("page")
				? parseInt(searchParams.get("page")!, 10)
				: undefined,
			pageSize: searchParams.get("pageSize")
				? parseInt(searchParams.get("pageSize")!, 10)
				: undefined,
			limit: searchParams.get("limit")
				? parseInt(searchParams.get("limit")!, 10)
				: undefined,
		};

		// Validate sortBy and sortOrder values
		if (!["name", "date", "views"].includes(payload.sortBy || "date")) {
			return NextResponse.json(
				{ error: "Invalid sortBy value. Must be one of: name, date, views" },
				{ status: 400 },
			);
		}

		if (!["asc", "desc"].includes(payload.sortOrder || "desc")) {
			return NextResponse.json(
				{ error: "Invalid sortOrder value. Must be one of: asc, desc" },
				{ status: 400 },
			);
		}

		// Validate pagination parameters
		if (payload.page && payload.page < 1) {
			return NextResponse.json(
				{ error: "Page must be greater than 0" },
				{ status: 400 },
			);
		}

		const maxLimit = 50;
		if (payload.limit && payload.limit > maxLimit) {
			payload.limit = maxLimit;
		}
		if (payload.pageSize && payload.pageSize > maxLimit) {
			payload.pageSize = maxLimit;
		}

		// Execute search
		const result = await searchArticles(db, payload);

		return NextResponse.json(result, { status: 200 });
	} catch (error) {
		logger.error({ error }, "Error in search articles endpoint");
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
