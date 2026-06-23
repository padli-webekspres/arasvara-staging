/**
 * Backfill publicPath untuk artikel PUBLISHED existing (legacy format).
 *
 * Default: dry-run
 * Lokal: npm run backfill:article-paths -- --execute
 * Prod:  npm run backfill:article-paths:prod -- --execute
 */
import { MongoClient, ObjectId } from "mongodb";
import { bootstrapEnv, scriptArgsWithoutEnvFile } from "./bootstrap-env";
import {
  buildLegacyArticlePath,
  pathsEqual,
} from "../src/lib/article-public-path";
import { ArticleStatus } from "../src/types/article";

const loadedEnvFile = bootstrapEnv();

const args = new Set(scriptArgsWithoutEnvFile());
const isExecute = args.has("--execute") && !args.has("--dry-run");
const createIndex = args.has("--create-index");

async function main() {
  const mongoUrl = process.env.MONGO_URL;
  const dbName = process.env.DB_NAME || "arasvara_news";

  if (!mongoUrl) {
    console.error("MONGO_URL tidak ditemukan di .env");
    process.exit(1);
  }

  console.log("=== Backfill publicPath artikel (legacy) ===");
  console.log(`Env file : ${loadedEnvFile}`);
  console.log(`Database : ${dbName}`);
  console.log(`Mode: ${isExecute ? "EXECUTE" : "DRY-RUN"}`);
  console.log(`Create index: ${createIndex ? "yes" : "no"}\n`);

  const client = new MongoClient(mongoUrl);
  await client.connect();
  const db = client.db(dbName);
  const collection = db.collection("articles");

  try {
    const docs = await collection
      .find({
        status: ArticleStatus.PUBLISHED,
        $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }],
      })
      .project({ slug: 1, urlFormat: 1, publicPath: 1 })
      .toArray();

    let toUpdate = 0;
    let skipped = 0;

    for (const doc of docs) {
      const slug = String(doc.slug ?? "").trim();
      if (!slug) {
        skipped += 1;
        continue;
      }

      const expectedPath = buildLegacyArticlePath(slug);
      const currentFormat = doc.urlFormat ? String(doc.urlFormat) : null;
      const currentPath = doc.publicPath ? String(doc.publicPath) : null;

      const alreadyValid =
        currentFormat === "legacy" &&
        currentPath &&
        pathsEqual(currentPath, expectedPath);

      if (alreadyValid) {
        skipped += 1;
        continue;
      }

      toUpdate += 1;
      if (isExecute) {
        await collection.updateOne(
          { _id: doc._id },
          {
            $set: {
              urlFormat: "legacy",
              publicPath: expectedPath,
            },
          },
        );
      }
    }

    console.log(`Total PUBLISHED: ${docs.length}`);
    console.log(`Akan di-update: ${toUpdate}`);
    console.log(`Dilewati (sudah valid / tanpa slug): ${skipped}`);

    if (createIndex && isExecute) {
      const indexName = "articles_publicPath_unique";
      const indexes = await collection.indexes();
      const exists = indexes.some((idx) => idx.name === indexName);
      if (exists) {
        console.log(`\nIndex "${indexName}" sudah ada.`);
      } else {
        await collection.createIndex(
          { publicPath: 1 },
          { unique: true, sparse: true, name: indexName },
        );
        console.log(`\nIndex "${indexName}" dibuat.`);
      }
    } else if (createIndex && !isExecute) {
      console.log(
        "\nFlag --create-index diabaikan pada dry-run. Tambahkan --execute.",
      );
    }

    if (!isExecute && toUpdate > 0) {
      console.log("\nJalankan ulang dengan --execute untuk menulis ke DB.");
    }
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
