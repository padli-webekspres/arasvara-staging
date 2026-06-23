import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { upsertSocmedVideoSection } from "@/services/article/articleSection/socmed/videoSocmedService";
import logger from "@/lib/logger";
import { connectToDatabase } from "@/lib/db/db";
import { getSocmedVideoSectionWithItems } from "@/services/article/articleSection/socmed/videoSocmedService";

const ALLOWED_PLATFORMS = ["tiktok", "instagram", "youtube"] as const;
type Platform = (typeof ALLOWED_PLATFORMS)[number];

/**
 * GET /api/articles/socmed/[platform]
 *
 * Ambil daftar video section untuk platform socmed (tiktok, instagram, youtube)
 *
 * Response: Array video section
 * Authorization: Logged in user (any role)
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ platform: string }> },
) {
  try {

    const { platform } = await context.params;
    if (!ALLOWED_PLATFORMS.includes(platform as Platform)) {
      logger.warn({ platform }, "Invalid platform for get video section");
      return NextResponse.json({ error: "Invalid platform" }, { status: 400 });
    }

    const db = await connectToDatabase();
    const result = await getSocmedVideoSectionWithItems(
      db,
      platform as Platform,
    );


    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message = (error as Error).message;
    logger.error({ error }, "Error fetching socmed video section");
    return NextResponse.json(
      { error: "Fetch failed", details: message },
      { status: 500 },
    );
  }
}

/**
 * POST /api/articles/socmed/[platform]/video-section
 *
 * Upsert video section untuk platform socmed (tiktok, instagram, youtube)
 *
 * Request: { videos: [{ video_url, title, thumbnail_url }] }
 * Response: Array video section terbaru
 *
 * Authorization: Logged in user (any role)
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ platform: string }> },
) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      logger.warn("Unauthorized attempt to upsert socmed video section");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { platform } = await context.params;
    if (!ALLOWED_PLATFORMS.includes(platform as Platform)) {
      logger.warn({ platform }, "Invalid platform for upsert video section");
      return NextResponse.json({ error: "Invalid platform" }, { status: 400 });
    }

    const db = await connectToDatabase();
    const payload = await req.json();

    // Upsert video section (dynamic by platform)
    const result = await upsertSocmedVideoSection(
      db,
      platform as Platform,
      payload,
      {
        _id: user._id,
        name: user.name,
        email: user.email,
      },
    );

    logger.info(
      { userId: user._id, platform, count: result.length },
      "Socmed video section upserted successfully",
    );

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message = (error as Error).message;
    logger.error({ error }, "Error upserting socmed video section");
    return NextResponse.json(
      { error: "Upsert failed", details: message },
      { status: 500 },
    );
  }
}
