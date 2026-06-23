/**
 * Batch repair: file featured di R2 yang bukan WebP valid → re-encode in-place.
 *
 * Default: dry-run (tanpa write)
 * Lokal:    npm run migrate:webp-audit
 * Prod:     npm run migrate:webp-audit:prod
 * Execute:  tambahkan -- --execute
 */
import { config } from "dotenv";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { MongoClient } from "mongodb";
import type { WebpKeyAuditResult } from "../src/lib/image/ensureObjectStorageWebp";

function bootstrapEnv(): string {
  const envArg = process.argv
    .slice(2)
    .find((arg) => arg.startsWith("--env-file="));

  const envFile =
    envArg?.slice("--env-file=".length) ??
    process.env.DOTENV_CONFIG_PATH ??
    ".env";

  const envPath = resolve(process.cwd(), envFile);

  if (!existsSync(envPath)) {
    console.error(`Env file tidak ditemukan: ${envPath}`);
    process.exit(1);
  }

  const result = config({ path: envPath, quiet: true });
  if (result.error) {
    console.error(`Gagal load env dari ${envPath}:`, result.error);
    process.exit(1);
  }

  return envFile;
}

const loadedEnvFile = bootstrapEnv();

const args = process.argv
  .slice(2)
  .filter((arg) => !arg.startsWith("--env-file="));

const isExecute = args.includes("--execute") && !args.includes("--dry-run");
const isDryRun = !isExecute;

