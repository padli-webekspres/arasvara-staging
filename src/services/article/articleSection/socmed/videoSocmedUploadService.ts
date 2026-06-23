import { S3_BUCKET, s3Client } from "@/lib/s3";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { ulid } from "ulid";
import logger from "@/lib/logger";
import {
  getSharpThumbnailSize,
  getSocmedLayout,
  type SocmedPlatform,
} from "@/lib/socmed-video-layout";

/**
 * Response from video thumbnail upload
 */
export interface VideoThumbnailUploadResult {
  url: string;
  filename: string;
}

/**
 * Upload dan compress video thumbnail ke folder spesifik di S3
 * Folder path: thumbnails/{platform}/{filename}
 * Image dikompres dengan sharp: cover ke 9:16 (IG/TikTok) atau 16:9 (YouTube), webp q80.
 */
export async function uploadVideoThumbnail(
  file: File,
  platform: SocmedPlatform,
): Promise<VideoThumbnailUploadResult> {
  if (!file.type.startsWith("image/")) {
    throw new Error("File harus berupa gambar");
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    let buffer: Buffer = Buffer.from(arrayBuffer as ArrayBuffer);

    const layout = getSocmedLayout(platform);
    const { width, height } = getSharpThumbnailSize(layout);
    const sharp = (await import("sharp")).default;
    buffer = (await sharp(buffer)
      .resize({ width, height, fit: "cover" })
      .webp({ quality: 80 })
      .toBuffer()) as Buffer;

    // Generate filename dengan ULID untuk uniqueness
    const uniqueId = ulid();
    const filename = `${uniqueId}.webp`;
    const s3Key = `thumbnails/${platform}/${filename}`;

    // Upload ke S3
    await s3Client.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: s3Key,
        Body: buffer,
        ContentType: "image/webp",
      }),
    );

    // Build URL endpoint untuk fetch
    const url = `/api/media/view?key=${s3Key}`;

    logger.info(
      { platform, s3Key, filename },
      "Video thumbnail uploaded successfully",
    );

    return { url, filename };
  } catch (error) {
    logger.error({ platform, error }, "Error uploading video thumbnail");
    throw error;
  }
}
