import { DateTime } from "luxon";
import { ArticleStatus, type ArticleUrlFormat } from "@/types/article";

/**
 * Denormalized canonical path for published articles.
 *
 * MongoDB schema:
 * - `articles.publicPath`: string | null — sparse unique index
 * - `articles.urlFormat`: "legacy" | "structured"
 *
 * Structured: /{categorySlug}/{yyyy}/{mm}/{dd}/{articleSlug}
 * Legacy:     /news/{articleSlug} (1 segmen setelah /news/)
 *
 * Kategori slug `news` diizinkan untuk structured (/news/{y}/{m}/{d}/{slug}).
 * Legacy tetap /news/{slug} — dibedakan lewat jumlah segmen (1 vs 5).
 */

const WIB_ZONE = "Asia/Jakarta";
const LEGACY_NEWS_PREFIX = "/news";

/** Root segments yang tidak boleh jadi category slug (bukan termasuk `news` karena `news` diizinkan untuk 5-segmen structured article path). */
export const RESERVED_ROOT_SEGMENTS = new Set([
  "category",
  "search",
  "indeks",
  "author",
  "penulis",
  "about-us",
  "disclaimer",
  "pedoman-media-siber",
  "login",
  "admin-xyz",
  "api",
]);

export type WibDateParts = {
  year: number;
  month: number;
  day: number;
};

export type ParsedNewsArticlePath =
  | { kind: "legacy"; slug: string }
  | { kind: "structured"; publicPath: string };

export type BuildArticlePublicPathInput = {
  slug: string;
  publishedAt: Date | null | undefined;
  categorySlug: string | null | undefined;
  urlFormat: ArticleUrlFormat;
  status?: ArticleStatus | string;
};

export class ArticlePublicPathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArticlePublicPathError";
  }
}

/** Whether structured URL generation is enabled (default: true). */
export function isStructuredUrlEnabled(): boolean {
  return process.env.ARTICLE_STRUCTURED_URL_ENABLED !== "false";
}

/** URL format assigned to newly created articles. */
export function resolveUrlFormatForNewArticle(): ArticleUrlFormat {
  return isStructuredUrlEnabled() ? "structured" : "legacy";
}

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function isReservedRootSegment(segment: string): boolean {
  const normalized = segment.trim().toLowerCase();
  return RESERVED_ROOT_SEGMENTS.has(normalized);
}

/**
 * Convert UTC `publishedAt` to calendar date parts in WIB (Asia/Jakarta).
 */
export function publishedAtToWibDateParts(publishedAt: Date): WibDateParts {
  const wib = DateTime.fromJSDate(publishedAt, { zone: "utc" }).setZone(WIB_ZONE);
  return { year: wib.year, month: wib.month, day: wib.day };
}

function encodePathSegment(value: string): string {
  return encodeURIComponent(value.trim());
}

function decodePathSegment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function cleanSegments(segments: string[]): string[] {
  if (!Array.isArray(segments)) return [];
  return segments.map((segment) => segment.trim()).filter(Boolean);
}

function isValidDateSegments(year: string, month: string, day: string): boolean {
  if (!/^\d{4}$/.test(year)) return false;
  if (!/^\d{1,2}$/.test(month) || !/^\d{1,2}$/.test(day)) return false;

  const monthNum = Number(month);
  const dayNum = Number(day);
  if (monthNum < 1 || monthNum > 12) return false;
  if (dayNum < 1 || dayNum > 31) return false;

  return true;
}

export function buildLegacyArticlePath(slug: string): string {
  const cleanSlug = slug.trim();
  if (!cleanSlug) {
    throw new ArticlePublicPathError("Slug artikel wajib untuk legacy publicPath");
  }
  return `${LEGACY_NEWS_PREFIX}/${encodePathSegment(cleanSlug)}`;
}