function parseLimit(): number | undefined {
  const arg = args.find((a) => a.startsWith("--limit="));
  if (!arg) return undefined;
  const n = Number.parseInt(arg.split("=")[1] ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function parseSingleKey(): string | undefined {
  const arg = args.find((a) => a.startsWith("--key="));
  if (!arg) return undefined;
  const key = arg.slice("--key=".length).trim();
  return key || undefined;
}

type Summary = {
  totalKeys: number;
  valid: number;
  wouldReencode: number;
  reencoded: number;
  notFound: number;
  errors: number;
  skipped: number;
};

function initSummary(): Summary {
  return {
    totalKeys: 0,
    valid: 0,
    wouldReencode: 0,
    reencoded: 0,
    notFound: 0,
    errors: 0,
    skipped: 0,
  };
}

function applyResult(summary: Summary, result: WebpKeyAuditResult): void {
  switch (result.status) {
    case "valid":
      summary.valid++;
      break;
    case "would_reencode":
      summary.wouldReencode++;
      break;
    case "reencoded":
      summary.reencoded++;
      break;
    case "not_found":
      summary.notFound++;
      break;
    case "error":
      summary.errors++;
      break;
    case "skipped":
      summary.skipped++;
      break;
    default:
      break;
  }
}

function redactEndpoint(endpoint?: string): string {
  if (!endpoint) return "(default AWS)";
  try {
    const url = new URL(endpoint);
    return `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ""}`;
  } catch {
    return "(invalid endpoint)";
  }
}

async function main() {
  const { ListObjectsV2Command } = await import("@aws-sdk/client-s3");
  const { s3Client, S3_BUCKET } = await import("../src/lib/s3");
  const { auditStorageWebpKey, shouldAuditPresignedKey } = await import(
    "../src/lib/image/ensureObjectStorageWebp"
  );
  const { collectPublishedFeaturedImageKeys, FEATURED_R2_PREFIX } = await import(
    "../src/lib/media/collectFeaturedImageKeys"
  );

  async function listFeaturedObjectKeys(): Promise<string[]> {
    const keys: string[] = [];
    let continuationToken: string | undefined;

    do {
      const response = await s3Client.send(
        new ListObjectsV2Command({
          Bucket: S3_BUCKET,
          Prefix: FEATURED_R2_PREFIX,
          ContinuationToken: continuationToken,
        }),
      );

      for (const obj of response.Contents ?? []) {
        if (obj.Key) keys.push(obj.Key);
      }

      continuationToken = response.IsTruncated
        ? response.NextContinuationToken
        : undefined;
    } while (continuationToken);

    return keys;
  }

  const mongoUrl = process.env.MONGO_URL;
  const dbName = process.env.DB_NAME || "arasvara_news";
  const limit = parseLimit();
  const singleKey = parseSingleKey();

  if (!mongoUrl && !singleKey) {
    console.error(
      "MONGO_URL tidak ditemukan di env (diperlukan untuk kumpulkan keys dari DB)",
    );
    process.exit(1);
  }

  console.log("=== Batch WebP Audit (featured) ===");
  console.log(`Env file: ${loadedEnvFile}`);
  console.log(`Mode: ${isExecute ? "EXECUTE (write ke R2)" : "DRY-RUN"}`);
  console.log(`Bucket: ${S3_BUCKET}`);
  console.log(`Endpoint: ${redactEndpoint(process.env.S3_ENDPOINT)}`);
  if (limit) console.log(`Limit: ${limit}`);
  if (singleKey) console.log(`Single key: ${singleKey}`);
  console.log("");

  let keys: string[];

  if (singleKey) {
    keys = [singleKey];
  } else {
    console.log("--- Mengumpulkan keys ---");
    const [r2Keys, dbKeys] = await Promise.all([
      listFeaturedObjectKeys(),
      (async () => {
        const client = new MongoClient(mongoUrl!);
        await client.connect();
        try {
          return await collectPublishedFeaturedImageKeys(client.db(dbName));
        } finally {
          await client.close();
        }
      })(),
    ]);

    const union = new Set<string>([...r2Keys, ...dbKeys]);
    keys = [...union].sort();
    console.log(`R2 prefix ${FEATURED_R2_PREFIX}: ${r2Keys.length} objek`);
    console.log(`MongoDB PUBLISHED featuredImage: ${dbKeys.length} key`);
    console.log(`Union (dedupe): ${keys.length} key\n`);
  }

  const auditableKeys = keys.filter((k) => shouldAuditPresignedKey(k));
  const skippedNotAuditable = keys.length - auditableKeys.length;
  if (skippedNotAuditable > 0) {
    console.log(`Dilewati (bukan key auditable): ${skippedNotAuditable}`);
  }

  const toProcess = limit ? auditableKeys.slice(0, limit) : auditableKeys;
  const summary = initSummary();
  summary.totalKeys = toProcess.length;

  const results: WebpKeyAuditResult[] = [];
  const problemSamples: WebpKeyAuditResult[] = [];

  console.log(`--- Memproses ${toProcess.length} key ---\n`);

  for (let i = 0; i < toProcess.length; i++) {
    const fileKey = toProcess[i];
    const result = await auditStorageWebpKey(fileKey, { dryRun: isDryRun });
    results.push(result);
    applyResult(summary, result);

    if (
      result.status === "would_reencode" ||
      result.status === "reencoded" ||
      result.status === "error" ||
      result.status === "not_found"
    ) {
      if (problemSamples.length < 30) {
        problemSamples.push(result);
      }
    }

    if (
      result.status === "would_reencode" ||
      result.status === "reencoded" ||
      result.status === "error"
    ) {
      const detail =
        result.status === "would_reencode"
          ? `format=${result.detectedFormat} ${result.originalSize}→~${result.estimatedFinalSize}b`
          : result.status === "reencoded"
            ? `format=${result.detectedFormat} ${result.originalSize}→${result.finalSize}b`
            : `error: ${result.message}`;
      console.log(`  [${i + 1}/${toProcess.length}] ${fileKey} — ${detail}`);
    }
  }

  console.log("\n--- Ringkasan ---");
  console.log(`Total keys     : ${summary.totalKeys}`);
  console.log(`Valid WebP     : ${summary.valid}`);
  if (isDryRun) {
    console.log(`Would fix      : ${summary.wouldReencode}`);
  } else {
    console.log(`Re-encoded     : ${summary.reencoded}`);
  }
  console.log(`Not found      : ${summary.notFound}`);
  console.log(`Errors         : ${summary.errors}`);
  console.log(`Skipped        : ${summary.skipped}`);

  if (problemSamples.length > 0) {
    console.log("\n--- Sample masalah (max 30) ---");
    for (const r of problemSamples) {
      console.log(`  ${JSON.stringify(r)}`);
    }
  }

  const outputDir = join(process.cwd(), "scripts", "output");
  try {
    mkdirSync(outputDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const reportPath = join(outputDir, `webp-audit-${stamp}.json`);
    writeFileSync(
      reportPath,
      JSON.stringify(
        {
          mode: isExecute ? "execute" : "dry-run",
          envFile: loadedEnvFile,
          bucket: S3_BUCKET,
          summary,
          results,
        },
        null,
        2,
      ),
    );
    console.log(`\nLaporan JSON: ${reportPath}`);
  } catch (err) {
    console.warn("Gagal menulis laporan JSON:", err);
  }

  if (isDryRun) {
    console.log(
      `\nDRY-RUN selesai. ${summary.wouldReencode} file perlu diperbaiki. Jalankan dengan --execute untuk menulis ke R2.`,
    );
  } else {
    console.log("\nEXECUTE selesai.");
  }

  if (summary.errors > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
