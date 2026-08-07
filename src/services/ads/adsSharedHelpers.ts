/**
 * adsSharedHelpers.ts
 *
 * Fungsi dan konstanta S3 yang dipakai bersama oleh AdsHomepageService
 * dan AdsSingleArticleService agar tidak ada duplikasi kode.
 */

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ulid } from "ulid";
import { s3Client, S3_BUCKET } from "@/lib/s3";
import logger from "@/lib/logger";
import { withImmutableCacheControl } from "@/lib/s3/object-cache";
import type {
  AdsHomepageFinalizeResponse,
  AdsHomepagePresignResponse,
} from "@/types/ads";

// ─── Konstanta ────────────────────────────────────────────────────────────────

/** Durasi presigned URL (detik). */
export const PRESIGN_EXPIRES_IN = 5 * 60;

// ─── Utility functions ────────────────────────────────────────────────────────

/** Ambil nama file dari path S3 dan bersihkan karakter ilegal. */
export function sanitizeFilename(raw: string): string {
  return (raw.split("/").pop() ?? raw)
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "");
}

/** Tebak ekstensi file dari MIME type. */
export function guessExtFromMime(mime: string): string {
  const map: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/avif": ".avif",
    "image/heic": ".heic",
  };
  return map[mime.toLowerCase()] ?? "";
}

/** Tambahkan `status` HTTP pada Error agar bisa dibaca route handler. */
export function withStatus(err: Error, status: number): Error & { status: number } {
  return Object.assign(err, { status });
}

/**
 * Hapus satu objek dari S3 secara best-effort.
 * Kegagalan hanya dicatat ke log — tidak melempar error ke caller.
 */
export async function deleteS3BannerSafe(fileKey: string): Promise<void> {
  if (!fileKey?.trim()) return;
  try {
    await s3Client.send(
      new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: fileKey }),
    );
    logger.info({ fileKey }, "S3 banner dihapus");
  } catch (err) {
    logger.warn(
      { err, fileKey },
      "Gagal menghapus S3 banner (non-fatal) — objek mungkin sudah tidak ada",
    );
  }
}

// ─── S3 media operations ──────────────────────────────────────────────────────

/**
 * Hasilkan presigned PUT URL ke folder `incoming` S3 yang diberikan.
 * Client melakukan PUT bytes langsung; server tidak menerima bytes.
 *
 * @param s3PrefixIncoming - mis. `"ads/homepage/incoming"` atau `"ads/article/incoming"`
 */
export async function generatePresignedUrl(
  filename: string,
  contentType: string,
  s3PrefixIncoming: string,
): Promise<AdsHomepagePresignResponse> {
  const mime = contentType.trim().toLowerCase();

  if (!mime.startsWith("image/")) {
    throw withStatus(
      new Error("Hanya file gambar (image/*) yang diizinkan untuk banner"),
      400,
    );
  }
  if (mime === "image/svg+xml" || mime === "image/svg") {
    throw withStatus(
      new Error("SVG tidak diizinkan sebagai banner iklan"),
      400,
    );
  }

  const safeBase = sanitizeFilename(filename) || "banner";
  const dotIdx = safeBase.lastIndexOf(".");
  const baseName = dotIdx > 0 ? safeBase.slice(0, dotIdx) : safeBase;
  const ext = dotIdx > 0 ? safeBase.slice(dotIdx) : guessExtFromMime(mime);

  const key = `${s3PrefixIncoming}/${Date.now()}-${ulid()}-${baseName}${ext}`;

  const uploadUrl = await getSignedUrl(
    s3Client,
    new PutObjectCommand(withImmutableCacheControl({
      Bucket: S3_BUCKET,
      Key: key,
      ContentType: mime,
    })),
    { expiresIn: PRESIGN_EXPIRES_IN },
  );

  logger.info({ key }, "adsSharedHelpers: presigned URL generated");

  return {
    uploadUrl,
    fileKey: key,
    expiresIn: PRESIGN_EXPIRES_IN,
  };
}

/**
 * Ambil file dari folder `incoming`, konversi ke WebP, upload ke folder final,
 * lalu hapus file incoming (best-effort).
 *
 * @param s3PrefixIncoming - mis. `"ads/homepage/incoming"`
 * @param s3PrefixFinal    - mis. `"ads/homepage"` atau `"ads/article"`
 */
export async function finalizeMedia(
  fileKey: string,
  s3PrefixIncoming: string,
  s3PrefixFinal: string,
): Promise<AdsHomepageFinalizeResponse> {
  const key = fileKey.trim();

  if (!key.startsWith(`${s3PrefixIncoming}/`)) {
    throw withStatus(
      new Error(
        `fileKey tidak valid — harus diawali dengan "${s3PrefixIncoming}/"`,
      ),
      400,
    );
  }

  // 1. Download dari incoming
  const getResponse = await s3Client.send(
    new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }),
  );

  if (!getResponse.Body) {
    throw withStatus(new Error("Objek S3 tidak ditemukan atau kosong"), 404);
  }

  const rawBuffer = Buffer.from(
    await getResponse.Body.transformToByteArray(),
  );

  // 2. Konversi ke WebP + varian responsif
  const {
    generateImageVariants,
    getVariantKey,
    RESPONSIVE_IMAGE_WIDTHS,
  } = await import("@/lib/image/generateImageVariants");

  const variants = await generateImageVariants(rawBuffer);
  const finalKey = `${s3PrefixFinal}/${ulid()}.webp`;

  await Promise.all([
    s3Client.send(
      new PutObjectCommand(
        withImmutableCacheControl({
          Bucket: S3_BUCKET,
          Key: finalKey,
          Body: variants.original.buffer,
          ContentType: "image/webp",
          ContentLength: variants.original.buffer.length,
        }),
      ),
    ),
    ...RESPONSIVE_IMAGE_WIDTHS.map((width) =>
      s3Client.send(
        new PutObjectCommand(
          withImmutableCacheControl({
            Bucket: S3_BUCKET,
            Key: getVariantKey(finalKey, width),
            Body: variants[`w${width}`].buffer,
            ContentType: "image/webp",
          }),
        ),
      ),
    ),
  ]);

  // 4. Hapus file incoming (best-effort)
  try {
    await s3Client.send(
      new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }),
    );
  } catch (delErr) {
    logger.warn(
      { err: delErr, key },
      "adsSharedHelpers: gagal hapus incoming setelah finalize (non-fatal)",
    );
  }

  // 5. Buat URL publik melalui route API view lokal
  // NOTE: keep response shape — finalKey is original webp
  const viewUrl = `/api/media/view?key=${encodeURIComponent(finalKey)}`;

  logger.info(
    { finalKey, bytes: variants.original.buffer.length },
    "adsSharedHelpers: banner finalized",
  );

  return {
    fileKey: finalKey,
    banner: {
      url: viewUrl,
      filename: finalKey,
      mimetype: "image/webp",
      size: variants.original.buffer.length,
    },
  };
}