export function buildStructuredArticlePath(input: {
  categorySlug: string;
  publishedAt: Date;
  articleSlug: string;
}): string {
  const categorySlug = input.categorySlug.trim();
  const articleSlug = input.articleSlug.trim();
  if (!categorySlug) {
    throw new ArticlePublicPathError(
      "categorySlug wajib untuk structured publicPath",
    );
  }
  if (isReservedRootSegment(categorySlug)) {
    throw new ArticlePublicPathError(
      `categorySlug "${categorySlug}" reserved untuk route root`,
    );
  }
  if (!articleSlug) {
    throw new ArticlePublicPathError(
      "articleSlug wajib untuk structured publicPath",
    );
  }

  const { year, month, day } = publishedAtToWibDateParts(input.publishedAt);
  return `/${encodePathSegment(categorySlug)}/${year}/${pad2(month)}/${pad2(day)}/${encodePathSegment(articleSlug)}`;
}

function buildStructuredPublicPathFromSegments(segments: string[]): string {
  const [categorySlug, year, month, day, articleSlug] = segments;
  return `/${categorySlug}/${year}/${month}/${day}/${articleSlug}`;
}

function normalizeArticleStatus(
  status: ArticleStatus | string | undefined,
): string {
  return String(status ?? "")
    .trim()
    .toUpperCase();
}

function coercePublishedAt(
  value: Date | null | undefined,
): Date | null {
  if (value == null) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Build canonical public path from current article state.
 * Returns null for non-published articles or missing publishedAt.
 */
export function buildArticlePublicPath(
  input: BuildArticlePublicPathInput,
): string | null {
  const status = normalizeArticleStatus(input.status);
  const publishedAt = coercePublishedAt(input.publishedAt);
  const slug = input.slug.trim();

  if (status !== ArticleStatus.PUBLISHED || !publishedAt || !slug) {
    return null;
  }

  if (input.urlFormat === "legacy") {
    return buildLegacyArticlePath(slug);
  }

  const categorySlug = input.categorySlug?.trim();
  if (!categorySlug) {
    throw new ArticlePublicPathError(
      `categorySlug wajib untuk structured publicPath (slug="${slug}")`,
    );
  }

  return buildStructuredArticlePath({
    categorySlug,
    publishedAt,
    articleSlug: slug,
  });
}

function normalizeComparablePath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) return "";
  const withoutTrailing = trimmed.replace(/\/+$/, "");
  try {
    return decodeURIComponent(withoutTrailing);
  } catch {
    return withoutTrailing;
  }
}

export function pathsEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = normalizeComparablePath(String(a ?? ""));
  const right = normalizeComparablePath(String(b ?? ""));
  return left === right;
}

/** Parse URL segments after `/news/` for legacy single-slug lookup. */
export function parseLegacyNewsSegments(
  segments: string[],
): { kind: "legacy"; slug: string } | null {
  const cleaned = cleanSegments(segments);
  if (cleaned.length !== 1) return null;

  return { kind: "legacy", slug: decodePathSegment(cleaned[0]) };
}

/** Parse root URL segments for structured article lookup (5 segments). */
export function parseStructuredArticleSegments(
  segments: string[],
): { kind: "structured"; publicPath: string } | null {
  const cleaned = cleanSegments(segments);
  if (cleaned.length !== 5) return null;

  const [categorySlug, year, month, day, articleSlug] = cleaned;
  if (isReservedRootSegment(categorySlug)) return null;
  if (!isValidDateSegments(year, month, day)) return null;

  return {
    kind: "structured",
    publicPath: buildStructuredPublicPathFromSegments(cleaned),
  };
}

/**
 * @deprecated Use `parseLegacyNewsSegments` or `parseStructuredArticleSegments`.
 * Legacy wrapper — only parses single-segment paths under `/news/`.
 */
export function parseNewsArticlePath(
  segments: string[],
): ParsedNewsArticlePath | null {
  return parseLegacyNewsSegments(segments);
}

