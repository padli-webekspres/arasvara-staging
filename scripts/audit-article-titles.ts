/**
 * Audit judul & slug artikel — deteksi duplikat, slug legacy, bentrok slugify.
 *
 * Default: dry-run (read-only)
 * Backfill titleNormalized: npm run audit:article-titles -- --backfill --execute
 */
import { config } from "dotenv";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { MongoClient, ObjectId } from "mongodb";
import {
  buildActiveArticleFilter,
  findSlugifyCollisions,
  hasLegacySlugSuffix,
  normalizeArticleTitle,
  titleNormalizedForStorage,
} from "../src/lib/article-validation";

config();

const args = new Set(process.argv.slice(2));
const isBackfill = args.has("--backfill");
const isExecute = args.has("--execute") && !args.has("--dry-run");

type ArticleRow = {
  _id: string;
  title: string;
  slug: string;
  titleNormalized?: string | null;
};

async function main() {
  const mongoUrl = process.env.MONGO_URL;
  const dbName = process.env.DB_NAME || "arasvara_news";

  if (!mongoUrl) {
    console.error("MONGO_URL tidak ditemukan di .env");
    process.exit(1);
  }

  console.log("=== Audit judul & slug artikel ===");
  console.log(`Database: ${dbName}`);
  console.log(
    `Mode: ${isBackfill ? (isExecute ? "BACKFILL EXECUTE" : "BACKFILL DRY-RUN") : "AUDIT (read-only)"}\n`,
  );

  const client = new MongoClient(mongoUrl);
  await client.connect();
  const db = client.db(dbName);

  try {
    const activeFilter = buildActiveArticleFilter();
    const docs = await db
      .collection("articles")
      .find(activeFilter)
      .project({ title: 1, slug: 1, titleNormalized: 1 })
      .toArray();

    const articles: ArticleRow[] = docs.map((doc) => ({
      _id: (doc._id as ObjectId).toHexString(),
      title: String(doc.title ?? ""),
      slug: String(doc.slug ?? ""),
      titleNormalized:
        doc.titleNormalized != null ? String(doc.titleNormalized) : null,
    }));

    const titleGroups = new Map<string, ArticleRow[]>();
    for (const article of articles) {
      const key = normalizeArticleTitle(article.title);
      if (!key) continue;
      const list = titleGroups.get(key) ?? [];
      list.push(article);
      titleGroups.set(key, list);
    }

    const duplicateTitles = [...titleGroups.entries()]
      .filter(([, group]) => group.length > 1)
      .map(([normalized, group]) => ({ normalized, count: group.length, articles: group }));

    const slugGroups = new Map<string, ArticleRow[]>();
    for (const article of articles) {
      if (!article.slug) continue;
      const list = slugGroups.get(article.slug) ?? [];
      list.push(article);
      slugGroups.set(article.slug, list);
    }

    const duplicateSlugs = [...slugGroups.entries()]
      .filter(([, group]) => group.length > 1)
      .map(([slug, group]) => ({ slug, count: group.length, articles: group }));

    const legacySlugs = articles.filter((a) => hasLegacySlugSuffix(a.slug));

    const slugifyCollisions = findSlugifyCollisions(
      articles.map((a) => ({ _id: a._id, title: a.title })),
    );

    const missingTitleNormalized = articles.filter(
      (a) => !a.titleNormalized && normalizeArticleTitle(a.title),
    );

    const report = {
      generatedAt: new Date().toISOString(),
      database: dbName,
      summary: {
        totalActive: articles.length,
        duplicateTitleGroups: duplicateTitles.length,
        duplicateSlugGroups: duplicateSlugs.length,
        legacySlugCount: legacySlugs.length,
        slugifyCollisionGroups: slugifyCollisions.length,
        missingTitleNormalized: missingTitleNormalized.length,
      },
      duplicateTitles,
      duplicateSlugs,
      legacySlugs: legacySlugs.slice(0, 50),
      slugifyCollisions,
      missingTitleNormalizedSample: missingTitleNormalized.slice(0, 20),
    };

    const outDir = join(process.cwd(), "scripts", "output");
    mkdirSync(outDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const outPath = join(outDir, `article-title-audit-${timestamp}.json`);
    writeFileSync(outPath, JSON.stringify(report, null, 2), "utf-8");

    console.log("--- Ringkasan ---");
    console.log(`Artikel aktif:              ${report.summary.totalActive}`);
    console.log(`Grup judul duplikat:        ${report.summary.duplicateTitleGroups}`);
    console.log(`Grup slug duplikat:         ${report.summary.duplicateSlugGroups}`);
    console.log(`Slug legacy (-xxxxxxxx):    ${report.summary.legacySlugCount}`);
    console.log(`Bentrok slugify (judul beda): ${report.summary.slugifyCollisionGroups}`);
    console.log(`Belum punya titleNormalized: ${report.summary.missingTitleNormalized}`);
    console.log(`\nLaporan: ${outPath}`);

    if (isBackfill) {
      console.log("\n--- Backfill titleNormalized ---");
      let updated = 0;
      let skipped = 0;

      for (const article of missingTitleNormalized) {
        const value = titleNormalizedForStorage(article.title);
        if (!value) {
          skipped++;
          continue;
        }

        if (isExecute) {
          await db.collection("articles").updateOne(
            { _id: new ObjectId(article._id) },
            { $set: { titleNormalized: value } },
          );
        }
        updated++;
      }

      console.log(
        `Akan di-update: ${updated}, dilewati: ${skipped} (${isExecute ? "EXECUTE" : "DRY-RUN"})`,
      );
    }
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
