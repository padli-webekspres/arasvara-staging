/**
 * Fase C: Migrasi `editor_activities` → `audit_log`
 *
 * Default: --dry-run (tanpa write)
 * Execute: npm run migrate:editor-activities -- --execute
 * Prod:     npm run migrate:editor-activities:prod -- --execute
 */
import { MongoClient, ObjectId } from "mongodb";
import { bootstrapEnv, scriptArgsWithoutEnvFile } from "./bootstrap-env";
import {
  activeEditorActivitiesFilter,
  mapEditorActivityToAuditLog,
  migratedEditorActivitiesFilter,
  type EditorActivitySourceDoc,
  type MigrationMappingFailure,
} from "../src/lib/migrations/editor-activities-to-audit-log";

const loadedEnvFile = bootstrapEnv();
const args = new Set(scriptArgsWithoutEnvFile());
const isExecute = args.has("--execute") && !args.has("--dry-run");
const isDryRun = !isExecute;

const BATCH_SIZE = 200;

function parseLimit(): number | undefined {
  for (const arg of args) {
    if (!arg.startsWith("--limit=")) continue;
    const n = Number.parseInt(arg.slice("--limit=".length), 10);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  }
  return undefined;
}

function maskMongoUrl(url: string): string {
  return url.replace(/\/\/([^:]+):([^@]+)@/, "//***:***@");
}

async function loadExistingOriginalIds(
  auditCol: ReturnType<import("mongodb").Db["collection"]>,
): Promise<Set<string>> {
  const existing = await auditCol
    .find(migratedEditorActivitiesFilter(), {
      projection: { "meta.originalId": 1 },
    })
    .toArray();

  const ids = new Set<string>();
  for (const doc of existing) {
    const originalId = (doc as { meta?: { originalId?: string } }).meta
      ?.originalId;
    if (typeof originalId === "string" && originalId.trim()) {
      ids.add(originalId.trim());
    }
  }
  return ids;
}

async function main() {
  const mongoUrl = process.env.MONGO_URL;
  const dbName = process.env.DB_NAME || "arasvara_news";
  const limit = parseLimit();

  if (!mongoUrl) {
    console.error("MONGO_URL tidak ditemukan di env");
    process.exit(1);
  }

  console.log("=== Migrasi editor_activities → audit_log ===");
  console.log(`Env file: ${loadedEnvFile}`);
  console.log(`Mode: ${isExecute ? "EXECUTE (write)" : "DRY-RUN"}`);
  console.log(`Database: ${dbName}`);
  console.log(`MONGO_URL: ${maskMongoUrl(mongoUrl)}`);
  if (limit) console.log(`Limit: ${limit}`);
  console.log("");

  const client = new MongoClient(mongoUrl);
  await client.connect();
  const db = client.db(dbName);
  const sourceCol = db.collection("editor_activities");
  const auditCol = db.collection("audit_log");

  try {
    const sourceFilter = activeEditorActivitiesFilter();
    const sourceCountBefore = await sourceCol.countDocuments(sourceFilter);
    const migratedCountBefore = await auditCol.countDocuments(
      migratedEditorActivitiesFilter(),
    );

    console.log("--- Preflight ---");
    console.log(`editor_activities aktif:              ${sourceCountBefore}`);
    console.log(`audit_log sudah dimigrasi (sebelum):  ${migratedCountBefore}`);
    console.log("");

    const existingOriginalIds = await loadExistingOriginalIds(auditCol);
    console.log(
      `originalId sudah ada di audit_log:    ${existingOriginalIds.size}`,
    );
    console.log("");

    const cursor = sourceCol.find(sourceFilter).sort({ timestamp: 1, _id: 1 });
    if (limit) cursor.limit(limit);

    let scanned = 0;
    let skippedExisting = 0;
    let inserted = 0;
    let wouldInsert = 0;
    const failures: MigrationMappingFailure[] = [];
    let batch: Record<string, unknown>[] = [];
    let batchSourceIds: string[] = [];

    const flushBatch = async () => {
      if (batch.length === 0) return;

      if (isExecute) {
        const result = await auditCol.insertMany(batch, { ordered: false });
        inserted += result.insertedCount;
        for (const id of batchSourceIds) {
          existingOriginalIds.add(id);
        }
      } else {
        wouldInsert += batch.length;
      }

      batch = [];
      batchSourceIds = [];
    };

    for await (const raw of cursor) {
      scanned++;
      const doc = raw as EditorActivitySourceDoc;
      const sourceId =
        doc._id instanceof ObjectId
          ? doc._id.toHexString()
          : String(doc._id ?? "");

      if (existingOriginalIds.has(sourceId)) {
        skippedExisting++;
        continue;
      }

      const mapped = mapEditorActivityToAuditLog(doc);
      if (!mapped.ok) {
        failures.push(mapped.failure);
        continue;
      }

      batch.push(mapped.data.auditDoc);
      batchSourceIds.push(mapped.data.sourceId);

      if (batch.length >= BATCH_SIZE) {
        await flushBatch();
      }
    }

    await flushBatch();

    const migratedCountAfter = await auditCol.countDocuments(
      migratedEditorActivitiesFilter(),
    );

    console.log("--- Hasil ---");
    console.log(`Discan:                    ${scanned}`);
    console.log(`Skip (sudah ada):          ${skippedExisting}`);
    console.log(
      `${isExecute ? "Inserted" : "Would insert"}:           ${isExecute ? inserted : wouldInsert}`,
    );
    console.log(`Failed mapping:            ${failures.length}`);
    console.log(`audit_log migrated (after): ${migratedCountAfter}`);
    console.log("");

    if (failures.length > 0) {
      console.log("--- FAILED mapping (sample max 20) ---");
      for (const failure of failures.slice(0, 20)) {
        console.log(`  [${failure.sourceId}] ${failure.reason}`);
      }
      if (failures.length > 20) {
        console.log(`  ... dan ${failures.length - 20} lainnya`);
      }
      console.log("");
    }

    const sample = await auditCol
      .find(migratedEditorActivitiesFilter())
      .sort({ createdAt: -1 })
      .limit(3)
      .toArray();

    if (sample.length > 0) {
      console.log(`--- Sample migrated (${sample.length}) ---`);
      for (const row of sample) {
        const meta = row.meta as { originalId?: string; articleTitle?: string };
        console.log(
          `  audit _id=${String(row._id)} originalId=${meta?.originalId ?? "?"} action=${String(row.action ?? "")} title=${meta?.articleTitle ?? ""}`,
        );
      }
      console.log("");
    }

    if (failures.length > 0) {
      console.error(
        "Migrasi selesai dengan error mapping. Perbaiki data sumber sebelum --execute penuh.",
      );
      process.exit(1);
    }

    if (isDryRun) {
      console.log(
        `DRY-RUN selesai. ${wouldInsert} dokumen siap di-insert. Jalankan dengan --execute untuk menulis ke DB.`,
      );
      process.exit(0);
    }

    const expectedMigrated = sourceCountBefore;
    if (migratedCountAfter < expectedMigrated) {
      console.warn(
        `PERINGATAN: migrated count (${migratedCountAfter}) < source aktif (${expectedMigrated}). Jalankan verify script untuk detail.`,
      );
    } else {
      console.log("Migrasi selesai. Jalankan verify script untuk validasi count.");
    }
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
