import { Db, ObjectId } from "mongodb";
import {
  UserValidationError,
  buildActiveUserFilter,
  generateUserSlug,
  normalizeUserName,
} from "@/lib/user-validation";

function excludeIdFilter(
  excludeId?: string | ObjectId,
): Record<string, unknown> {
  if (!excludeId) return {};
  const oid =
    excludeId instanceof ObjectId ? excludeId : new ObjectId(String(excludeId));
  return { _id: { $ne: oid } };
}

/**
 * Cek konflik nama pada user aktif.
 * Menggunakan nameNormalized jika ada; fallback normalisasi name mentah.
 */
export async function findUserNameConflict(
  db: Db,
  name: string,
  excludeId?: string | ObjectId,
): Promise<{ _id: ObjectId; name: string } | null> {
  const normalized = normalizeUserName(name);
  if (!normalized) return null;

  const baseFilter = {
    ...buildActiveUserFilter(),
    ...excludeIdFilter(excludeId),
  };

  const byNormalized = await db.collection("users").findOne(
    { ...baseFilter, nameNormalized: normalized },
    { projection: { _id: 1, name: 1 } },
  );
  if (byNormalized) {
    return {
      _id: byNormalized._id as ObjectId,
      name: String(byNormalized.name ?? ""),
    };
  }

  const legacyCandidates = await db
    .collection("users")
    .find({
      ...baseFilter,
      $or: [
        { nameNormalized: { $exists: false } },
        { nameNormalized: null },
        { nameNormalized: "" },
      ],
    })
    .project({ _id: 1, name: 1 })
    .toArray();

  for (const doc of legacyCandidates) {
    const docName = String(doc.name ?? "");
    if (normalizeUserName(docName) === normalized) {
      return { _id: doc._id as ObjectId, name: docName };
    }
  }

  return null;
}

export async function assertUniqueUserName(
  db: Db,
  name: string,
  excludeId?: string | ObjectId,
): Promise<void> {
  const conflict = await findUserNameConflict(db, name, excludeId);
  if (conflict) {
    throw new UserValidationError(
      "Nama pengguna sudah digunakan",
      "DUPLICATE_NAME",
    );
  }
}

export async function findUserSlugConflict(
  db: Db,
  slug: string,
  excludeId?: string | ObjectId,
): Promise<{ _id: ObjectId; name: string; slug: string } | null> {
  const trimmed = slug.trim();
  if (!trimmed) return null;

  const doc = await db.collection("users").findOne(
    {
      ...buildActiveUserFilter(),
      ...excludeIdFilter(excludeId),
      slug: trimmed,
    },
    { projection: { _id: 1, name: 1, slug: 1 } },
  );

  if (!doc) return null;
  return {
    _id: doc._id as ObjectId,
    name: String(doc.name ?? ""),
    slug: String(doc.slug ?? ""),
  };
}

export async function assertUniqueUserSlug(
  db: Db,
  slug: string,
  excludeId?: string | ObjectId,
): Promise<void> {
  const conflict = await findUserSlugConflict(db, slug, excludeId);
  if (conflict) {
    throw new UserValidationError(
      "Slug pengguna sudah digunakan",
      "DUPLICATE_SLUG",
    );
  }
}

const SLUG_SUFFIX_PATTERN = /-(\d+)$/;

/**
 * Bangun slug unik dari nama; tambah suffix -2, -3, … jika bentrok.
 */
export async function resolveUniqueUserSlug(
  db: Db,
  name: string,
  excludeId?: string | ObjectId,
): Promise<string> {
  const base = generateUserSlug(name);
  if (!base) {
    throw Object.assign(new Error("Nama tidak menghasilkan slug valid"), {
      status: 400,
    });
  }

  const conflict = await findUserSlugConflict(db, base, excludeId);
  if (!conflict) return base;

  let suffix = 2;
  const baseWithoutSuffix = base.replace(SLUG_SUFFIX_PATTERN, "");

  while (suffix < 1000) {
    const candidate = `${baseWithoutSuffix}-${suffix}`;
    const nextConflict = await findUserSlugConflict(db, candidate, excludeId);
    if (!nextConflict) return candidate;
    suffix += 1;
  }

  throw new UserValidationError(
    "Slug pengguna sudah digunakan",
    "DUPLICATE_SLUG",
  );
}