/** True jika path berbentuk /{cat}/{y}/{m}/{d}/{slug} (5 segmen + tanggal valid). */
export function isStructuredPublicPath(
  publicPath: string | null | undefined,
): boolean {
  const path = publicPath?.trim();
  if (!path) return false;

  const segments = path.replace(/^\/+/, "").split("/").filter(Boolean);
  if (segments.length !== 5) return false;

  const [categorySlug, year, month, day] = segments;
  if (isReservedRootSegment(categorySlug)) return false;
  return isValidDateSegments(year, month, day);
}

/** Href internal untuk kartu artikel — prefer publicPath, fallback legacy slug. */
export function resolveArticleHref(article: {
  slug?: string | null;
  publicPath?: string | null;
}): string {
  const path = article.publicPath?.trim();
  if (path) return path;
  const slug = article.slug?.trim();
  if (slug) return `/news/${slug}`;
  return "#";
}

/** Href publik — structured publicPath, atau dihitung dari kategori + tanggal + slug. */
export function resolvePublicArticleHref(article: {
  slug?: string | null;
  publicPath?: string | null;
  category?: { slug?: string | null; name?: string | null } | null;
  categorySlug?: string | null;
  publishedAt?: Date | string | null;
}): string {
  const path = article.publicPath?.trim();
  if (path && isStructuredPublicPath(path)) return path;

  const categorySlug =
    article.categorySlug?.trim() ?? article.category?.slug?.trim();
  const computed = tryBuildStructuredArticleHref({
    slug: article.slug ?? "",
    categorySlug,
    publishedAt: article.publishedAt,
  });
  if (computed) return computed;

  return "#";
}

/**
 * Href "Lihat" dari CMS admin:
 * - PUBLISHED → publicPath structured, atau dihitung dari kategori + tanggal + slug
 * - lainnya → /news/{slug} (preview staf, butuh auth)
 */
export function resolveCmsArticleViewHref(article: {
  status: ArticleStatus | string;
  slug?: string | null;
  publicPath?: string | null;
  categorySlug?: string | null;
  publishedAt?: Date | string | null;
}): string {
  const status = normalizeArticleStatus(article.status);
  const slug = article.slug?.trim() ?? "";
  const publicPath = article.publicPath?.trim() ?? "";

  if (status === ArticleStatus.PUBLISHED) {
    if (publicPath && isStructuredPublicPath(publicPath)) return publicPath;

    const computed = tryBuildStructuredArticleHref({
      slug,
      categorySlug: article.categorySlug,
      publishedAt: article.publishedAt,
    });
    if (computed) return computed;

    return "#";
  }

  if (slug) return buildLegacyArticlePath(slug);
  return "#";
}

function tryBuildStructuredArticleHref(input: {
  slug: string;
  categorySlug?: string | null;
  publishedAt?: Date | string | null;
}): string | null {
  const categorySlug = input.categorySlug?.trim();
  const slug = input.slug?.trim();
  if (!categorySlug || !slug) return null;

  const publishedAt = input.publishedAt;
  if (!publishedAt) return null;

  const date =
    publishedAt instanceof Date ? publishedAt : new Date(publishedAt);
  if (Number.isNaN(date.getTime())) return null;

  try {
    return buildStructuredArticlePath({
      categorySlug,
      publishedAt: date,
      articleSlug: slug,
    });
  } catch {
    return null;
  }
}

/** Validasi apakah string path adalah publicPath artikel yang dikenali. */
export function isValidArticlePublicPath(path: string): boolean {
  const trimmed = path.trim();
  if (!trimmed.startsWith("/")) return false;

  if (isStructuredPublicPath(trimmed)) return true;

  if (trimmed.startsWith(`${LEGACY_NEWS_PREFIX}/`)) {
    const legacySegments = trimmed
      .slice(`${LEGACY_NEWS_PREFIX}/`.length)
      .split("/")
      .filter(Boolean);
    return legacySegments.length === 1;
  }

  return false;
}
