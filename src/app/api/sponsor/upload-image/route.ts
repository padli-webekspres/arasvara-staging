import { NextRequest, NextResponse } from "next/server";
import { uploadSponsorImage } from "@/services/sponsor/sponsorUploadService";
import { getUserFromRequest } from "@/lib/auth";
import logger from "@/lib/logger";

/**
 * POST /api/sponsor/upload-image
 *
 * Upload dan compress sponsor image
 * File disimpan ke: s3://bucket/sponsors/{filename}.webp
 *
 * Request: multipart/form-data dengan field "file"
 * Response: { url: string, filename: string }
 *
 * Authorization: Logged in user (admin/editor)
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      logger.warn("Unauthorized attempt to upload sponsor image");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file || file.size === 0) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    // Upload image dengan compression
    const result = await uploadSponsorImage(file);

    logger.info(
      { userId: user._id, filename: result.filename },
      "Sponsor image uploaded successfully",
    );

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message = (error as Error).message;

    if (message === "File harus berupa gambar") {
      logger.warn({ error: message }, "Invalid file type for sponsor image");
      return NextResponse.json({ error: message }, { status: 400 });
    }

    logger.error({ error }, "Error uploading sponsor image");
    return NextResponse.json(
      { error: "Upload failed", details: message },
      { status: 500 },
    );
  }
}
