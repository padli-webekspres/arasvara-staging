import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/db";
import { getUserFromRequest } from "@/lib/auth";
import {
  canAccessAggregateAnalytics,
  forbiddenAnalyticsResponse,
  isFullAnalyticsRole,
  unauthorizedAnalyticsResponse,
} from "@/lib/analytics/analytics-auth";
import { getQueueCalendar } from "@/services/analytics/workflowAnalyticsService";

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorizedAnalyticsResponse();
    if (!canAccessAggregateAnalytics(user)) return forbiddenAnalyticsResponse();
    if (!isFullAnalyticsRole(user.role)) return forbiddenAnalyticsResponse();

    const db = await connectToDatabase();
    const queueData = await getQueueCalendar(db);

    return NextResponse.json({
      success: true,
      data: queueData,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Terjadi kesalahan internal server";
    console.error("Error pada GET /api/analytics/workflow/queue-calendar:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
