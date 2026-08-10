import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/db";
import { getUserFromRequest } from "@/lib/auth";
import {
  canAccessAggregateAnalytics,
  forbiddenAnalyticsResponse,
  isFullAnalyticsRole,
  unauthorizedAnalyticsResponse,
} from "@/lib/analytics/analytics-auth";
import { getThroughputRespon } from "@/services/analytics/workflowAnalyticsService";

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorizedAnalyticsResponse();
    if (!canAccessAggregateAnalytics(user)) return forbiddenAnalyticsResponse();
    if (!isFullAnalyticsRole(user.role)) return forbiddenAnalyticsResponse();

    const searchParams = req.nextUrl.searchParams;
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");

    let startDate: Date | undefined = undefined;
    let endDate: Date | undefined = undefined;

    if (startDateParam) {
      const parsedStart = Date.parse(startDateParam);
      if (!isNaN(parsedStart)) {
        startDate = new Date(parsedStart);
      }
    }

    if (endDateParam) {
      const parsedEnd = Date.parse(endDateParam);
      if (!isNaN(parsedEnd)) {
        endDate = new Date(parsedEnd);
      }
    }

    const db = await connectToDatabase();
    const throughput = await getThroughputRespon(db, startDate, endDate);

    return NextResponse.json({
      success: true,
      data: throughput,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Terjadi kesalahan internal server";
    console.error("Error pada GET /api/analytics/workflow/throughput-respon:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
