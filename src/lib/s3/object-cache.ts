import {
  CopyObjectCommand,
  HeadObjectCommand,
  PutObjectCommandInput,
} from "@aws-sdk/client-s3";
import { s3Client } from "@/lib/s3";

export const S3_IMMUTABLE_CACHE_CONTROL =
  "public, max-age=31536000, immutable" as const;

/**
 * Tambahkan kebijakan cache immutable ke input PutObjectCommand.
 * Gunakan helper ini agar semua upload publik konsisten.
 */
export function withImmutableCacheControl<T extends PutObjectCommandInput>(
  input: T,
): T {
  return {
    ...input,
    CacheControl: S3_IMMUTABLE_CACHE_CONTROL,
  };
}

/**
 * Pastikan object di bucket punya Cache-Control immutable.
 * Jika belum sesuai, lakukan self-copy dengan MetadataDirective REPLACE.
 */
export async function ensureObjectCacheControl(
  bucket: string,
  key: string,
): Promise<void> {
  const head = await s3Client.send(
    new HeadObjectCommand({ Bucket: bucket, Key: key }),
  );

  if (head.CacheControl === S3_IMMUTABLE_CACHE_CONTROL) {
    return;
  }

  const copySource = `${bucket}/${key}`
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  await s3Client.send(
    new CopyObjectCommand({
      Bucket: bucket,
      Key: key,
      CopySource: copySource,
      ContentType: head.ContentType,
      MetadataDirective: "REPLACE",
      CacheControl: S3_IMMUTABLE_CACHE_CONTROL,
    }),
  );
}
