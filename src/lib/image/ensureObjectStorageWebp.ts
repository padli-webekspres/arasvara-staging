import {
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import sharp from "sharp";
import { s3Client, S3_BUCKET } from "@/lib/s3";
import {
  detectImageFormat,
  isValidWebpBuffer,
  type DetectedImageFormat,
} from "@/lib/image/detectImageFormat";
import { isAllowedArticleUploadFolder } from "@/lib/media/articleUploadScopes";
import { MAX_IMAGE_SIZE_BYTES } from "@/lib/helper-article";
import logger from "@/lib/logger";

export type PresignedWebpAuditResult = {
  size: number;
  reencoded: boolean;
  detectedFormat: DetectedImageFormat;
};

export type WebpKeyAuditResult =
  | { status: "skipped"; fileKey: string; reason: "not_auditable" | "too_large" }
  | { status: "not_found"; fileKey: string }
  | { status: "valid"; fileKey: string; detectedFormat: DetectedImageFormat; size: number }
  | {
      status: "would_reencode";
      fileKey: string;
      detectedFormat: DetectedImageFormat;
      sharpFormat: string | null;
      originalSize: number;
      estimatedFinalSize: number;
    }
  | {
      status: "reencoded";
      fileKey: string;
      detectedFormat: DetectedImageFormat;
      sharpFormat: string | null;
      originalSize: number;
      finalSize: number;
    }
  | { status: "error"; fileKey: string; message: string };

export type AuditStorageWebpOptions = {
  dryRun?: boolean;
  maxSizeBytes?: number;
};

/** True jika key layak diaudit (folder artikel atau berakhiran .webp). */
export function shouldAuditPresignedKey(fileKey: string): boolean {
  const normalized = fileKey.replace(/^\/+/, "");
  const firstSegment = normalized.split("/")[0] ?? "";

  if (isAllowedArticleUploadFolder(firstSegment)) {
    return true;
  }

  return normalized.toLowerCase().endsWith(".webp");
}

async function streamToBuffer(
  body: ReadableStream | NodeJS.ReadableStream | Blob | undefined,
): Promise<Buffer> {
  if (!body) {
    throw new Error("Empty object body from storage");
  }

  if (body instanceof Blob) {
    return Buffer.from(await body.arrayBuffer());
  }

  const chunks: Buffer[] = [];
  for await (const chunk of body as AsyncIterable<Buffer | Uint8Array | string>) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function isNoSuchKeyError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const name = (err as { name?: string }).name;
  const code = (err as { Code?: string; $metadata?: { httpStatusCode?: number } }).Code;
  const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata
    ?.httpStatusCode;
  return (
    name === "NoSuchKey" ||
    code === "NoSuchKey" ||
    status === 404
  );
}

/** Validasi buffer adalah WebP asli (magic bytes + metadata Sharp). */
export async function isBufferValidWebp(buffer: Buffer): Promise<boolean> {
  if (!isValidWebpBuffer(buffer)) return false;
  const sharpMeta = await sharp(buffer).metadata();
  return sharpMeta.format === "webp";
}

/** Re-encode buffer gambar ke WebP. */
export async function reencodeBufferToWebp(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer).rotate().webp({ quality: 80 }).toBuffer();
}

/**
 * Audit satu object key di R2/S3. Jika bukan WebP valid dan dryRun=false, overwrite key.
 */
export async function auditStorageWebpKey(
  fileKey: string,
  options: AuditStorageWebpOptions = {},
): Promise<WebpKeyAuditResult> {
  const { dryRun = false, maxSizeBytes = MAX_IMAGE_SIZE_BYTES } = options;

  if (!shouldAuditPresignedKey(fileKey)) {
    return { status: "skipped", fileKey, reason: "not_auditable" };
  }

  let getResponse;
  try {
    getResponse = await s3Client.send(
      new GetObjectCommand({
        Bucket: S3_BUCKET,
        Key: fileKey,
      }),
    );
  } catch (err) {
    if (isNoSuchKeyError(err)) {
      return { status: "not_found", fileKey };
    }
    const message = err instanceof Error ? err.message : String(err);
    return { status: "error", fileKey, message };
  }

  let originalBuffer: Buffer;
  try {
    originalBuffer = await streamToBuffer(
      getResponse.Body as ReadableStream | NodeJS.ReadableStream | undefined,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: "error", fileKey, message };
  }

  if (originalBuffer.length > maxSizeBytes) {
    return { status: "skipped", fileKey, reason: "too_large" };
  }

  const detectedFormat = detectImageFormat(originalBuffer);

  try {
    const validWebp = await isBufferValidWebp(originalBuffer);
    if (validWebp) {
      return {
        status: "valid",
        fileKey,
        detectedFormat,
        size: originalBuffer.length,
      };
    }

    const sharpMeta = await sharp(originalBuffer).metadata();
    const reencodedBuffer = await reencodeBufferToWebp(originalBuffer);

    if (dryRun) {
      return {
        status: "would_reencode",
        fileKey,
        detectedFormat,
        sharpFormat: sharpMeta.format ?? null,
        originalSize: originalBuffer.length,
        estimatedFinalSize: reencodedBuffer.length,
      };
    }

    await s3Client.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: fileKey,
        Body: reencodedBuffer,
        ContentType: "image/webp",
      }),
    );

    logger.warn(
      {
        event: "presigned_upload_format_audit",
        fileKey,
        detectedFormat,
        sharpFormat: sharpMeta.format ?? null,
        reencoded: true,
        originalSize: originalBuffer.length,
        finalSize: reencodedBuffer.length,
      },
      "Storage object re-encoded to WebP",
    );

    return {
      status: "reencoded",
      fileKey,
      detectedFormat,
      sharpFormat: sharpMeta.format ?? null,
      originalSize: originalBuffer.length,
      finalSize: reencodedBuffer.length,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: "error", fileKey, message };
  }
}

/**
 * Verifikasi objek presigned di R2/S3 adalah WebP valid.
 * Jika tidak, re-encode dengan Sharp dan overwrite key yang sama.
 */
export async function ensurePresignedUploadIsWebp(
  fileKey: string,
  clientDeclaredSize?: number,
): Promise<PresignedWebpAuditResult> {
  if (!shouldAuditPresignedKey(fileKey)) {
    return {
      size: clientDeclaredSize ?? 0,
      reencoded: false,
      detectedFormat: "unknown",
    };
  }

  const result = await auditStorageWebpKey(fileKey, { dryRun: false });

  switch (result.status) {
    case "valid":
      return {
        size: result.size,
        reencoded: false,
        detectedFormat: result.detectedFormat,
      };
    case "reencoded":
      return {
        size: result.finalSize,
        reencoded: true,
        detectedFormat: result.detectedFormat,
      };
    case "would_reencode":
      return {
        size: result.estimatedFinalSize,
        reencoded: true,
        detectedFormat: result.detectedFormat,
      };
    case "not_found":
      throw Object.assign(new Error(`Object not found: ${fileKey}`), {
        status: 404,
      });
    case "error":
      throw new Error(result.message);
    case "skipped":
      return {
        size: clientDeclaredSize ?? 0,
        reencoded: false,
        detectedFormat: "unknown",
      };
    default:
      return {
        size: clientDeclaredSize ?? 0,
        reencoded: false,
        detectedFormat: "unknown",
      };
  }
}
