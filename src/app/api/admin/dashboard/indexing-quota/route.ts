import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getTodayQuotaUsage } from "@/services/googleIndexingService";
import logger from "@/lib/logger";

/**
 * GET /api/admin/dashboard/indexing-quota
 * 
 * Get today's Google Indexing API quota usage
 * 
 * Response:
 * {
 *   "date": "2026-08-19",
 *   "used": 5,
 *   "limit": 200,
 *   "remaining": 195,
 *   "percentage": 2.5
 * }
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

    const quota = await getTodayQuotaUsage();

    return NextResponse.json(quota, { status: 200 });
  } catch (error: any) {
    logger.error({ err: error }, "Failed to fetch indexing quota");
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
