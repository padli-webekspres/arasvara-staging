/**
 * Audit publicPath artikel — bandingkan nilai DB vs computed legacy/structured.
 *
 * Default: dry-run (read-only)
 * Lokal: npm run audit:article-paths
 * Prod:  npm run audit:article-paths:prod
 */
import { MongoClient, ObjectId } from "mongodb";
import { bootstrapEnv } from "./bootstrap-env";
import {
  buildArticlePublicPath,
  buildLegacyArticlePath,
} from "../src/lib/article-public-path";
import { ArticleStatus } from "../src/types/article";

const loadedEnvFile = bootstrapEnv();

type AuditRow = {
  _id: string;
  slug: string;
  status: string;
  urlFormat: string | null;
  publicPath: string | null;
  categorySlug: string | null;
  computedLegacy: string | null;
  computedStructured: string | null;
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

async function main() {
  const mongoUrl = process.env.MONGO_URL;
  const dbName = process.env.DB_NAME || "arasvara_news";

  if (!mongoUrl) {
    console.error("MONGO_URL tidak ditemukan di .env");
    process.exit(1);
  }

  console.log("=== Audit publicPath artikel ===");
  console.log(`Env file : ${loadedEnvFile}`);
  console.log(`Database : ${dbName}`);
  console.log("Mode: AUDIT (read-only)\n");

  const client = new MongoClient(mongoUrl);
  await client.connect();
  const db = client.db(dbName);

  try {
    const docs = await db
      .collection("articles")
      .aggregate([
        {
          $match: {
            status: ArticleStatus.PUBLISHED,
            $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }],
          },
        },
        {
          $lookup: {
            from: "categories",
            localField: "categoryId",
            foreignField: "_id",
            as: "categoryObj",
          },
        },
        {
          $addFields: {
            categorySlug: {
              $arrayElemAt: ["$categoryObj.slug", 0],
            },
          },
        },
        {
          $project: {
            slug: 1,
            status: 1,
            urlFormat: 1,
            publicPath: 1,
            publishedAt: 1,
            categorySlug: 1,
          },
        },
      ])
      .toArray();

    const rows: AuditRow[] = docs.map((doc) => {
      const slug = String(doc.slug ?? "").trim();
      const categorySlug = doc.categorySlug
        ? String(doc.categorySlug).trim()
        : null;
      const publishedAt = coerceDate(doc.publishedAt);
      const issues: string[] = [];

      if (!slug) issues.push("slug kosong");
      if (!publishedAt) issues.push("publishedAt null pada PUBLISHED");
      if (!categorySlug) issues.push("categorySlug tidak ditemukan");

      let computedLegacy: string | null = null;
      let computedStructured: string | null = null;

      try {
        computedLegacy = slug ? buildLegacyArticlePath(slug) : null;
      } catch {
        issues.push("gagal build legacy path");
      }

      try {
        computedStructured = buildArticlePublicPath({
          slug,
          publishedAt,
          categorySlug,
          urlFormat: "structured",
          status: ArticleStatus.PUBLISHED,
        });
      } catch {
        issues.push("gagal build structured path");
      }

      return {
        _id: (doc._id as ObjectId).toHexString(),
        slug,
        status: String(doc.status ?? ""),
        urlFormat: doc.urlFormat ? String(doc.urlFormat) : null,
        publicPath: doc.publicPath ? String(doc.publicPath) : null,
        categorySlug,
        computedLegacy,
        computedStructured,
        issues,
      };
    });

    const pathCounts = new Map<string, string[]>();
    for (const row of rows) {
      for (const path of [row.computedLegacy, row.computedStructured]) {
        if (!path) continue;
        const list = pathCounts.get(path) ?? [];
        list.push(row._id);
        pathCounts.set(path, list);
      }
    }

    const duplicatePaths = [...pathCounts.entries()].filter(
      ([, ids]) => ids.length > 1,
    );

    const withIssues = rows.filter((row) => row.issues.length > 0);

    console.log(`Total artikel PUBLISHED: ${rows.length}`);
    console.log(`Dengan anomali: ${withIssues.length}`);
    console.log(`Duplikat computed path: ${duplicatePaths.length}\n`);

    if (withIssues.length > 0) {
      console.log("--- Artikel bermasalah (max 20) ---");
      for (const row of withIssues.slice(0, 20)) {
        console.log(
          `${row._id} | slug=${row.slug} | issues=${row.issues.join("; ")}`,
        );
      }
      if (withIssues.length > 20) {
        console.log(`... dan ${withIssues.length - 20} lainnya`);
      }
      console.log("");
    }

    if (duplicatePaths.length > 0) {
      console.log("--- Duplikat computed path ---");
      for (const [path, ids] of duplicatePaths.slice(0, 10)) {
        console.log(`${path} -> ${ids.join(", ")}`);
      }
      console.log("");
    }

    console.log("--- Sample (max 10) ---");
    for (const row of rows.slice(0, 10)) {
      console.log(
        [
          row._id,
          `slug=${row.slug}`,
          `dbPath=${row.publicPath ?? "-"}`,
          `legacy=${row.computedLegacy ?? "-"}`,
          `structured=${row.computedStructured ?? "-"}`,
        ].join(" | "),
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
