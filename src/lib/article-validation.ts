import { Db, ObjectId } from "mongodb";
import slugify from "slugify";
import { generateArticleSlug } from "@/lib/helper-article";

export type ArticleValidationCode = "DUPLICATE_TITLE" | "DUPLICATE_SLUG";

export class ArticleValidationError extends Error {
  status: number;
  code: ArticleValidationCode;

  constructor(message: string, code: ArticleValidationCode) {
    super(message);
    this.name = "ArticleValidationError";
    this.status = 409;
    this.code = code;
  }
}

/** Filter artikel yang belum di-soft-delete. */
export function buildActiveArticleFilter(): Record<string, unknown> {
  return { deletedAt: { $in: [null, ""] } };
}

/**
 * Normalisasi judul untuk perbandingan unik:
 * trim → lowercase → NFKD → hapus tanda baca/simbol → collapse whitespace.
 */
export function normalizeArticleTitle(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\p{P}\p{S}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Judul placeholder draft — boleh duplikat (Untitled / kosong). */
export function isPlaceholderArticleTitle(title: string): boolean {
  const trimmed = title.trim();
  if (!trimmed) return true;
  return trimmed.toLowerCase() === "untitled";
}

/** Slug untuk judul normal atau draft placeholder. */
export function resolveArticleSlug(
  title: string,
  draftObjectId?: ObjectId,
): string {
  if (isPlaceholderArticleTitle(title)) {
    const id = draftObjectId ?? new ObjectId();
    return `untitled-${id.toHexString()}`;
  }
  return generateArticleSlug(title);
}

function excludeIdFilter(
  excludeId?: string | ObjectId,
): Record<string, unknown> {
  if (!excludeId) return {};
  const oid =
    excludeId instanceof ObjectId ? excludeId : new ObjectId(String(excludeId));
  return { _id: { $ne: oid } };
}

/**
 * Cek konflik judul pada artikel aktif.
 * Menggunakan titleNormalized jika ada; fallback normalisasi title mentah.
 */
export async function findArticleTitleConflict(
  db: Db,
  title: string,
  excludeId?: string | ObjectId,
): Promise<{ _id: ObjectId; title: string } | null> {
  if (isPlaceholderArticleTitle(title)) return null;

  const normalized = normalizeArticleTitle(title);
  if (!normalized) return null;

  const baseFilter = {
    ...buildActiveArticleFilter(),
    ...excludeIdFilter(excludeId),
  };

  const byNormalized = await db.collection("articles").findOne(
    { ...baseFilter, titleNormalized: normalized },
    { projection: { _id: 1, title: 1 } },
  );
  if (byNormalized) {
    return {
      _id: byNormalized._id as ObjectId,
      title: String(byNormalized.title ?? ""),
    };
  }

  const legacyCandidates = await db
    .collection("articles")
    .find({
      ...baseFilter,
      $or: [
        { titleNormalized: { $exists: false } },
        { titleNormalized: null },
        { titleNormalized: "" },
      ],
    })
    .project({ _id: 1, title: 1 })
    .toArray();

  for (const doc of legacyCandidates) {
    const docTitle = String(doc.title ?? "");
    if (normalizeArticleTitle(docTitle) === normalized) {
      return { _id: doc._id as ObjectId, title: docTitle };
    }
  }

  return null;
}

export async function assertUniqueArticleTitle(
  db: Db,
  title: string,
  excludeId?: string | ObjectId,
): Promise<void> {
  const conflict = await findArticleTitleConflict(db, title, excludeId);
  if (conflict) {
    throw new ArticleValidationError(
      "Judul artikel sudah digunakan",
      "DUPLICATE_TITLE",
    );
  }
}

export async function findArticleSlugConflict(
  db: Db,
  slug: string,
  excludeId?: string | ObjectId,
): Promise<{ _id: ObjectId; title: string; slug: string } | null> {
  const trimmed = slug.trim();
  if (!trimmed) return null;

  const doc = await db.collection("articles").findOne(
    {
      ...buildActiveArticleFilter(),
      ...excludeIdFilter(excludeId),
      slug: trimmed,
    },
    { projection: { _id: 1, title: 1, slug: 1 } },
  );

  if (!doc) return null;
  return {
    _id: doc._id as ObjectId,
    title: String(doc.title ?? ""),
    slug: String(doc.slug ?? ""),
  };
}

export async function assertUniqueArticleSlug(
  db: Db,
  slug: string,
  excludeId?: string | ObjectId,
): Promise<void> {
  const conflict = await findArticleSlugConflict(db, slug, excludeId);
  if (conflict) {
    throw new ArticleValidationError(
      "Slug artikel sudah digunakan",
      "DUPLICATE_SLUG",
    );
  }
}

/** Nilai titleNormalized untuk disimpan ke dokumen (null jika placeholder). */
export function titleNormalizedForStorage(title: string): string | null {
  if (isPlaceholderArticleTitle(title)) return null;
  const normalized = normalizeArticleTitle(title);
  return normalized || null;
}

/** Pasangan judul berbeda yang slugify-nya sama (untuk audit). */
export function findSlugifyCollisions(
  articles: Array<{ _id: string; title: string }>,
): Array<{ slug: string; articles: Array<{ _id: string; title: string }> }> {
  const bySlug = new Map<string, Array<{ _id: string; title: string }>>();

  for (const article of articles) {
    const slug = generateArticleSlug(article.title);
    const list = bySlug.get(slug) ?? [];
    list.push(article);
    bySlug.set(slug, list);
  }

  const collisions: Array<{
    slug: string;
    articles: Array<{ _id: string; title: string }>;
  }> = [];

  for (const [slug, group] of bySlug) {
    const uniqueTitles = new Set(
      group.map((a) => normalizeArticleTitle(a.title)),
    );
    if (group.length > 1 && uniqueTitles.size > 1) {
      collisions.push({ slug, articles: group });
    }
  }

  return collisions;
}

const LEGACY_SLUG_SUFFIX = /-[a-f0-9]{8}$/;

export function hasLegacySlugSuffix(slug: string): boolean {
  return LEGACY_SLUG_SUFFIX.test(slug);
}
