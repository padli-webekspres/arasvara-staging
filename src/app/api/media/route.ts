import { getMediaFromDB } from "@/services/mediaService";
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import logger from "@/lib/logger";
import { saveMediaDB } from "@/services/mediaService";
import { connectToDatabase } from "@/lib/db/db";

/**
 * POST /api/media
 * Upload file + save metadata (caption, takenBy, watermark) to database.
 * Accepts multipart/form-data with:
 *   - file: File (required)
 *   - caption?: string
 *   - takenBy?: string
 *   - watermark?: "true" | "false"
 */
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file || file.size === 0) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    // Extract optional metadata
    const caption = (formData.get("caption") as string | null) ?? undefined;
    const credit = (formData.get("credit") as string | null) ?? undefined;
    const watermark = formData.get("watermark") === "true";

    const db = await connectToDatabase();

    const media = await saveMediaDB(db, file, { caption, credit, watermark }, {
      _id: user._id,
      name: user.name,
      email: user.email,
    });

    logger.info(
      { userId: user._id, mediaId: media._id, filename: media.filename },
      "Media uploaded successfully",
    );

    return NextResponse.json({ success: true, media }, { status: 201 });
  } catch (error) {
    const message = (error as Error).message;
    logger.error({ err: error }, "Error uploading media");
    return NextResponse.json(
      { error: "Upload failed", details: message },
      { status: 500 },
    );
  }
}

/**
 * GET /api/media
 * Ambil koleksi media dengan pagination page/limit atau cursor.
 * Query: ?page=1&limit=20 atau ?cursor=ObjectId&limit=20
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = searchParams.get("page");
    const limit = searchParams.get("limit");
    const cursor = searchParams.get("cursor");
    const filter = searchParams.get("filter"); // image, video, pdf
    const query = searchParams.get("query"); // search string
    const params: any = {};
    if (page) params.page = parseInt(page, 10);
    if (limit) params.limit = parseInt(limit, 10);
    if (cursor) params.cursor = cursor;
    if (filter) params.filter = filter;
    if (query) params.query = query;
    const result = await getMediaFromDB(params);
    return NextResponse.json({ success: true, ...result }, { status: 200 });
  } catch (error) {
    const message = (error as Error).message;
    logger.error({ err: error }, "Error fetching media");
    return NextResponse.json(
      { error: "Failed to fetch media", details: message },
      { status: 500 },
    );
  }
}
