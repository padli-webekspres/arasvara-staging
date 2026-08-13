import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/db";
import { getArticlesByCategoryIdOrSlug } from "@/services/article/getArticleService";

export async function GET(
	req: NextRequest,
	context: { params: Promise<{ idOrSlug: string }> },
) {
	try {
		const db = await connectToDatabase();
		const { idOrSlug } = await context.params;
		const { searchParams } = new URL(req.url);
		const limitRaw = searchParams.get("limit") || "9";
		if (!/^\d+$/.test(limitRaw) || Number(limitRaw) < 1 || Number(limitRaw) > 50) {
			return NextResponse.json(
				{ error: "Limit harus berupa angka antara 1 dan 50" },
				{ status: 400 },
			);
		}
		const limit = Number(limitRaw);
		const status = searchParams.get("status") || "PUBLISHED";
		const cursor = searchParams.get("cursor") || undefined;
		const result = await getArticlesByCategoryIdOrSlug(db, idOrSlug, {
			limit,
			status,
			cursor,
		});
		if (!result.category) {
			return NextResponse.json(
				{ error: "Category not found" },
				{ status: 404 },
			);
		}
		return NextResponse.json({
			category: result.category,
			articles: result.articles,
			nextCursor: result.nextCursor,
			hasMore: result.hasMore,
		});
	} catch (error) {
		const status =
			typeof error === "object" &&
			error !== null &&
			"status" in error &&
			typeof error.status === "number"
				? error.status
				: 500;
		return NextResponse.json(
			{ error: (error as Error).message || "Internal server error" },
			{ status },
		);
	}
}
