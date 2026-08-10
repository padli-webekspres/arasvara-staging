import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/db";
import { getUserFromRequest } from "@/lib/auth";
import {
  canAccessAggregateAnalytics,
  forbiddenAnalyticsResponse,
  isFullAnalyticsRole,
  unauthorizedAnalyticsResponse,
} from "@/lib/analytics/analytics-auth";
import { getArticleEngagement } from "@/services/analytics/audienceAnalyticsService";

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorizedAnalyticsResponse();
    if (!canAccessAggregateAnalytics(user)) return forbiddenAnalyticsResponse();
    if (!isFullAnalyticsRole(user.role)) return forbiddenAnalyticsResponse();

    const searchParams = req.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const search = searchParams.get("search") || "";
    const categoryId = searchParams.get("categoryId") || "";
    const format = searchParams.get("format") || "";

    const db = await connectToDatabase();
    const result = await getArticleEngagement(db, {
      page,
      limit,
      search,
      categoryId,
      format,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Terjadi kesalahan internal server";
    console.error("Error pada GET /api/analytics/audience/engagement:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
