/**
 * Prefetch/warm ISR cache untuk halaman artikel publik setelah migrasi path.
 *
 * Mengirim HTTP GET ke setiap publicPath agar Next.js menghasilkan halaman baru.
 *
 * Sumber path (prioritas):
 * 1. --manifest=scripts/.migration-revalidate-paths.json
 * 2. Query DB: semua artikel PUBLISHED structured dengan publicPath valid
 *
 * Default: dry-run (hanya list path)
 *
 * Penggunaan:
 *   Lokal: npm run warm:article-paths
 *   Prod:  npm run warm:article-paths:prod
 *   Execute: npm run warm:article-paths -- --execute
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { MongoClient } from "mongodb";
import { bootstrapEnv, scriptArgsWithoutEnvFile } from "./bootstrap-env";
import {
  isStructuredPublicPath,
  isValidArticlePublicPath,
} from "../src/lib/article-public-path";
import { ArticleStatus } from "../src/types/article";

const loadedEnvFile = bootstrapEnv();

const rawArgs = scriptArgsWithoutEnvFile();
const args = new Set(rawArgs);
const isExecute = args.has("--execute") && !args.has("--dry-run");
const verbose = args.has("--verbose");

function readManifestPaths(): string[] | null {
  const manifestArg = rawArgs.find((arg) => arg.startsWith("--manifest="));
  const manifestPath = manifestArg
    ? resolve(process.cwd(), manifestArg.slice("--manifest=".length))
    : resolve(process.cwd(), "scripts/.migration-revalidate-paths.json");

  if (!existsSync(manifestPath)) return null;

  const parsed = JSON.parse(readFileSync(manifestPath, "utf8")) as {
    paths?: string[];
  };
  const paths = (parsed.paths ?? []).map((p) => String(p).trim()).filter(Boolean);
  return paths.length > 0 ? [...new Set(paths)] : null;
}

async function loadPathsFromDb(dbName: string): Promise<string[]> {
  const mongoUrl = process.env.MONGO_URL;
  if (!mongoUrl) {
    throw new Error("MONGO_URL tidak ditemukan di .env");
  }

  const client = new MongoClient(mongoUrl);
  await client.connect();
  const db = client.db(dbName);

  try {
    const docs = await db
      .collection("articles")
      .find({
        status: ArticleStatus.PUBLISHED,
        urlFormat: "structured",
        publicPath: { $type: "string" },
        $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }],
      })
      .project({ publicPath: 1 })
      .toArray();

    const paths = docs
      .map((doc) => String(doc.publicPath ?? "").trim())
      .filter((path) => isStructuredPublicPath(path));

    return [...new Set(paths)];
  } finally {
    await client.close();
  }
}

async function warmPaths(paths: string[], baseUrl: string): Promise<void> {
  let ok = 0;
  let failed = 0;

  for (const path of paths) {
    if (!isValidArticlePublicPath(path) && !path.startsWith("/news/")) {
      if (verbose) {
        console.log(`SKIP invalid path: ${path}`);
      }
      continue;
    }

    const url = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
    try {
      const res = await fetch(url, {
        method: "GET",
        redirect: "manual",
        headers: { "User-Agent": "arasvara-warm-cache-script/1.0" },
      });
      if (res.status >= 200 && res.status < 400) {
        ok += 1;
        if (verbose) console.log(`OK  ${res.status} ${url}`);
      } else {
        failed += 1;
        console.warn(`WARN ${res.status} ${url}`);
      }
    } catch (err) {
      failed += 1;
      console.error(`FAIL ${url}: ${err}`);
    }
  }

  console.log(`\nWarm selesai: ${ok} OK, ${failed} gagal dari ${paths.length} path.`);
}

async function main() {
  const dbName = process.env.DB_NAME || "arasvara_news";
  const baseUrl = (
    process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
  ).replace(/\/+$/, "");

  console.log("=== Warm cache halaman artikel ===");
  console.log(`Env file : ${loadedEnvFile}`);
  console.log(`Database : ${dbName}`);
  console.log(`Base URL : ${baseUrl}`);
  console.log(`Mode     : ${isExecute ? "EXECUTE" : "DRY-RUN"}\n`);

  let paths = readManifestPaths();
  if (paths) {
    console.log(`Sumber path: manifest (${paths.length} unik)`);
  } else {
    console.log("Manifest tidak ditemukan — ambil path dari DB...");
    paths = await loadPathsFromDb(dbName);
    console.log(`Sumber path: database (${paths.length} unik)`);
  }

  if (paths.length === 0) {
    console.log("Tidak ada path untuk di-warm.");
    return;
  }

  if (!isExecute) {
    console.log("\nPreview path (max 20):");
    for (const path of paths.slice(0, 20)) {
      console.log(`  ${baseUrl}${path}`);
    }
    if (paths.length > 20) {
      console.log(`  ... dan ${paths.length - 20} lainnya`);
    }
    console.log(`\nDry-run selesai. Jalankan dengan --execute untuk prefetch ${paths.length} URL.`);
    return;
  }

  await warmPaths(paths, baseUrl);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
