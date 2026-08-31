import { revalidatePath, revalidateTag } from "next/cache";
import {
  ARTICLE_LISTING_CACHE_TAG,
  getArticleCacheTag,
  getArticleCacheTagFromPublicPath,
} from "@/lib/cache/article-cache-config";
import { isReservedRootSegment } from "@/lib/article-public-path";
import { buildAuthorPublicPath } from "@/lib/author-public-path";

export type ArticleListingContext = {
  categorySlug?: string | null;
  previousCategorySlug?: string | null;
  authorSlug?: string | null;
  previousAuthorSlug?: string | null;
};

function normalizePublicPath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function normalizeListingSlug(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function uniqueSlugs(
  ...values: Array<string | null | undefined>
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const slug = normalizeListingSlug(value);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    out.push(slug);
  }
  return out;
}

function nestedOrDottedSlug(
  doc: object | null | undefined,
  parent: "category" | "author",
): string | null {
  if (!doc) return null;
  const record = doc as Record<string, unknown>;
  const nested = record[parent];
  if (nested && typeof nested === "object") {
    const slug = (nested as { slug?: unknown }).slug;
    if (typeof slug === "string" && slug.trim()) return slug.trim();
  }
  const dotted = record[`${parent}.slug`];
  if (typeof dotted === "string" && dotted.trim()) return dotted.trim();
  return null;
}

/** Ambil slug kategori & penulis dari dokumen artikel (denorm nested atau dotted). */
export function listingContextFromArticleDoc(
  doc: object | null | undefined,
): ArticleListingContext {
  return {
    categorySlug: nestedOrDottedSlug(doc, "category"),
    authorSlug: nestedOrDottedSlug(doc, "author"),
  };
}

export function listingContextFromArticleDocs(
  current?: object | null,
  previous?: object | null,
): ArticleListingContext {
  const cur = listingContextFromArticleDoc(current);
  const prev = listingContextFromArticleDoc(previous);
  return {
    categorySlug: cur.categorySlug,
    previousCategorySlug: prev.categorySlug,
    authorSlug: cur.authorSlug,
    previousAuthorSlug: prev.authorSlug,
  };
}

/** Path listing yang harus di-invalidate untuk konteks artikel. */
export function listingPathsFromContext(
  ctx?: ArticleListingContext,
): string[] {
  const paths = ["/", "/indeks"];
  for (const slug of uniqueSlugs(ctx?.categorySlug, ctx?.previousCategorySlug)) {
    if (isReservedRootSegment(slug)) continue;
    paths.push(`/${slug}`);
  }
  for (const slug of uniqueSlugs(ctx?.authorSlug, ctx?.previousAuthorSlug)) {
    paths.push(buildAuthorPublicPath(slug));
  }
  return paths;
}

/** Path `/penulis/{slug}` untuk slug baru dan lama (dedupe). */
export function authorPathsFromSlugs(
  slug?: string | null,
  previousSlug?: string | null,
): string[] {
  return uniqueSlugs(slug, previousSlug).map(buildAuthorPublicPath);
}

/**
 * Next 16: `{ expire: 0 }` = buang cache sekarang (bukan SWR).
 * `"max"` = stale-while-revalidate. `updateTag` hanya Server Action.
 */
function expireCacheTag(tag: string): void {
  revalidateTag(tag, { expire: 0 });
}

function revalidateListing(ctx?: ArticleListingContext): void {
  expireCacheTag(ARTICLE_LISTING_CACHE_TAG);
  for (const path of listingPathsFromContext(ctx)) {
    revalidatePath(path);
  }
}

/** Ambil slug artikel dari publicPath legacy atau structured (segmen terakhir). */
export function extractSlugFromPublicPath(publicPath: string): string | null {
  const normalized = normalizePublicPath(publicPath);
  if (!normalized) return null;

  const segments = normalized.replace(/^\/+/, "").split("/").filter(Boolean);
  if (segments.length === 0) return null;

  const last = segments[segments.length - 1];
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
}

function expireArticlePath(publicPath: string): void {
  const normalized = normalizePublicPath(publicPath);
  if (!normalized) return;

  const slug = extractSlugFromPublicPath(normalized);
  if (slug) {
    expireCacheTag(getArticleCacheTag(slug));
  }
  expireCacheTag(getArticleCacheTagFromPublicPath(normalized));
  revalidatePath(normalized);
}

/**
 * Invalidate ISR cache untuk halaman publik artikel + listing yang menampilkannya.
 * `publicPath` adalah path penuh, mis. `/news/slug` atau `/{cat}/{y}/{m}/{d}/{slug}`.
 */
export function revalidateArticlePage(
  publicPath: string,
  previousPublicPath?: string,
  listing?: ArticleListingContext,
): void {
  const normalized = normalizePublicPath(publicPath);
  if (!normalized) return;

  expireArticlePath(normalized);
  revalidatePath("/sitemap.xml");
  revalidatePath("/sitemap_news.xml");

  const prev = previousPublicPath?.trim()
    ? normalizePublicPath(previousPublicPath)
    : "";
  if (prev && prev !== normalized) {
    expireArticlePath(prev);
  }

  revalidateListing(listing);
}

/** Flush beranda & listing setelah kurasi homepage (headline/featured/dll). */
export function revalidateHomepageListings(): void {
  revalidateListing();
}

/** Flush ISR halaman profil penulis (`/penulis/{slug}`). */
export function revalidateAuthorPublicPage(
  slug?: string | null,
  previousSlug?: string | null,
): void {
  for (const path of authorPathsFromSlugs(slug, previousSlug)) {
    revalidatePath(path);
  }
}

/**
 * Flush listing yang menampilkan byline penulis (beranda, indeks, halaman penulis).
 * Dipakai saat nama/slug/avatar berubah.
 */
export function revalidateAuthorIdentityListings(
  slug?: string | null,
  previousSlug?: string | null,
): void {
  revalidateListing({
    authorSlug: slug,
    previousAuthorSlug: previousSlug,
  });
}
