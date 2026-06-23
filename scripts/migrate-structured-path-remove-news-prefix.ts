/**
 * Migrasi publicPath structured dari format lama (/news/{cat}/...) ke root (/{cat}/...).
 *
 * Target: artikel dengan urlFormat "structured" yang publicPath masih berprefix /news/.
 * Recompute via buildStructuredArticlePath — bukan string-replace naif.
 *
 * Default: dry-run — tidak menulis ke DB.
 *
 * Penggunaan:
 *   Lokal: npm run migrate:structured-path-prefix
 *   Prod:  npm run migrate:structured-path-prefix:prod
 *   Execute: tambahkan -- --execute
 *
 * Flags opsional:
 *   --skip-no-category   Lewati artikel tanpa kategori valid (default: error)
 *   --skip-reserved-category  Lewati kategori reserved (default: skip + laporan)
 *   --fail-on-reserved-category  Hentikan script jika ada kategori reserved
 *   --verbose            Print setiap artikel yang akan diubah
 *   --write-manifest     Tulis scripts/.migration-revalidate-paths.json (otomatis saat --execute)
 */
import { MongoClient, ObjectId } from "mongodb";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { bootstrapEnv, scriptArgsWithoutEnvFile } from "./bootstrap-env";
import {
  buildStructuredArticlePath,
  isReservedRootSegment,
  pathsEqual,
} from "../src/lib/article-public-path";

const loadedEnvFile = bootstrapEnv();

const args = new Set(scriptArgsWithoutEnvFile());
const isExecute = args.has("--execute") && !args.has("--dry-run");
const skipNoCategory = args.has("--skip-no-category");
const failOnReservedCategory = args.has("--fail-on-reserved-category");
const verbose = args.has("--verbose");
const writeManifest = args.has("--write-manifest") || isExecute;

const OLD_STRUCTURED_PREFIX_REGEX = /^\/news\/[^/]+\/\d{4}\//;

interface ArticleRow {
  _id: ObjectId;
  slug: string;
  categoryId: ObjectId | null;
  publishedAt: Date | null;
  publicPath: string | null;
  urlFormat: string | null;
}

interface MigrateResult {
  articleId: string;
  slug: string;
  oldPath: string;
  newPath: string;
}

interface SkipResult {
  articleId: string;
  slug: string;
  reason: string;
}

function writeRevalidateManifest(
  dbName: string,
  toMigrate: MigrateResult[],
): void {
  const manifest = {
    migratedAt: new Date().toISOString(),
    database: dbName,
    paths: toMigrate.flatMap((row) => [row.oldPath, row.newPath]),
    entries: toMigrate.map((row) => ({
      articleId: row.articleId,
      slug: row.slug,
      oldPath: row.oldPath,
      newPath: row.newPath,
    })),
  };
  const manifestPath = resolve(
    process.cwd(),
    "scripts/.migration-revalidate-paths.json",
  );
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
  console.log(`\nManifest revalidate ditulis ke: ${manifestPath}`);
  console.log(
    "Jalankan: npm run warm:article-paths (atau :prod) untuk prefetch cache.",
  );
}

