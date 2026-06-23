import { DateTime } from "luxon";
import { ArticleStatus, type ArticleUrlFormat } from "@/types/article";

/**
 * Denormalized canonical path for published articles.
 *
 * MongoDB schema:
 * - `articles.publicPath`: string | null — sparse unique index
 * - `articles.urlFormat`: "legacy" | "structured"
 */

const WIB_ZONE = "Asia/Jakarta";
const NEWS_PREFIX = "/news";

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

export function buildLegacyArticlePath(slug: string): string {
  const cleanSlug = slug.trim();
  if (!cleanSlug) {
    throw new ArticlePublicPathError("Slug artikel wajib untuk legacy publicPath");
  }
  return `${NEWS_PREFIX}/${encodePathSegment(cleanSlug)}`;
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
  if (!articleSlug) {
    throw new ArticlePublicPathError(
      "articleSlug wajib untuk structured publicPath",
    );
  }

  const { year, month, day } = publishedAtToWibDateParts(input.publishedAt);
  return `${NEWS_PREFIX}/${encodePathSegment(categorySlug)}/${year}/${pad2(month)}/${pad2(day)}/${encodePathSegment(articleSlug)}`;
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

/**
 * Parse URL segments after `/news/` into legacy or structured lookup shape.
 */
export function parseNewsArticlePath(
  segments: string[],
): ParsedNewsArticlePath | null {
  if (!Array.isArray(segments) || segments.length === 0) {
    return null;
  }

  const cleaned = segments
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (cleaned.length === 0) return null;

  if (cleaned.length === 1) {
    try {
      return { kind: "legacy", slug: decodeURIComponent(cleaned[0]) };
    } catch {
      return { kind: "legacy", slug: cleaned[0] };
    }
  }

  if (cleaned.length === 5) {
    const [categorySlug, year, month, day, articleSlug] = cleaned;
    const publicPath = `${NEWS_PREFIX}/${categorySlug}/${year}/${month}/${day}/${articleSlug}`;
    return { kind: "structured", publicPath };
  }

  return null;
}

/** True jika path berbentuk /news/{cat}/{y}/{m}/{d}/{slug} (5 segmen). */
export function isStructuredPublicPath(
  publicPath: string | null | undefined,
): boolean {
  const path = publicPath?.trim();
  if (!path) return false;
  const segments = path
    .replace(/^\/news\/?/, "")
    .split("/")
    .filter(Boolean);
  return segments.length === 5;
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
  category?: { slug?: string | null } | null;
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
