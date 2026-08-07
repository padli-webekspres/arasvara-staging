/**
 * Backfill CDN width variants (`-w640.webp`, `-w1280.webp`) from original WebP keys.
 *
 * Dry-run (default): npm run backfill:image-variants
 * Execute:           npm run backfill:image-variants -- --execute
 * Limit:             npm run backfill:image-variants -- --limit=50
 * Configuration:     npm run backfill:image-variants -- --bucket=configuration
 *
 * Env di-load via `node --env-file=...` (lihat package.json) SEBELUM module init,
 * karena `s3Client` membaca credentials saat di-import.
 * Default menolak endpoint non-lokal; set ALLOW_REMOTE_BACKFILL=1 untuk R2.
 */
import {
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { s3Client, S3_BUCKET } from "../src/lib/s3";
import {
  generateImageVariants,
  getVariantKey,
  RESPONSIVE_IMAGE_WIDTHS,
  type ResponsiveImageWidth,
} from "../src/lib/image/generateImageVariants";

/** Jangan import object-cache.ts — file itu meng-import s3Client di top-level. */
const S3_IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";

const execute = process.argv.includes("--execute");
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : Infinity;
const bucketArg = process.argv.find((arg) => arg.startsWith("--bucket="));
const bucketChoice = bucketArg?.split("=")[1]?.toLowerCase() ?? "media";

const CONFIGURATION_BUCKET =
  process.env.S3_BUCKET_CONFIGURATION || "arasvara-configuration";
const targetBucket =
  bucketChoice === "configuration" ? CONFIGURATION_BUCKET : S3_BUCKET;
const DELAY_MS = 50;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assertLocalEndpointOrAllowed(): void {
  const endpoint = process.env.S3_ENDPOINT || "";
  if (!endpoint) {
    throw new Error("S3_ENDPOINT kosong. Isi endpoint MinIO lokal di .env.");
  }
  if (!process.env.S3_ACCESS_KEY?.trim() || !process.env.S3_SECRET_KEY?.trim()) {
    throw new Error(
      "S3_ACCESS_KEY / S3_SECRET_KEY kosong. Pastikan script dijalankan dengan --env-file=.env",
    );
  }

  let host = endpoint;
  try {
    host = new URL(endpoint).hostname;
  } catch {
    // keep raw
  }

  const isLocal =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "host.docker.internal" ||
    host.startsWith("192.168.") ||
    host.startsWith("10.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host);

  if (!isLocal && process.env.ALLOW_REMOTE_BACKFILL !== "1") {
    throw new Error(
      `Menolak backfill ke endpoint non-lokal (${host}). ` +
        `Untuk production/R2 set ALLOW_REMOTE_BACKFILL=1 secara eksplisit.`,
    );
  }

  console.log(`S3 endpoint host=${host} local=${isLocal} execute=${execute}`);
}

async function bodyToBuffer(body: unknown): Promise<Buffer> {
  if (!body || typeof body !== "object" || !("transformToByteArray" in body)) {
    throw new Error("S3 response tidak memiliki body yang dapat dibaca");
  }
  const bytes = await (
    body as { transformToByteArray: () => Promise<Uint8Array> }
  ).transformToByteArray();
  return Buffer.from(bytes);
}

async function objectExists(key: string): Promise<boolean> {
  try {
    await s3Client.send(
      new HeadObjectCommand({ Bucket: targetBucket, Key: key }),
    );
    return true;
  } catch {
    return false;
  }
}

async function listOriginalWebpKeys(): Promise<string[]> {
  const keys: string[] = [];
  let continuationToken: string | undefined;

  do {
    const listed = await s3Client.send(
      new ListObjectsV2Command({
        Bucket: targetBucket,
        ContinuationToken: continuationToken,
      }),
    );

    for (const item of listed.Contents ?? []) {
      const key = item.Key;
      if (!key) continue;
      if (!/\.webp$/i.test(key)) continue;
      if (/-w(?:640|1280)\.webp$/i.test(key)) continue;
      keys.push(key);
      if (keys.length >= limit) {
        return keys;
      }
    }

    continuationToken = listed.IsTruncated
      ? listed.NextContinuationToken
      : undefined;
  } while (continuationToken);

  return keys;
}

async function main(): Promise<void> {
  assertLocalEndpointOrAllowed();

  console.log(
    `Backfill target bucket=${targetBucket} (mode=${bucketChoice}, execute=${execute})`,
  );

  const originals = await listOriginalWebpKeys();
  let processed = 0;
  let skipped = 0;
  let failed = 0;

  for (const key of originals) {
    const variantKeys = RESPONSIVE_IMAGE_WIDTHS.map((width) =>
      getVariantKey(key, width),
    );
    const missing: ResponsiveImageWidth[] = [];

    for (const width of RESPONSIVE_IMAGE_WIDTHS) {
      const variantKey = getVariantKey(key, width);
      if (!(await objectExists(variantKey))) {
        missing.push(width);
      }
    }

    if (missing.length === 0) {
      skipped++;
      console.log(`[skip] ${key} (varian sudah ada)`);
      continue;
    }

    if (!execute) {
      console.log(
        `[dry-run] ${key} -> missing ${missing.map((w) => `-w${w}`).join(", ")}`,
      );
      processed++;
      continue;
    }

    try {
      const response = await s3Client.send(
        new GetObjectCommand({ Bucket: targetBucket, Key: key }),
      );
      const variants = await generateImageVariants(
        await bodyToBuffer(response.Body),
      );
      await Promise.all(
        missing.map((width) =>
          s3Client.send(
            new PutObjectCommand({
              Bucket: targetBucket,
              Key: getVariantKey(key, width),
              Body: variants[`w${width}`].buffer,
              ContentType: "image/webp",
              CacheControl: S3_IMMUTABLE_CACHE_CONTROL,
            }),
          ),
        ),
      );
      processed++;
      console.log(`[done] ${key} (${variantKeys.join(", ")})`);
    } catch (error) {
      failed++;
      console.error(`[fail] ${key}`, error);
    }

    await sleep(DELAY_MS);
  }

  console.log(
    `${execute ? "Backfill selesai" : "Dry-run selesai"}: ` +
      `bucket=${targetBucket} candidates=${originals.length} processed=${processed} skipped=${skipped} failed=${failed}`,
  );

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
