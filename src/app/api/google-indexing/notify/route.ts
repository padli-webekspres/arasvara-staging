import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { notifyGoogleIndexing } from "@/services/googleIndexingService";
import logger from "@/lib/logger";

/**
 * POST /api/google-indexing/notify
 * 
 * Notify Google Indexing API about article URL change
 * 
 * Body:
 * {
 *   "articleId": "article_id_string",
 *   "url": "https://arasvara.id/...",
 *   "type": "URL_UPDATED" | "URL_DELETED",
 *   "dryRun": false
 * }
 * 
 * Authorization: ADMIN, EDITOR_IN_CHIEF, MANAGING_EDITOR, EDITOR, WRITER
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { articleId, url, type = "URL_UPDATED", dryRun = false } = body;

    if (!articleId || !url) {
      return NextResponse.json(
        { error: "articleId and url required" },
        { status: 400 }
      );
    }

    if (!["URL_UPDATED", "URL_DELETED"].includes(type)) {
      return NextResponse.json(
        { error: "type must be URL_UPDATED or URL_DELETED" },
        { status: 400 }
      );
    }

    logger.info(
      { articleId, url, type, dryRun, userId: user._id },
      "Google Indexing API notification request"
    );

    const result = await notifyGoogleIndexing(
      articleId,
      url,
      type,
      user._id!,
      dryRun
    );

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          quotaRemaining: result.quotaRemaining,
        },
        { status: result.error?.includes("quota") ? 429 : 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        quotaRemaining: result.quotaRemaining,
        responseData: result.responseData,
      },
      { status: 200 }
    );
  } catch (error: any) {
    logger.error({ err: error }, "Google Indexing API notify failed");
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
