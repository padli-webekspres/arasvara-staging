/**
 * Migrasi Fase 2: articles.featuredImage.url → featuredImage.filename
 *
 * Default: --dry-run (tanpa write)
 * Execute: npm run migrate:featured-image -- --execute
 */
import { config } from "dotenv";
import { MongoClient, ObjectId } from "mongodb";
import {
  isFeaturedImageMigrationCandidate,
  resolveFilenameForMigration,
  type FeaturedImageEmbed,
} from "../src/lib/media/migrate-featured-image";

config();

const args = new Set(process.argv.slice(2));
const isExecute = args.has("--execute") && !args.has("--dry-run");
const isDryRun = !isExecute;

type MigrationPlan = {
  articleId: string;
  title: string;
  before: FeaturedImageEmbed;
  filename: string;
  source: string;
};

type MigrationFailure = {
  articleId: string;
  title: string;
  reason: string;
  featuredImage: FeaturedImageEmbed;
};

async function main() {
  const mongoUrl = process.env.MONGO_URL;
  const dbName = process.env.DB_NAME || "arasvara_news";

  if (!mongoUrl) {
    console.error("MONGO_URL tidak ditemukan di .env");
    process.exit(1);
  }

  console.log("=== Migrasi featuredImage: url → filename ===");
  console.log(`Mode: ${isExecute && !isDryRun ? "EXECUTE (write)" : "DRY-RUN"}`);
  console.log(`Database: ${dbName}`);
  console.log(`MONGO_URL: ${mongoUrl.replace(/\/\/([^:]+):([^@]+)@/, "//***:***@")}\n`);

  const client = new MongoClient(mongoUrl);
  await client.connect();
  const db = client.db(dbName);

  try {
    const alreadyMigrated = await db.collection("articles").countDocuments({
      "featuredImage.filename": { $exists: true, $ne: "" },
      "featuredImage.url": { $exists: false },
    });

    const withFilenameAndUrl = await db.collection("articles").countDocuments({
      "featuredImage.filename": { $exists: true, $ne: "" },
      "featuredImage.url": { $exists: true, $ne: "" },
    });

    const candidates = await db
      .collection("articles")
      .find({
        "featuredImage.url": { $exists: true, $ne: "" },
        $or: [
          { "featuredImage.filename": { $exists: false } },
          { "featuredImage.filename": "" },
          { "featuredImage.filename": null },
        ],
      })
      .project({ title: 1, featuredImage: 1 })
      .toArray();

    console.log("--- Preflight ---");
    console.log(`Sudah migrasi (filename tanpa url): ${alreadyMigrated}`);
    console.log(`Punya filename + url (redundan):     ${withFilenameAndUrl}`);
    console.log(`Kandidat migrasi:                  ${candidates.length}\n`);

    const mediaIds: ObjectId[] = [];
    for (const doc of candidates) {
      const fi = doc.featuredImage as FeaturedImageEmbed;
      if (!isFeaturedImageMigrationCandidate(fi)) continue;
      try {
        const id = new ObjectId(String(fi.mediaId));
        mediaIds.push(id);
      } catch {
        // skip invalid mediaId
      }
    }

    const uniqueMediaIds = [
      ...new Map(mediaIds.map((id) => [id.toString(), id])).values(),
    ];

    const mediaDocs =
      uniqueMediaIds.length > 0
        ? await db
            .collection("media")
            .find({ _id: { $in: uniqueMediaIds } })
            .project({ filename: 1 })
            .toArray()
        : [];

    const mediaFilenameById = new Map(
      mediaDocs.map((m) => [m._id.toString(), String(m.filename ?? "")]),
    );

    const plans: MigrationPlan[] = [];
    const failures: MigrationFailure[] = [];

    for (const doc of candidates) {
      const fi = doc.featuredImage as FeaturedImageEmbed;
      if (!isFeaturedImageMigrationCandidate(fi)) continue;

      const result = resolveFilenameForMigration(fi, mediaFilenameById);
      const articleId = doc._id.toString();
      const title = String(doc.title ?? "");

      if (!result.ok) {
        failures.push({
          articleId,
          title,
          reason: result.reason,
          featuredImage: fi,
        });
        continue;
      }

      plans.push({
        articleId,
        title,
        before: { ...fi },
        filename: result.filename,
        source: result.source,
      });
    }

    console.log("--- Simulasi resolve ---");
    console.log(`Resolved: ${plans.length}`);
    console.log(`Failed:   ${failures.length}\n`);

    if (failures.length > 0) {
      console.log("--- FAILED (perlu ditinjau manual) ---");
      for (const f of failures.slice(0, 20)) {
        console.log(`  [${f.articleId}] ${f.title}`);
        console.log(`    reason: ${f.reason}`);
        console.log(`    url: ${String(f.featuredImage.url ?? "")}`);
        console.log(`    mediaId: ${String(f.featuredImage.mediaId ?? "")}`);
      }
      if (failures.length > 20) {
        console.log(`  ... dan ${failures.length - 20} lainnya`);
      }
      console.log("");
    }

    const sampleCount = Math.min(5, plans.length);
    if (sampleCount > 0) {
      console.log(`--- Sample before/after (${sampleCount}) ---`);
      for (const p of plans.slice(0, sampleCount)) {
        console.log(`  [${p.articleId}] ${p.title}`);
        console.log(`    before.url:      ${String(p.before.url ?? "")}`);
        console.log(`    after.filename:  ${p.filename} (${p.source})`);
      }
      console.log("");
    }

    if (failures.length > 0) {
      console.error(
        "Preflight GAGAL: ada artikel yang tidak bisa di-resolve. Perbaiki data atau perluas fallback sebelum --execute.",
      );
      process.exit(1);
    }

    if (plans.length === 0) {
      console.log("Tidak ada artikel yang perlu dimigrasi. Selesai.");
      process.exit(0);
    }

    if (isDryRun || !isExecute) {
      console.log(
        `DRY-RUN selesai. ${plans.length} artikel siap dimigrasi. Jalankan dengan --execute untuk menulis ke DB.`,
      );
      process.exit(0);
    }

    console.log(`--- Menulis ${plans.length} artikel ke DB ---`);
    let updated = 0;
    for (const p of plans) {
      const res = await db.collection("articles").updateOne(
        { _id: new ObjectId(p.articleId) },
        {
          $set: { "featuredImage.filename": p.filename },
          $unset: { "featuredImage.url": "" },
        },
      );
      if (res.modifiedCount === 1) updated++;
    }

    const urlRemaining = await db.collection("articles").countDocuments({
      "featuredImage.url": { $exists: true, $ne: "" },
    });
    const missingFilename = await db.collection("articles").countDocuments({
      featuredImage: { $exists: true, $ne: null },
      $or: [
        { "featuredImage.filename": { $exists: false } },
        { "featuredImage.filename": "" },
        { "featuredImage.filename": null },
      ],
    });

    console.log(`Updated: ${updated}/${plans.length}`);
    console.log(`featuredImage.url tersisa: ${urlRemaining}`);
    console.log(`featuredImage tanpa filename: ${missingFilename}`);
    console.log("\nMigrasi selesai.");
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
