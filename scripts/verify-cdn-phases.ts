/**
 * Verifikasi Fase 2–4 migrasi CDN.
 * Jalankan: npm run verify:cdn-phases
 */
import {
  resolvePublicMediaUrl,
  rewriteArticleContentMediaUrls,
} from "../src/lib/media/public-media-url";
import {
  resolveFilenameForMigration,
  isFeaturedImageMigrationCandidate,
} from "../src/lib/media/migrate-featured-image";

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

console.log("verify-cdn-phases\n");

// --- Fase 3: redirect target ---
console.log("Fase 3 — media/view redirect");
const redirectUrl = resolvePublicMediaUrl("featured/abc.webp");
assert(
  redirectUrl === `${TEST_BASE}/featured/abc.webp`,
  "resolvePublicMediaUrl menghasilkan URL CDN valid",
);
assert(
  redirectUrl.startsWith("http"),
  "redirect URL absolut",
);

// --- Fase 4: HTML rewrite ---
console.log("\nFase 4 — rewrite HTML content");

const htmlRelative =
  '<p><img src="/api/media/view?key=featured%2Ftest.webp" alt="x"/></p>';
const htmlRelativeOut = rewriteArticleContentMediaUrls(htmlRelative);
assert(
  htmlRelativeOut.includes(`${TEST_BASE}/featured/test.webp`),
  "rewrite relative proxy src → CDN",
);
assert(
  !htmlRelativeOut.includes("/api/media/view"),
  "output relative tanpa proxy",
);

const htmlAbsoluteProd =
  '<img src="https://arasvara.id/api/media/view?key=content-images%2Fa.webp" alt="prod"/>';
const htmlAbsoluteProdOut = rewriteArticleContentMediaUrls(htmlAbsoluteProd);
assert(
  htmlAbsoluteProdOut.includes(`${TEST_BASE}/content-images/a.webp`),
  "rewrite absolute prod proxy src → CDN",
);
assert(
  !htmlAbsoluteProdOut.includes("/api/media/view"),
  "output absolute prod tanpa proxy",
);

const htmlAbsoluteDev =
  "<img src='http://192.168.0.191:3000/api/media/view?key=featured%2Fb.webp'/>";
const htmlAbsoluteDevOut = rewriteArticleContentMediaUrls(htmlAbsoluteDev);
assert(
  htmlAbsoluteDevOut.includes(`${TEST_BASE}/featured/b.webp`),
  "rewrite absolute dev proxy src → CDN",
);

const htmlExternal = '<img src="https://example.com/x.jpg" alt="ext"/>';
assert(
  rewriteArticleContentMediaUrls(htmlExternal) === htmlExternal,
  "URL eksternal tidak berubah",
);

// DB content tetap proxy; rewrite hanya di output
const dbContent =
  '<img src="/api/media/view?key=featured%2Fstored.webp"/>';
const apiResponse = rewriteArticleContentMediaUrls(dbContent);
assert(
  dbContent.includes("/api/media/view"),
  "mock DB content masih mengandung proxy URL",
);
assert(
  !apiResponse.includes("/api/media/view"),
  "API response rewrite tidak mengandung proxy",
);

// --- Fase 2: migration helper ---
console.log("\nFase 2 — resolveFilenameForMigration");

const mediaMap = new Map([["6a1faacd9c7f842936d7e5b4", "featured/from-media.webp"]]);

const fromMedia = resolveFilenameForMigration(
  { mediaId: "6a1faacd9c7f842936d7e5b4", url: "/api/media/view?key=old" },
  mediaMap,
);
assert(
  fromMedia.ok && fromMedia.filename === "featured/from-media.webp" && fromMedia.source === "media_lookup",
  "resolve via mediaId lookup (prioritas)",
);

const fromUrl = resolveFilenameForMigration(
  { url: "/api/media/view?key=featured%2Fparsed.webp" },
  mediaMap,
);
assert(
  fromUrl.ok && fromUrl.filename === "featured/parsed.webp" && fromUrl.source === "url_parse",
  "resolve via url parse fallback",
);

const fromExisting = resolveFilenameForMigration({
  filename: "featured/already.webp",
  url: "/api/media/view?key=ignored",
});
assert(
  fromExisting.ok && fromExisting.filename === "featured/already.webp" && fromExisting.source === "existing_filename",
  "resolve existing filename",
);

const failedResolve = resolveFilenameForMigration({ caption: "no media" });
assert(!failedResolve.ok, "resolve gagal tanpa mediaId/url");

assert(
  isFeaturedImageMigrationCandidate({ url: "/api/media/view?key=x" }),
  "kandidat migrasi: punya url tanpa filename",
);
assert(
  !isFeaturedImageMigrationCandidate({ filename: "x.webp", url: "/api/media/view?key=x" }),
  "bukan kandidat jika sudah punya filename",
);
assert(
  !isFeaturedImageMigrationCandidate(null),
  "bukan kandidat jika null",
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
