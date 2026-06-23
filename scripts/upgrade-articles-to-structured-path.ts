/**
 * Upgrade artikel PUBLISHED dari urlFormat "legacy" ke "structured".
 *
 * Script ini me-recompute publicPath seluruh artikel PUBLISHED menggunakan
 * format hierarkis WIB: /news/{categorySlug}/{yyyy}/{mm}/{dd}/{articleSlug}
 *
 * Default: dry-run — tidak menulis ke DB.
 *
 * Penggunaan:
 *   Lokal: npm run upgrade:article-paths              # dry-run
 *   Prod:  npm run upgrade:article-paths:prod         # dry-run
 *   Execute: tambahkan -- --execute
 *
 * Flags opsional:
 *   --skip-no-category   Lewati artikel tanpa kategori valid (default: error)
 *   --verbose            Print setiap artikel yang akan diubah
 */
import { MongoClient, ObjectId } from "mongodb";
import { bootstrapEnv, scriptArgsWithoutEnvFile } from "./bootstrap-env";
import {
  buildStructuredArticlePath,
  pathsEqual,
} from "../src/lib/article-public-path";
import { ArticleStatus } from "../src/types/article";

const loadedEnvFile = bootstrapEnv();

const args = new Set(scriptArgsWithoutEnvFile());
const isExecute = args.has("--execute") && !args.has("--dry-run");
const skipNoCategory = args.has("--skip-no-category");
const verbose = args.has("--verbose");

// ──────────────────────────────────────────────────────────────────────────────

interface ArticleRow {
  _id: ObjectId;
  slug: string;
  categoryId: ObjectId | null;
  publishedAt: Date | null;
  publicPath: string | null;
  urlFormat: string | null;
}

interface CategoryRow {
  _id: ObjectId;
  slug: string;
}

interface UpgradeResult {
  articleId: string;
  slug: string;
  oldPath: string | null;
  newPath: string;
}

interface SkipResult {
  articleId: string;
  slug: string;
  reason: string;
}

// ──────────────────────────────────────────────────────────────────────────────

async function main() {
  const mongoUrl = process.env.MONGO_URL;
  const dbName = process.env.DB_NAME || "arasvara_news";

  if (!mongoUrl) {
    console.error("❌  MONGO_URL tidak ditemukan di .env");
    process.exit(1);
  }

  console.log("=== Upgrade artikel → structured publicPath ===");
  console.log(`Env file  : ${loadedEnvFile}`);
  console.log(`Database  : ${dbName}`);
  console.log(`Mode      : ${isExecute ? "EXECUTE ⚠️" : "DRY-RUN (aman)"}`);
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
    // ── 1. Ambil semua artikel PUBLISHED (termasuk yang sudah structured) ─────
    const articleDocs = await articlesCol
      .find({
        status: ArticleStatus.PUBLISHED,
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

    // ── 2. Ambil semua kategori yang dibutuhkan (batch) ───────────────────────
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

    // ── 3. Hitung path baru untuk setiap artikel ──────────────────────────────
    const toUpgrade: UpgradeResult[] = [];
    const alreadyStructured: number[] = [];
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
        } else {
          console.error(
            `\n❌  Artikel "${article.slug}" (${article._id}) tidak punya kategori valid.\n` +
              `    Tambahkan --skip-no-category untuk melewatinya, atau perbaiki data dulu.\n`,
          );
          process.exit(1);
        }
      }

      const newPath = buildStructuredArticlePath({
        categorySlug,
        publishedAt: article.publishedAt,
        articleSlug: article.slug,
      });

      // Sudah structured dan path-nya identik → skip
      if (
        article.urlFormat === "structured" &&
        article.publicPath &&
        pathsEqual(article.publicPath, newPath)
      ) {
        alreadyStructured.push(1);
        continue;
      }

      toUpgrade.push({
        articleId: article._id.toString(),
        slug: article.slug,
        oldPath: article.publicPath,
        newPath,
      });
    }

    // ── 4. Tampilkan ringkasan ────────────────────────────────────────────────
    console.log(`Total PUBLISHED         : ${articles.length}`);
    console.log(`Sudah structured (skip) : ${alreadyStructured.length}`);
    console.log(`Akan di-upgrade         : ${toUpgrade.length}`);
    console.log(`Dilewati (error/data)   : ${skipped.length}`);

    if (skipped.length > 0) {
      console.log("\n⚠️  Artikel dilewati:");
      for (const s of skipped) {
        console.log(`   [${s.articleId}] "${s.slug}" — ${s.reason}`);
      }
    }

    if (verbose && toUpgrade.length > 0) {
      console.log("\n📋  Preview perubahan:");
      for (const u of toUpgrade) {
        console.log(`   [${u.articleId}] "${u.slug}"`);
        console.log(`     lama : ${u.oldPath ?? "(null)"}`);
        console.log(`     baru : ${u.newPath}`);
      }
    }

    if (!isExecute) {
      if (toUpgrade.length > 0) {
        console.log(
          `\nDry-run selesai. Jalankan dengan --execute untuk menulis ${toUpgrade.length} perubahan ke DB.`,
        );
        console.log("Tambahkan --verbose untuk melihat preview lengkap setiap URL.");
      } else {
        console.log("\n✅  Semua artikel sudah dalam format structured.");
      }
      return;
    }

    // ── 5. Tulis ke DB ────────────────────────────────────────────────────────
    if (toUpgrade.length === 0) {
      console.log("\n✅  Tidak ada yang perlu di-upgrade.");
      return;
    }

    console.log(`\nMenulis ${toUpgrade.length} update ke DB...`);

    let success = 0;
    let failed = 0;

    for (const u of toUpgrade) {
      try {
        await articlesCol.updateOne(
          { _id: new ObjectId(u.articleId) },
          {
            $set: {
              urlFormat: "structured",
              publicPath: u.newPath,
            },
          },
        );
        success += 1;
        if (verbose) {
          console.log(`   ✓  ${u.slug} → ${u.newPath}`);
        }
      } catch (err) {
        failed += 1;
        console.error(`   ✗  Gagal update "${u.slug}" (${u.articleId}): ${err}`);
      }
    }

    console.log(`\n✅  Selesai: ${success} berhasil, ${failed} gagal.`);

    if (failed > 0) {
      console.error(
        "\n⚠️  Ada kegagalan. Kemungkinan konflik unique index publicPath " +
          "(dua artikel dengan slug + kategori + tanggal yang sama).\n" +
          "    Periksa log di atas dan perbaiki data secara manual.",
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
