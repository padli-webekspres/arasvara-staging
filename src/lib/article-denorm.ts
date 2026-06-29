import { Db, ObjectId } from "mongodb";
import { buildActiveUserFilter } from "@/lib/user-validation";
import { escapeRegexLiteral } from "@/services/auditLogService";

/** Field denormalisasi penulis pada dokumen `articles`. */
export type ArticleAuthorDenormFields = {
  "author.name": string;
  "author.slug": string;
  "author.role": string;
};

/** Field denormalisasi kategori pada dokumen `articles`. */
export type ArticleCategoryDenormFields = {
  "category.name": string;
  "category.slug": string;
};

export type ArticleDenormFields = Partial<
  ArticleAuthorDenormFields & ArticleCategoryDenormFields
>;

function toObjectId(value: unknown): ObjectId | null {
  if (value instanceof ObjectId) return value;
  try {
    return new ObjectId(String(value));
  } catch {
    return null;
  }
}

export function buildAuthorDenormFields(
  author: Record<string, unknown> | null | undefined,
): ArticleAuthorDenormFields | null {
  if (!author) return null;

  const name = String(author.name ?? "").trim();
  if (!name) return null;

  return {
    "author.name": name,
    "author.slug": author.slug ? String(author.slug).trim() : "",
    "author.role": String(author.role ?? "writer"),
  };
}

export function buildCategoryDenormFields(
  category: Record<string, unknown> | null | undefined,
): ArticleCategoryDenormFields | null {
  if (!category) return null;

  return {
    "category.name": String(category.name ?? "").trim(),
    "category.slug": String(category.slug ?? "").trim(),
  };
}

/**
 * Ambil field denormalisasi author + category untuk disimpan ke dokumen artikel.
 */
export async function resolveArticleDenormFields(
  db: Db,
  authorId?: unknown,
  categoryId?: unknown,
): Promise<ArticleDenormFields> {
  const authorOid = authorId ? toObjectId(authorId) : null;
  const categoryOid = categoryId ? toObjectId(categoryId) : null;

  const [authorDoc, categoryDoc] = await Promise.all([
    authorOid
      ? db
          .collection("users")
          .findOne(
            { _id: authorOid },
            { projection: { name: 1, slug: 1, role: 1 } },
          )
      : Promise.resolve(null),
    categoryOid
      ? db
          .collection("categories")
          .findOne(
            { _id: categoryOid },
            { projection: { name: 1, slug: 1 } },
          )
      : Promise.resolve(null),
  ]);

  return {
    ...(buildAuthorDenormFields(authorDoc) ?? {}),
    ...(buildCategoryDenormFields(categoryDoc) ?? {}),
  };
}

/**
 * Cari authorId dari koleksi `users` yang cocok dengan teks pencarian.
 * Dipakai sebagai fallback jika `author.name` di artikel belum ter-denormalisasi.
 */
export async function findAuthorIdsMatchingSearch(
  db: Db,
  searchTerm: string,
): Promise<ObjectId[]> {
  const trimmed = searchTerm.trim();
  if (!trimmed) return [];

  const regex = {
    $regex: escapeRegexLiteral(trimmed),
    $options: "i",
  };

  const users = await db
    .collection("users")
    .find(
      {
        ...buildActiveUserFilter(),
        $or: [{ name: regex }, { nameNormalized: regex }, { slug: regex }],
      },
      { projection: { _id: 1 } },
    )
    .toArray();

  const seen = new Set<string>();
  const ids: ObjectId[] = [];

  for (const user of users) {
    const id = toObjectId(user._id);
    if (!id) continue;
    const key = id.toString();
    if (seen.has(key)) continue;
    seen.add(key);
    ids.push(id);
  }

  return ids;
}
