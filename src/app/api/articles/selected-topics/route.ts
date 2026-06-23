import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/db";
import { getArticlesBySelectedTopics } from "@/services/article/getArticleService";

/**
 * GET /api/articles/selected-topics?topics=internasional,bisnis,tech
 *
 * Returns up to 9 latest published articles distributed across the given
 * category slugs, sorted by publishedAt desc.
 */
export async function GET(req: NextRequest) {
	try {
		const { searchParams } = new URL(req.url);
		const topicsParam = searchParams.get("topics");

		if (!topicsParam) {
			return NextResponse.json(
				{ success: false, message: "Query param 'topics' is required" },
				{ status: 400 },
			);
		}

		// Parse, trim, and deduplicate slugs
		const topicSlugs = [
			...new Set(
				topicsParam
					.split(",")
					.map((s) => s.trim().toLowerCase())
					.filter(Boolean),
			),
		];

		if (!topicSlugs.length) {
			return NextResponse.json(
				{ success: false, message: "No valid topic slugs provided" },
				{ status: 400 },
			);
		}

		const db = await connectToDatabase();
		const articles = await getArticlesBySelectedTopics(db, topicSlugs);

		return NextResponse.json({ success: true, data: articles });
	} catch (error) {
		return NextResponse.json(
			{
				success: false,
				message: "Failed to fetch articles for selected topics",
				error: (error as Error).message,
			},
			{ status: 500 },
		);
	}
}
