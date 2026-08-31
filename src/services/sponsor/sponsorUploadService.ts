import { S3_BUCKET, s3Client } from "@/lib/s3";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { ulid } from "ulid";
import logger from "@/lib/logger";
import { withImmutableCacheControl } from "@/lib/s3/object-cache";
import { assertDecodableImage } from "@/lib/image/detectImageFormat";

export interface SponsorImageUploadResult {
  url: string;
  filename: string;
}

/**
 * Upload dan compress sponsor image ke folder spesifik di S3
 * Folder path: sponsors/{filename}
 * Image dicompress dengan sharp: webp, quality 80, maximum width 800px untuk optimasi
 */
export async function uploadSponsorImage(
  file: File,
): Promise<SponsorImageUploadResult> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    let buffer: Buffer = Buffer.from(arrayBuffer as ArrayBuffer);
    assertDecodableImage(file.type, buffer);

    // Compress dengan sharp
    // Sponsor image biasanya logo, jadi disesuaikan (misal max width 800px, jaga aspect ratio)
    const sharp = (await import("sharp")).default;
    buffer = (await sharp(buffer)
      .resize({ width: 800, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer()) as Buffer;

    // Generate filename dengan ULID
    const uniqueId = ulid();
    const filename = `${uniqueId}.webp`;
    const s3Key = `sponsors/${filename}`;

    // Upload ke S3
    await s3Client.send(
      new PutObjectCommand(withImmutableCacheControl({
        Bucket: S3_BUCKET,
        Key: s3Key,
        Body: buffer,
        ContentType: "image/webp",
      })),
    );

    // Build URL endpoint untuk fetch
    const url = `/api/media/view?key=${s3Key}`;

    logger.info(
      { s3Key, filename },
      "Sponsor image uploaded successfully",
    );

    return { url, filename };
  } catch (error) {
    logger.error({ error }, "Error uploading sponsor image");
    throw error;
  }
}
