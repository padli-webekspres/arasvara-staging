/**
 * Verifikasi migrasi `editor_activities` → `audit_log`
 *
 * Lokal: npm run verify:editor-activities-migration
 * Prod:  npm run verify:editor-activities-migration:prod
 */
import { MongoClient } from "mongodb";
import { bootstrapEnv } from "./bootstrap-env";
import {
  activeEditorActivitiesFilter,
  migratedEditorActivitiesFilter,
} from "../src/lib/migrations/editor-activities-to-audit-log";

const loadedEnvFile = bootstrapEnv();

function maskMongoUrl(url: string): string {
  return url.replace(/\/\/([^:]+):([^@]+)@/, "//***:***@");
}

async function main() {
  const mongoUrl = process.env.MONGO_URL;
  const dbName = process.env.DB_NAME || "arasvara_news";

  if (!mongoUrl) {
    console.error("MONGO_URL tidak ditemukan di env");
    process.exit(1);
  }

  console.log("=== Verifikasi migrasi editor_activities → audit_log ===");
  console.log(`Env file: ${loadedEnvFile}`);
  console.log(`Database: ${dbName}`);
  console.log(`MONGO_URL: ${maskMongoUrl(mongoUrl)}`);
  console.log("");

  const client = new MongoClient(mongoUrl);
  await client.connect();
  const db = client.db(dbName);
  const sourceCol = db.collection("editor_activities");
  const auditCol = db.collection("audit_log");

  try {
    const sourceFilter = activeEditorActivitiesFilter();
    const migratedFilter = migratedEditorActivitiesFilter();

    const sourceCount = await sourceCol.countDocuments(sourceFilter);
    const migratedCount = await auditCol.countDocuments(migratedFilter);

    const duplicateOriginalIds = await auditCol
      .aggregate<{ _id: string; count: number }>([
        { $match: migratedFilter },
        {
          $group: {
            _id: "$meta.originalId",
            count: { $sum: 1 },
          },
        },
        { $match: { count: { $gt: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ])
      .toArray();

    const missingOriginalId = await auditCol.countDocuments({
      ...migratedFilter,
      $or: [
        { "meta.originalId": { $exists: false } },
        { "meta.originalId": null },
        { "meta.originalId": "" },
      ],
    });

    const sourceIds = await sourceCol
      .find(sourceFilter, { projection: { _id: 1 } })
      .toArray();
    const migratedOriginalIds = await auditCol
      .find(migratedFilter, { projection: { "meta.originalId": 1 } })
      .toArray();

    const migratedSet = new Set(
      migratedOriginalIds
        .map((doc) => {
          const meta = doc.meta as { originalId?: string } | undefined;
          return typeof meta?.originalId === "string"
            ? meta.originalId.trim()
            : "";
        })
        .filter(Boolean),
    );

    const missingInAudit = sourceIds
      .map((doc) => doc._id.toString())
      .filter((id) => !migratedSet.has(id));

    console.log("--- Count ---");
    console.log(`editor_activities aktif:     ${sourceCount}`);
    console.log(`audit_log migrated:          ${migratedCount}`);
    console.log(`Selisih (source - migrated): ${sourceCount - migratedCount}`);
    console.log("");

    console.log("--- Integritas ---");
    console.log(`Tanpa meta.originalId:       ${missingOriginalId}`);
    console.log(`Duplikat originalId:         ${duplicateOriginalIds.length}`);
    console.log(`Source belum di audit_log:   ${missingInAudit.length}`);
    console.log("");

    if (duplicateOriginalIds.length > 0) {
      console.log("--- Duplikat originalId (sample) ---");
      for (const row of duplicateOriginalIds) {
        console.log(`  ${row._id}: ${row.count} dokumen`);
      }
      console.log("");
    }

    if (missingInAudit.length > 0) {
      console.log("--- Source belum dimigrasi (sample max 20) ---");
      for (const id of missingInAudit.slice(0, 20)) {
        console.log(`  ${id}`);
      }
      if (missingInAudit.length > 20) {
        console.log(`  ... dan ${missingInAudit.length - 20} lainnya`);
      }
      console.log("");
    }

    const passed =
      sourceCount === migratedCount &&
      missingOriginalId === 0 &&
      duplicateOriginalIds.length === 0 &&
      missingInAudit.length === 0;

    if (passed) {
      console.log("VERIFIKASI LULUS: count match dan tidak ada duplikat/missing.");
      process.exit(0);
    }

    console.error("VERIFIKASI GAGAL: lihat selisih di atas.");
    process.exit(1);
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
