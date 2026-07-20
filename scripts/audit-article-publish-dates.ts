/**
 * Audit tanggal publish artikel vs path URL / schedule / contentUpdatedAt.
 *
 * Default: dry-run (read-only)
 * Lokal: npm run audit:article-publish-dates
 * Prod:  npm run audit:article-publish-dates:prod
 *
 * Exit code 1 jika ada pathDateMismatch (kritis).
 */
import { MongoClient } from "mongodb";
import { bootstrapEnv } from "./bootstrap-env";
import {
  isStructuredPublicPath,
  publishedAtToWibDateParts,
} from "../src/lib/article-public-path";
import { ArticleStatus } from "../src/types/article";

const loadedEnvFile = bootstrapEnv();

type AuditRow = {
  _id: string;
  slug: string;
  publicPath: string | null;
  publishedAt: string | null;
  scheduledAt: string | null;
  contentUpdatedAt: string | null;
  pathDateMismatch: boolean;
  suspiciousScheduleOffset: boolean;
  contentUpdatedAtMissing: boolean;
  issues: string[];
};

function coerceDate(value: unknown): Date | null {
  if (value == null) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function extractPathDateParts(
  publicPath: string | null,
): { year: number; month: number; day: number } | null {
  if (!publicPath || !isStructuredPublicPath(publicPath)) return null;
  const parts = publicPath.replace(/^\/+/, "").split("/");
  // structured: category/yyyy/mm/dd/slug
  if (parts.length < 5) return null;
  const year = Number(parts[1]);
  const month = Number(parts[2]);
  const day = Number(parts[3]);
  if (
    [year, month, day].some((n) => Number.isNaN(n)) ||
    year < 2000 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }
  return { year, month, day };
}

function hadScheduledRevision(revisionHistory: unknown): boolean {
  if (!Array.isArray(revisionHistory)) return false;
  return revisionHistory.some((entry) => {
    if (!entry || typeof entry !== "object") return false;
    const e = entry as { to?: string; from?: string };
    return e.to === ArticleStatus.SCHEDULED || e.from === ArticleStatus.SCHEDULED;
  });
}

async function main() {
  const mongoUrl = process.env.MONGO_URL;
  const dbName = process.env.DB_NAME || "arasvara_news";

  if (!mongoUrl) {
    console.error("MONGO_URL tidak ditemukan di .env");
    process.exit(1);
  }

  console.log("=== Audit tanggal publish artikel ===");
  console.log(`Env file : ${loadedEnvFile}`);
  console.log(`Database : ${dbName}`);
  console.log("Mode: AUDIT (read-only)\n");

  const client = new MongoClient(mongoUrl);
  await client.connect();
  const db = client.db(dbName);

  try {
    const docs = await db
      .collection("articles")
      .find({
        status: ArticleStatus.PUBLISHED,
        $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }],
      })
      .project({
        slug: 1,
        publicPath: 1,
        publishedAt: 1,
        scheduledAt: 1,
        contentUpdatedAt: 1,
        revisionHistory: 1,
      })
      .toArray();

    const rows: AuditRow[] = [];
    let pathMismatchCount = 0;
    let scheduleAnomalyCount = 0;
    let missingContentUpdatedAt = 0;

    for (const doc of docs) {
      const issues: string[] = [];
      const publishedAt = coerceDate(doc.publishedAt);
      const scheduledAt = coerceDate(doc.scheduledAt);
      const contentUpdatedAt = coerceDate(doc.contentUpdatedAt);
      const publicPath = doc.publicPath ? String(doc.publicPath).trim() : null;
      const slug = String(doc.slug ?? "").trim();

      let pathDateMismatch = false;
      if (publishedAt && publicPath && isStructuredPublicPath(publicPath)) {
        const pathParts = extractPathDateParts(publicPath);
        const wibParts = publishedAtToWibDateParts(publishedAt);
        if (pathParts && wibParts) {
          if (
            pathParts.year !== wibParts.year ||
            pathParts.month !== wibParts.month ||
            pathParts.day !== wibParts.day
          ) {
            pathDateMismatch = true;
            issues.push(
              `pathDateMismatch: path=${pathParts.year}-${String(pathParts.month).padStart(2, "0")}-${String(pathParts.day).padStart(2, "0")} vs WIB publishedAt=${wibParts.year}-${String(wibParts.month).padStart(2, "0")}-${String(wibParts.day).padStart(2, "0")}`,
            );
            pathMismatchCount += 1;
          }
        }
      }

      let suspiciousScheduleOffset = false;
      if (
        publishedAt &&
        scheduledAt &&
        hadScheduledRevision(doc.revisionHistory)
      ) {
        const diffMs = Math.abs(publishedAt.getTime() - scheduledAt.getTime());
        // Anomali: selisih > 1 menit antara publishedAt dan scheduledAt yang tersisa
        // (normal: publish terjadwal menyalin scheduledAt → publishedAt, scheduledAt di-null)
        // Jika scheduledAt masih terisi setelah PUBLISHED, flag ringan.
        if (diffMs > 60_000) {
          suspiciousScheduleOffset = true;
          issues.push(
            `suspiciousScheduleOffset: publishedAt vs scheduledAt selisih ${Math.round(diffMs / 60000)} menit`,
          );
          scheduleAnomalyCount += 1;
        }
      }

      const contentUpdatedAtMissing = !contentUpdatedAt;
      if (contentUpdatedAtMissing) {
        missingContentUpdatedAt += 1;
        issues.push("contentUpdatedAtMissing");
      }

      if (!publishedAt) {
        issues.push("publishedAt null pada PUBLISHED");
      }

      if (issues.length === 0) continue;

      rows.push({
        _id: String(doc._id),
        slug,
        publicPath,
        publishedAt: publishedAt?.toISOString() ?? null,
        scheduledAt: scheduledAt?.toISOString() ?? null,
        contentUpdatedAt: contentUpdatedAt?.toISOString() ?? null,
        pathDateMismatch,
        suspiciousScheduleOffset,
        contentUpdatedAtMissing,
        issues,
      });
    }

    console.log(`Total PUBLISHED : ${docs.length}`);
    console.log(`Dengan isu      : ${rows.length}`);
    console.log(`  pathDateMismatch           : ${pathMismatchCount}`);
    console.log(`  suspiciousScheduleOffset   : ${scheduleAnomalyCount}`);
    console.log(`  contentUpdatedAtMissing    : ${missingContentUpdatedAt}`);
    console.log("");

    const critical = rows.filter((r) => r.pathDateMismatch);
    if (critical.length > 0) {
      console.log("--- pathDateMismatch (kritis) ---");
      for (const row of critical.slice(0, 50)) {
        console.log(
          `${row._id} | ${row.slug} | ${row.publicPath} | ${row.issues.join("; ")}`,
        );
      }
      if (critical.length > 50) {
        console.log(`... dan ${critical.length - 50} baris lainnya`);
      }
      console.log("");
    }

    const scheduleRows = rows.filter((r) => r.suspiciousScheduleOffset);
    if (scheduleRows.length > 0) {
      console.log("--- suspiciousScheduleOffset ---");
      for (const row of scheduleRows.slice(0, 30)) {
        console.log(
          `${row._id} | ${row.slug} | pub=${row.publishedAt} sched=${row.scheduledAt}`,
        );
      }
      if (scheduleRows.length > 30) {
        console.log(`... dan ${scheduleRows.length - 30} baris lainnya`);
      }
      console.log("");
    }

    console.log(
      `contentUpdatedAtMissing: ${missingContentUpdatedAt}/${docs.length} (expected sebelum backfill field baru)`,
    );

    if (pathMismatchCount > 0) {
      console.error(
        `\nFAIL: ${pathMismatchCount} artikel dengan pathDateMismatch — review manual sebelum migrasi.`,
      );
      process.exit(1);
    }

    console.log("\nOK: tidak ada pathDateMismatch kritis.");
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
