import { NextRequest, NextResponse } from "next/server";
import { uploadVideoThumbnail } from "@/services/article/articleSection/socmed/videoSocmedUploadService";
import { getUserFromRequest } from "@/lib/auth";
import logger from "@/lib/logger";

const ALLOWED_PLATFORMS = ["tiktok", "instagram", "youtube"] as const;
type Platform = typeof ALLOWED_PLATFORMS[number];

/**
 * POST /api/articles/socmed/[platform]/upload-thumbnail
 *
 * Upload dan compress video thumbnail untuk platform socmed
 * File disimpan ke: s3://bucket/thumbnails/{platform}/{filename}.webp
 *
 * Request: multipart/form-data dengan field "file"
 * Response: { url: string, filename: string }
 *
 * Authorization: Logged in user (any role)
 */
export async function POST(req: NextRequest, context: { params: Promise<{ platform: string }> }) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      logger.warn("Unauthorized attempt to upload video thumbnail");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { platform } = await context.params;
    if (!ALLOWED_PLATFORMS.includes(platform as Platform)) {
      logger.warn({ platform }, "Invalid platform for upload thumbnail");
      return NextResponse.json({ error: "Invalid platform" }, { status: 400 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file || file.size === 0) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    // Upload thumbnail dengan compression
    const result = await uploadVideoThumbnail(file, platform as Platform);

    logger.info(
      { userId: user._id, filename: result.filename, platform },
      "Video thumbnail uploaded successfully",
    );

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message = (error as Error).message;

    if (message === "File harus berupa gambar") {
      logger.warn({ error: message }, "Invalid file type for video thumbnail");
      return NextResponse.json({ error: message }, { status: 400 });
    }

    logger.error({ error }, "Error uploading video thumbnail");
    return NextResponse.json(
      { error: "Upload failed", details: message },
      { status: 500 },
    );
  }
}
