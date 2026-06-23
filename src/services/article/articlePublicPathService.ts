import { Db, ObjectId } from "mongodb";
import logger from "@/lib/logger";
import {
  buildArticlePublicPath,
  resolveUrlFormatForNewArticle,
} from "@/lib/article-public-path";
import { ArticleStatus, type ArticleUrlFormat } from "@/types/article";

export type PublicPathFields = {
  publicPath: string | null;
  urlFormat: ArticleUrlFormat;
};

function normalizeStatus(status: unknown): ArticleStatus | string {
  return String(status ?? "")
    .trim()
    .toUpperCase();
}

function coercePublishedAt(value: unknown): Date | null {
  if (value == null) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function resolveUrlFormatFromDoc(doc: Record<string, unknown>): ArticleUrlFormat {
  const existing = doc.urlFormat;
  if (existing === "legacy" || existing === "structured") {
    return existing;
  }
  return resolveUrlFormatForNewArticle();
}

export async function resolveCategorySlug(
  db: Db,
  categoryId: unknown,
): Promise<string | null> {
  if (categoryId == null || categoryId === "") return null;

  let oid: ObjectId;
  try {
    oid =
      categoryId instanceof ObjectId
        ? categoryId
        : new ObjectId(String(categoryId));
  } catch {
    return null;
  }

  const category = await db
    .collection("categories")
    .findOne({ _id: oid }, { projection: { slug: 1 } });

  const slug = category?.slug;
  return slug ? String(slug).trim() : null;
}

export function buildPublicPathFields(input: {
  slug: string;
  publishedAt?: Date | null;
  status: ArticleStatus | string;
  urlFormat?: ArticleUrlFormat;
  categorySlug?: string | null;
}): PublicPathFields {
  const urlFormat = input.urlFormat ?? resolveUrlFormatForNewArticle();
  const status = normalizeStatus(input.status);

  try {
    const publicPath = buildArticlePublicPath({
      slug: input.slug,
      publishedAt: input.publishedAt,
      categorySlug: input.categorySlug,
      urlFormat,
      status,
    });
    return { publicPath, urlFormat };
  } catch (err) {
    logger.error(
      { err, slug: input.slug, status, urlFormat },
      "buildPublicPathFields gagal",
    );
    throw err;
  }
}

export async function buildPublicPathFieldsForDoc(
  db: Db,
  doc: Record<string, unknown>,
  overrides?: Partial<{
    slug: string;
    publishedAt: Date | null;
    status: ArticleStatus | string;
    categoryId: unknown;
    categorySlug: string | null;
    urlFormat: ArticleUrlFormat;
  }>,
): Promise<PublicPathFields> {
  const slug = String(overrides?.slug ?? doc.slug ?? "").trim();
  const status = normalizeStatus(overrides?.status ?? doc.status);
  const publishedAt =
    overrides?.publishedAt !== undefined
      ? overrides.publishedAt
      : coercePublishedAt(doc.publishedAt);
  const urlFormat = overrides?.urlFormat ?? resolveUrlFormatFromDoc(doc);

  let categorySlug = overrides?.categorySlug ?? null;
  if (!categorySlug) {
    const embedded = doc.category as { slug?: string } | undefined;
    if (embedded?.slug) {
      categorySlug = String(embedded.slug).trim();
    }
  }
  if (!categorySlug) {
    const categoryId =
      overrides?.categoryId !== undefined ? overrides.categoryId : doc.categoryId;
    categorySlug = await resolveCategorySlug(db, categoryId);
  }

  return buildPublicPathFields({
    slug,
    publishedAt,
    status,
    urlFormat,
    categorySlug,
  });
}

export type RecomputeArticlePublicPathResult = PublicPathFields & {
  previousPublicPath: string | null;
};

export async function recomputeArticlePublicPath(
  db: Db,
  articleDoc: Record<string, unknown>,
  overrides?: Parameters<typeof buildPublicPathFieldsForDoc>[2],
): Promise<RecomputeArticlePublicPathResult> {
  const previousRaw = articleDoc.publicPath;
  const previousPublicPath =
    previousRaw == null || String(previousRaw).trim() === ""
      ? null
      : String(previousRaw);

  const fields = await buildPublicPathFieldsForDoc(db, articleDoc, overrides);

  return {
    ...fields,
    previousPublicPath,
  };
}

/**
 * Merge state artikel existing + updates untuk recompute sebelum write.
 */
export async function recomputeArticlePublicPathFromUpdates(
  db: Db,
  existing: Record<string, unknown>,
  updates: Record<string, unknown>,
): Promise<RecomputeArticlePublicPathResult> {
  const mergedStatus = updates.status ?? existing.status;
  const mergedSlug =
    updates.slug !== undefined ? String(updates.slug) : String(existing.slug ?? "");
  const mergedPublishedAt =
    updates.publishedAt !== undefined
      ? coercePublishedAt(updates.publishedAt)
      : coercePublishedAt(existing.publishedAt);
  const mergedCategoryId =
    updates.categoryId !== undefined ? updates.categoryId : existing.categoryId;

  return recomputeArticlePublicPath(db, existing, {
    slug: mergedSlug,
    status: String(mergedStatus),
    publishedAt: mergedPublishedAt,
    categoryId: mergedCategoryId,
  });
}
