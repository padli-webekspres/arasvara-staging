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
		const limit = parseInt(searchParams.get("limit") || "9");
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
		});
	} catch (error) {
		return NextResponse.json(
			{ error: (error as Error).message || "Internal server error" },
			{ status: 500 },
		);
	}
}
