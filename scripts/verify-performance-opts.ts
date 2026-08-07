/**
 * Verifikasi optimasi performa: S3 pooling, cache artikel, lazy load HTML.
 * Jalankan: npm run verify:perf-opts
 */
import { getS3MaxSockets } from "../src/lib/s3";
import {
  getArticleCacheTag,
  getArticleRevalidateSeconds,
} from "../src/lib/cache/article-cache-config";
import { injectLazyLoadOnArticleImages } from "../src/lib/article-html";
import { shouldUnoptimizeNewsCardImage } from "../src/lib/utils";
import {
  buildSrcSet,
  resolveMediaVariantUrl,
} from "../src/lib/media/public-media-url";

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  OK  ${label}`);
  } else {
    failed++;
    console.error(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

console.log("verify-performance-opts\n");

console.log("S3 — connection pooling");
delete process.env.S3_MAX_SOCKETS;
assert(getS3MaxSockets() === 200, "getS3MaxSockets default 200");
process.env.S3_MAX_SOCKETS = "128";
assert(getS3MaxSockets() === 128, "getS3MaxSockets dari env");
delete process.env.S3_MAX_SOCKETS;

console.log("\nCache — artikel detail");
delete process.env.ARTICLE_PAGE_REVALIDATE_SECONDS;
assert(
  getArticleRevalidateSeconds() === 3600,
  "getArticleRevalidateSeconds default 3600",
);
process.env.ARTICLE_PAGE_REVALIDATE_SECONDS = "600";
assert(
  getArticleRevalidateSeconds() === 600,
  "getArticleRevalidateSeconds dari env",
);
delete process.env.ARTICLE_PAGE_REVALIDATE_SECONDS;

assert(
  getArticleCacheTag("judul-artikel") === "article-judul-artikel",
  "getArticleCacheTag format konsisten",
);

console.log("\nLazy load — body HTML");
const htmlIn = '<p><img src="https://cdn.example/a.webp" alt="a"/></p>';
const htmlOut = injectLazyLoadOnArticleImages(htmlIn);
assert(htmlOut.includes('loading="lazy"'), "inject lazy pada img");
assert(htmlOut.includes('decoding="async"'), "inject decoding async");
const htmlExisting = '<img loading="eager" src="x.jpg"/>';
assert(
  injectLazyLoadOnArticleImages(htmlExisting) === htmlExisting,
  "tidak override loading eksplisit",
);

console.log("\nKartu list — unoptimized CDN");
assert(
  shouldUnoptimizeNewsCardImage("https://media.arasvara.id/featured/x.webp"),
  "CDN https → unoptimized",
);
assert(
  shouldUnoptimizeNewsCardImage("/api/media/view?key=x"),
  "proxy relatif → unoptimized",
);
assert(
  shouldUnoptimizeNewsCardImage("http://192.168.0.191:9000/x.webp"),
  "http MinIO lokal → unoptimized",
);

assert(
  resolveMediaVariantUrl("https://media.arasvara.id/featured/x.webp", 640) ===
    "https://media.arasvara.id/featured/x-w640.webp",
  "URL varian w640 konsisten",
);
assert(
  buildSrcSet("https://media.arasvara.id/featured/x.webp").includes("640w") &&
    buildSrcSet("https://media.arasvara.id/featured/x.webp").includes("1280w"),
  "srcset menghasilkan varian 640w dan 1280w",
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
