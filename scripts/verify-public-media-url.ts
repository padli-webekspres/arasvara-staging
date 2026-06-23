/**
 * Verifikasi edge-case untuk resolver URL media publik.
 * Jalankan: npm run verify:media-url
 */
import {
  extractMediaKeyFromInput,
  resolvePublicMediaUrl,
  rewriteArticleContentMediaUrls,
} from "../src/lib/media/public-media-url";
import { normalizeFeaturedImage } from "../src/lib/helper-article";

const TEST_BASE = "http://192.168.0.191:9000/arasvara-images";
process.env.NEXT_PUBLIC_STORAGE_MEDIA = TEST_BASE;

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

console.log("verify-public-media-url\n");

assert(
  extractMediaKeyFromInput("featured/abc.webp") === "featured/abc.webp",
  "extract filename mentah",
);

assert(
  extractMediaKeyFromInput(
    "/api/media/view?key=featured%2Fabc.webp",
  ) === "featured/abc.webp",
  "extract dari proxy URL",
);

assert(
  extractMediaKeyFromInput("https://media.arasvara.id/x.webp") === null,
  "extract URL absolut → null",
);

assert(
  resolvePublicMediaUrl("featured/abc.webp") ===
    `${TEST_BASE}/featured/abc.webp`,
  "resolve filename mentah",
);

assert(
  resolvePublicMediaUrl("/api/media/view?key=featured%2Fabc.webp") ===
    `${TEST_BASE}/featured/abc.webp`,
  "resolve proxy URL",
);

assert(
  resolvePublicMediaUrl("https://media.arasvara.id/x.webp") ===
    "https://media.arasvara.id/x.webp",
  "resolve URL CDN sudah absolut",
);

assert(resolvePublicMediaUrl("") === "", "resolve string kosong");

const htmlIn =
  '<p><img src="/api/media/view?key=featured%2Ftest.webp" alt="x"/></p>';
const htmlOut = rewriteArticleContentMediaUrls(htmlIn);
assert(
  htmlOut.includes(`${TEST_BASE}/featured/test.webp`),
  "rewrite HTML proxy src",
);
assert(!htmlOut.includes("/api/media/view"), "rewrite HTML tanpa proxy");

const htmlExternal =
  '<img src="https://example.com/x.jpg" alt="ext"/>';
assert(
  rewriteArticleContentMediaUrls(htmlExternal) === htmlExternal,
  "rewrite HTML eksternal tidak berubah",
);

const htmlSingleQuote =
  "<img src='/api/media/view?key=content-images%2Fa.webp'/>";
const htmlSingleOut = rewriteArticleContentMediaUrls(htmlSingleQuote);
assert(
  htmlSingleOut.includes(`${TEST_BASE}/content-images/a.webp`),
  "rewrite HTML single quote",
);

// normalizeFeaturedImage integration via resolve
assert(
  resolvePublicMediaUrl(
    "featured/1780460235807-01KT5V50BNYFV45JY1EV0HQ1N2.webp",
  ).startsWith(TEST_BASE),
  "resolve key panjang ULID",
);

// normalizeFeaturedImage — schema baru (filename di DB)
const normalizedNew = normalizeFeaturedImage({
  mediaId: "6a1faacd9c7f842936d7e5b4",
  filename: "featured/abc.webp",
  caption: "cap",
  credit: "cred",
});
assert(
  normalizedNew?.url === `${TEST_BASE}/featured/abc.webp`,
  "normalizeFeaturedImage schema filename",
);

// normalizeFeaturedImage — schema lama (proxy url di DB)
const normalizedLegacy = normalizeFeaturedImage({
  mediaId: "6a1faacd9c7f842936d7e5b4",
  url: "/api/media/view?key=featured%2Flegacy.webp",
  caption: "cap",
  credit: "cred",
});
assert(
  normalizedLegacy?.url === `${TEST_BASE}/featured/legacy.webp`,
  "normalizeFeaturedImage legacy proxy url",
);

// normalizeFeaturedImage — tanpa data
assert(normalizeFeaturedImage(null) === null, "normalizeFeaturedImage null");

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
