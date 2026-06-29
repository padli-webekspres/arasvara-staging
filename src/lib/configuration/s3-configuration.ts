import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { s3Client } from "@/lib/s3";
import logger from "@/lib/logger";
import { withImmutableCacheControl } from "@/lib/s3/object-cache";

// ── Constants ──────────────────────────────────────────────────────────────

const CONFIGURATION_BUCKET =
  process.env.S3_BUCKET_CONFIGURATION || "arasvara-configuration";

// ── Types ──────────────────────────────────────────────────────────────────

interface UploadConfigurationFileResult {
  storageKey: string;
  mimeType: string;
}

// ── Upload Configuration File ──────────────────────────────────────────────

/**
 * Upload configuration file (video, image, etc.) ke S3/MinIO
 * @param file File object dari request FormData
 * @param fileType Tipe file untuk naming (mis: "hero_video", "hero_thumbnail")
 * @returns Object dengan storageKey dan mimeType
 */
export async function uploadConfigurationFile(
  file: File,
  fileType: string,
): Promise<UploadConfigurationFileResult> {
  try {
    // Convert File ke Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Generate storage key dengan timestamp
    const timestamp = Date.now();
    const fileExtension = file.name.includes(".")
      ? file.name.substring(file.name.lastIndexOf("."))
      : "";
    const storageKey = `${fileType}_${timestamp}${fileExtension}`;

    // Upload ke S3/MinIO
    await s3Client.send(
      new PutObjectCommand(withImmutableCacheControl({
        Bucket: CONFIGURATION_BUCKET,
        Key: storageKey,
        Body: buffer,
        ContentType: file.type || "application/octet-stream",
      })),
    );

    logger.info(
      { fileType, storageKey, size: file.size },
      "Configuration file uploaded successfully",
    );

    return {
      storageKey,
      mimeType: file.type || "application/octet-stream",
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
 * Hapus configuration file dari S3/MinIO berdasarkan storageKey
 * @param storageKey Storage key dari konfigurasi lama
 */
export async function deleteConfigurationFile(
  storageKey: string,
): Promise<void> {
  try {
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: CONFIGURATION_BUCKET,
        Key: storageKey,
      }),
    );

    logger.info({ storageKey }, "Configuration file deleted successfully");
  } catch (error) {
    logger.error({ storageKey, error }, "Failed to delete configuration file");
    throw new Error(
      `Failed to delete configuration file: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}
