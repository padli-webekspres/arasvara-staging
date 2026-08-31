import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getRecentBoostedArticles } from "@/services/googleIndexingService";
import logger from "@/lib/logger";

/**
 * GET /api/admin/dashboard/boosted-articles
 * 
 * Fetch recent articles with Google Indexing boost
 * 
 * Query params:
 * - limit: number (default 10, max 50)
 * 
 * Authorization: ADMIN, EDITOR_IN_CHIEF, MANAGING_EDITOR, EDITOR
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(
      parseInt(searchParams.get("limit") || "10", 10),
      50
    );

    const articles = await getRecentBoostedArticles(limit);

    return NextResponse.json(
      { articles },
      { status: 200 }
    );
  } catch (error: any) {
    logger.error({ err: error }, "Failed to fetch boosted articles");
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