async function main() {
  const mongoUrl = process.env.MONGO_URL;
  const dbName = process.env.DB_NAME || "arasvara_news";

  if (!mongoUrl) {
    console.error("MONGO_URL tidak ditemukan di .env");
    process.exit(1);
  }

  console.log("=== Migrasi structured publicPath: hapus prefix /news/ ===");
  console.log(`Env file  : ${loadedEnvFile}`);
  console.log(`Database  : ${dbName}`);
  console.log(`Mode      : ${isExecute ? "EXECUTE" : "DRY-RUN (aman)"}`);
  console.log(
    `No-category: ${skipNoCategory ? "lewati (--skip-no-category)" : "hentikan script (default)"}`,
  );
  console.log();

  const client = new MongoClient(mongoUrl);
  await client.connect();
  const db = client.db(dbName);
  const articlesCol = db.collection("articles");
  const categoriesCol = db.collection("categories");

  try {
    const articleDocs = await articlesCol
      .find({
        urlFormat: "structured",
        publicPath: { $regex: OLD_STRUCTURED_PREFIX_REGEX },
        status: "PUBLISHED",
        $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }],
      })
      .project({
        slug: 1,
        categoryId: 1,
        publishedAt: 1,
        publicPath: 1,
        urlFormat: 1,
      })
      .toArray();

    const articles: ArticleRow[] = articleDocs.map((doc) => ({
      _id: doc._id as ObjectId,
      slug: String(doc.slug ?? "").trim(),
      categoryId:
        doc.categoryId instanceof ObjectId
          ? doc.categoryId
          : doc.categoryId
            ? (() => {
                try {
                  return new ObjectId(String(doc.categoryId));
                } catch {
                  return null;
                }
              })()
            : null,
      publishedAt:
        doc.publishedAt instanceof Date
          ? doc.publishedAt
          : doc.publishedAt
            ? (() => {
                const d = new Date(String(doc.publishedAt));
                return Number.isNaN(d.getTime()) ? null : d;
              })()
            : null,
      publicPath: doc.publicPath ? String(doc.publicPath) : null,
      urlFormat: doc.urlFormat ? String(doc.urlFormat) : null,
    }));

    const categoryIds = [
      ...new Set(
        articles
          .map((a) => a.categoryId?.toString())
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const categoryDocs = await categoriesCol
      .find({ _id: { $in: categoryIds.map((id) => new ObjectId(id)) } })
      .project({ slug: 1 })
      .toArray();

    const categoryMap = new Map<string, string>(
      categoryDocs.map((c) => [c._id.toString(), String(c.slug ?? "").trim()]),
    );

    const toMigrate: MigrateResult[] = [];
    const alreadyCurrent: number[] = [];
    const skipped: SkipResult[] = [];

    for (const article of articles) {
      if (!article.slug) {
        skipped.push({
          articleId: article._id.toString(),
          slug: "(kosong)",
          reason: "slug kosong",
        });
        continue;
      }

      if (!article.publishedAt) {
        skipped.push({
          articleId: article._id.toString(),
          slug: article.slug,
          reason: "publishedAt null/invalid",
        });
        continue;
      }

      const categorySlug = article.categoryId
        ? (categoryMap.get(article.categoryId.toString()) ?? "")
        : "";

      if (!categorySlug) {
        const reason = article.categoryId
          ? `kategori ${article.categoryId} tidak ditemukan atau slug kosong`
          : "categoryId null";

        if (skipNoCategory) {
          skipped.push({ articleId: article._id.toString(), slug: article.slug, reason });
          continue;
        }

        console.error(
          `\nArtikel "${article.slug}" (${article._id}) tidak punya kategori valid.\n` +
            `Tambahkan --skip-no-category untuk melewatinya, atau perbaiki data dulu.\n`,
        );
        process.exit(1);
      }

      if (isReservedRootSegment(categorySlug)) {
        const reason = `categorySlug "${categorySlug}" reserved untuk route root — rename kategori atau ubah urlFormat ke legacy`;

        if (failOnReservedCategory) {
          console.error(
            `\nArtikel "${article.slug}" (${article._id}): ${reason}\n` +
              `Gunakan --skip-reserved-category (default) untuk melewati, atau perbaiki data kategori.\n`,
          );
          process.exit(1);
        }

        skipped.push({ articleId: article._id.toString(), slug: article.slug, reason });
        continue;
      }

      let newPath: string;
      try {
        newPath = buildStructuredArticlePath({
          categorySlug,
          publishedAt: article.publishedAt,
          articleSlug: article.slug,
        });
      } catch (err) {
        const reason =
          err instanceof Error ? err.message : "gagal build structured path";
        skipped.push({ articleId: article._id.toString(), slug: article.slug, reason });
        continue;
      }

      const oldPath = article.publicPath ?? "";
      if (pathsEqual(oldPath, newPath)) {
        alreadyCurrent.push(1);
        continue;
      }

      toMigrate.push({
        articleId: article._id.toString(),
        slug: article.slug,
        oldPath,
        newPath,
      });
    }

    console.log(`Kandidat query           : ${articles.length}`);
    console.log(`Sudah format baru (skip) : ${alreadyCurrent.length}`);
    console.log(`Akan dimigrasi           : ${toMigrate.length}`);
    console.log(`Dilewati (error/data)    : ${skipped.length}`);

    if (skipped.length > 0) {
      console.log("\nArtikel dilewati:");
      for (const s of skipped) {
        console.log(`   [${s.articleId}] "${s.slug}" — ${s.reason}`);
      }
    }

    const reservedSkipped = skipped.filter((s) =>
      s.reason.includes("reserved untuk route root"),
    );
    if (reservedSkipped.length > 0) {
      console.log(
        `\nCatatan: ${reservedSkipped.length} artikel punya kategori reserved (mis. "search").` +
          ` Rename slug kategori di admin, atau set urlFormat ke legacy.`,
      );
    }

    if (verbose && toMigrate.length > 0) {
      console.log("\nPreview perubahan:");
      for (const row of toMigrate) {
        console.log(`   [${row.articleId}] "${row.slug}"`);
        console.log(`     lama : ${row.oldPath}`);
        console.log(`     baru : ${row.newPath}`);
      }
    }

    if (!isExecute) {
      if (toMigrate.length > 0) {
        console.log(
          `\nDry-run selesai. Jalankan dengan --execute untuk menulis ${toMigrate.length} perubahan ke DB.`,
        );
        if (writeManifest) {
          writeRevalidateManifest(dbName, toMigrate);
        }
      } else {
        console.log("\nTidak ada artikel structured dengan prefix /news/ yang perlu dimigrasi.");
      }
      return;
    }

    if (toMigrate.length === 0) {
      console.log("\nTidak ada yang perlu dimigrasi.");
      return;
    }

    console.log(`\nMenulis ${toMigrate.length} update ke DB...`);

    let success = 0;
    let failed = 0;

    for (const row of toMigrate) {
      try {
        await articlesCol.updateOne(
          { _id: new ObjectId(row.articleId) },
          { $set: { publicPath: row.newPath } },
        );
        success += 1;
        if (verbose) {
          console.log(`   OK  ${row.slug} → ${row.newPath}`);
        }
      } catch (err) {
        failed += 1;
        console.error(`   FAIL "${row.slug}" (${row.articleId}): ${err}`);
      }
    }

    console.log(`\nSelesai: ${success} berhasil, ${failed} gagal.`);

    if (failed > 0) {
      console.error(
        "\nAda kegagalan. Kemungkinan konflik unique index publicPath.\n" +
          "Periksa log di atas dan perbaiki data secara manual.",
      );
    }

    if (writeManifest && toMigrate.length > 0) {
      writeRevalidateManifest(dbName, toMigrate);
    }
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
