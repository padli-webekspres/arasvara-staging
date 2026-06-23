import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db/db";
import logger from "@/lib/logger";
import {
  getCombinedSocmedVideoSection,
  upsertCombinedSocmedVideoSection,
} from "@/services/article/articleSection/socmed/videoSocmedService";

/**
 * GET /api/articles/socmed/combined
 *
 * Ambil daftar video TikTok + Instagram dengan order global.
 */
export async function GET() {
  try {
    const db = await connectToDatabase();
    const result = await getCombinedSocmedVideoSection(db);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message = (error as Error).message;
    logger.error({ error }, "Error fetching combined socmed video section");
    return NextResponse.json(
      { error: "Fetch failed", details: message },
      { status: 500 },
    );
  }
}

/**
 * POST /api/articles/socmed/combined
 *
 * Upsert video section gabungan TikTok + Instagram.
 * Request: { videos: [{ video_url, title, thumbnail_url, type }] }
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      logger.warn("Unauthorized attempt to upsert combined socmed video section");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = await connectToDatabase();
    const payload = await req.json();

    const result = await upsertCombinedSocmedVideoSection(db, payload, {
      _id: user._id,
      name: user.name,
      email: user.email,
    });

    logger.info(
      { userId: user._id, count: result.length },
      "Combined socmed video section upserted successfully",
    );

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message = (error as Error).message;
    const status = (error as { status?: number }).status ?? 500;
    logger.error({ error }, "Error upserting combined socmed video section");
    return NextResponse.json(
      { error: "Upsert failed", details: message },
      { status },
    );
  }
}
