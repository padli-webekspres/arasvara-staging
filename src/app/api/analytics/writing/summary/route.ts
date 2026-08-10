import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/db";
import { getUserFromRequest } from "@/lib/auth";
import {
  badRequestAnalyticsResponse,
  canAccessAggregateAnalytics,
  forbiddenAnalyticsResponse,
  resolveAnalyticsScopeUserIds,
  unauthorizedAnalyticsResponse,
} from "@/lib/analytics/analytics-auth";
import { getWritingAnalyticsSummary } from "@/services/analytics/writingAnalyticsService";
import logger from "@/lib/logger";

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorizedAnalyticsResponse();
    if (!canAccessAggregateAnalytics(user)) return forbiddenAnalyticsResponse();

    const sp = req.nextUrl.searchParams;
    const db = await connectToDatabase();
    const scope = await resolveAnalyticsScopeUserIds(db, user);

    const data = await getWritingAnalyticsSummary(db, {
      range: sp.get("range") || undefined,
      from: sp.get("from") || undefined,
      to: sp.get("to") || undefined,
      attribution: sp.get("attribution") || undefined,
      categoryId: sp.get("categoryId") || undefined,
      search: sp.get("search") || undefined,
      scopedUserIds: scope.mode === "all" ? null : scope.userIds,
    });

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    const message = (error as Error)?.message || "Internal server error";
    if (
      message.includes("Parameter") ||
      message.includes("Rentang") ||
      message.includes("Invalid") ||
      message.includes("attribution")
    ) {
      return badRequestAnalyticsResponse(message);
    }
    logger.error({ msg: "GET /api/analytics/writing/summary", error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
