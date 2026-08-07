import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";
import { getUserFromRequest } from "@/lib/auth";
import { s3Client, S3_BUCKET } from "@/lib/s3";
import { ulid } from "ulid";
import { processImageWithSharp } from "@/lib/image/processImageWithSharp";
import {
  buildTempMediaKey,
  buildTempMediaViewUrl,
} from "@/lib/media/tempMedia";
import logger from "@/lib/logger";
import {
  generateImageVariants,
  getVariantKey,
} from "@/lib/image/generateImageVariants";
import { withImmutableCacheControl } from "@/lib/s3/object-cache";

/**
 * POST /api/media/process-temp (multipart/form-data)
 *
 * Klien upload hasil crop (JPEG/WebP/PNG/HEIC). Server memproses dengan Sharp:
 * decode → (opsional watermark) → kompresi WebP → simpan `temp/{id}.webp`.
 *
 * Body (FormData):
 * - `file`: File gambar (wajib)
 * - `watermark`: "true" | "false" (opsional)
 * - `maxWidth`, `maxHeight`: batas dimensi (opsional, default 1920×1080 fit-inside)
 *
 * Response: { success, tempMediaId, tempUrl, filename, size, mimetype }
 */
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json(
        { error: "No file uploaded" },
        { status: 400 },
      );
    }

    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File terlalu besar (maks 25 MB)" },
        { status: 413 },
      );
    }

    const watermark = formData.get("watermark") === "true";
    const maxWidthRaw = formData.get("maxWidth");
    const maxHeightRaw = formData.get("maxHeight");
    const maxWidth = maxWidthRaw ? Number(maxWidthRaw) : undefined;
    const maxHeight = maxHeightRaw ? Number(maxHeightRaw) : undefined;

    const buffer = Buffer.from(await file.arrayBuffer());

    // Validasi dini: pastikan file benar-benar gambar (bukan file acak / rusak)
    try {
      await sharp(buffer).metadata();
    } catch {
      return NextResponse.json(
        { error: "File bukan gambar yang valid" },
        { status: 400 },
      );
    }

    const result = await processImageWithSharp(buffer, {
      watermark,
      maxWidth: Number.isFinite(maxWidth) ? maxWidth : undefined,
      maxHeight: Number.isFinite(maxHeight) ? maxHeight : undefined,
    });

    const tempMediaId = ulid();
    const fileKey = buildTempMediaKey(tempMediaId);
    const variants = await generateImageVariants(result.buffer);

    await s3Client.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: fileKey,
        Body: result.buffer,
        ContentType: result.mimeType,
        // Temp media boleh di-cache browser tapi TIDAK immutable —
        // objek akan dipromosikan/dihapus scheduler.
        CacheControl: "public, max-age=3600",
      }),
    );
    await Promise.all(
      ([640, 1280] as const).map((width) =>
        s3Client.send(
          new PutObjectCommand(withImmutableCacheControl({
            Bucket: S3_BUCKET,
            Key: getVariantKey(fileKey, width),
            Body: variants[`w${width}`].buffer,
            ContentType: "image/webp",
          })),
        ),
      ),
    );

    logger.info(
      {
        key: fileKey,
        size: result.fileSize,
        width: result.width,
        height: result.height,
        watermarkApplied: result.watermarkApplied,
      },
      "process-temp: media temp dibuat",
    );

    return NextResponse.json(
      {
        success: true,
        tempMediaId,
        tempUrl: buildTempMediaViewUrl(tempMediaId),
        filename: `${tempMediaId}.webp`,
        size: result.fileSize,
        mimetype: result.mimeType,
      },
      { status: 201 },
    );
  } catch (error) {
    logger.error({ err: error }, "process-temp: gagal memproses gambar");
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: message || "Gagal memproses gambar" },
      { status: 500 },
    );
  }
}
