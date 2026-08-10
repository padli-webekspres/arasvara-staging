import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/db";
import { getUserFromRequest } from "@/lib/auth";
import {
  canAccessAggregateAnalytics,
  forbiddenAnalyticsResponse,
  isFullAnalyticsRole,
  unauthorizedAnalyticsResponse,
} from "@/lib/analytics/analytics-auth";
import {
  getFormatDistribution,
  getCategoryDistribution,
  getCrossCorrelation,
} from "@/services/analytics/audienceAnalyticsService";

/**
 * Route GET /api/analytics/audience/distribution
 *
 * Menyajikan tiga kelompok data distribusi audiens dalam satu endpoint:
 * 1. formatDistribution  — distribusi views berdasarkan format artikel (STANDARD vs GALLERY)
 * 2. categoryDistribution — distribusi views berdasarkan kategori teratas
 * 3. crossCorrelation    — matriks views berdasarkan kombinasi format × kategori
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorizedAnalyticsResponse();
    if (!canAccessAggregateAnalytics(user)) return forbiddenAnalyticsResponse();
    if (!isFullAnalyticsRole(user.role)) return forbiddenAnalyticsResponse();

    const searchParams = req.nextUrl.searchParams;
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");

    const resolvedEnd = endDateParam ? new Date(endDateParam) : new Date();
    const resolvedStart = startDateParam
      ? new Date(startDateParam)
      : new Date(resolvedEnd.getTime() - 30 * 24 * 60 * 60 * 1000);

    if (startDateParam && isNaN(resolvedStart.getTime())) {
      return NextResponse.json(
        { error: "Invalid startDate format: Gunakan format ISO string yang valid (YYYY-MM-DD)" },
        { status: 400 }
      );
    }
    if (endDateParam && isNaN(resolvedEnd.getTime())) {
      return NextResponse.json(
        { error: "Invalid endDate format: Gunakan format ISO string yang valid (YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    const db = await connectToDatabase();

    const [formatDistribution, categoryDistribution, crossCorrelation] =
      await Promise.all([
        getFormatDistribution(db, resolvedStart, resolvedEnd),
        getCategoryDistribution(db, resolvedStart, resolvedEnd, 10),
        getCrossCorrelation(db, resolvedStart, resolvedEnd, 5),
      ]);

    return NextResponse.json({
      success: true,
      data: {
        formatDistribution,
        categoryDistribution,
        crossCorrelation,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Terjadi kesalahan internal server";
    console.error("Error pada GET /api/analytics/audience/distribution:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
