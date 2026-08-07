import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { s3Client } from "@/lib/s3";
import logger from "@/lib/logger";
import { withImmutableCacheControl } from "@/lib/s3/object-cache";
import {
  generateImageVariants,
  getVariantKey,
  RESPONSIVE_IMAGE_WIDTHS,
} from "@/lib/image/generateImageVariants";

// ── Constants ──────────────────────────────────────────────────────────────

const CONFIGURATION_BUCKET =
  process.env.S3_BUCKET_CONFIGURATION || "arasvara-configuration";

// ── Types ──────────────────────────────────────────────────────────────────

interface UploadConfigurationFileResult {
  storageKey: string;
  mimeType: string;
  width?: number;
  height?: number;
}

function isImageUpload(file: File): boolean {
  return (
    file.type.startsWith("image/") ||
    /\.(webp|jpe?g|png|gif|avif)$/i.test(file.name)
  );
}

function variantKeysFor(storageKey: string): string[] {
  if (!/\.webp$/i.test(storageKey)) return [];
  if (/-w(?:640|1280)\.webp$/i.test(storageKey)) return [];
  return RESPONSIVE_IMAGE_WIDTHS.map((width) =>
    getVariantKey(storageKey, width),
  );
}

// ── Upload Configuration File ──────────────────────────────────────────────

/**
 * Upload configuration file (video, image, etc.) ke S3/MinIO.
 * Image juga menulis varian `-w640` / `-w1280` (penting untuk LCP hero poster).
 */
export async function uploadConfigurationFile(
  file: File,
  fileType: string,
): Promise<UploadConfigurationFileResult> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    let buffer: Buffer = Buffer.from(arrayBuffer);
    let contentType = file.type || "application/octet-stream";
    const timestamp = Date.now();
    let width: number | undefined;
    let height: number | undefined;

    let storageKey: string;

    if (isImageUpload(file)) {
      const variants = await generateImageVariants(buffer);
      buffer = variants.original.buffer;
      contentType = "image/webp";
      width = variants.original.width;
      height = variants.original.height;
      storageKey = `${fileType}_${timestamp}.webp`;

      await Promise.all(
        RESPONSIVE_IMAGE_WIDTHS.map((w) =>
          s3Client.send(
            new PutObjectCommand(
              withImmutableCacheControl({
                Bucket: CONFIGURATION_BUCKET,
                Key: getVariantKey(storageKey, w),
                Body: variants[`w${w}`].buffer,
                ContentType: "image/webp",
              }),
            ),
          ),
        ),
      );
    } else {
      const fileExtension = file.name.includes(".")
        ? file.name.substring(file.name.lastIndexOf("."))
        : "";
      storageKey = `${fileType}_${timestamp}${fileExtension}`;
    }

    await s3Client.send(
      new PutObjectCommand(
        withImmutableCacheControl({
          Bucket: CONFIGURATION_BUCKET,
          Key: storageKey,
          Body: buffer,
          ContentType: contentType,
        }),
      ),
    );

    logger.info(
      { fileType, storageKey, size: buffer.length, contentType, width, height },
      "Configuration file uploaded successfully",
    );

    return {
      storageKey,
      mimeType: contentType,
      width,
      height,
    };
  } catch (error) {
    logger.error({ fileType, error }, "Failed to upload configuration file");
    throw new Error(
      `Failed to upload configuration file: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

// ── Delete Configuration File ──────────────────────────────────────────────

/**
 * Hapus configuration file (+ varian responsif bila ada) dari S3/MinIO.
 */
export async function deleteConfigurationFile(
  storageKey: string,
): Promise<void> {
  const keys = [storageKey, ...variantKeysFor(storageKey)];

  try {
    await Promise.all(
      keys.map((key) =>
        s3Client.send(
          new DeleteObjectCommand({
            Bucket: CONFIGURATION_BUCKET,
            Key: key,
          }),
        ),
      ),
    );

    logger.info(
      { storageKey, keys },
      "Configuration file deleted successfully",
    );
  } catch (error) {
    logger.error({ storageKey, error }, "Failed to delete configuration file");
    throw new Error(
      `Failed to delete configuration file: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}
