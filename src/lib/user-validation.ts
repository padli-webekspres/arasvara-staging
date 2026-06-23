import slugify from "slugify";

export type UserValidationCode = "DUPLICATE_NAME" | "DUPLICATE_SLUG";

export class UserValidationError extends Error {
  status: number;
  code: UserValidationCode;

  constructor(message: string, code: UserValidationCode) {
    super(message);
    this.name = "UserValidationError";
    this.status = 409;
    this.code = code;
  }
}

/** Filter user yang belum di-soft-delete. */
export function buildActiveUserFilter(): Record<string, unknown> {
  return {
    $or: [
      { deletedAt: null },
      { deletedAt: "" },
      { deletedAt: { $exists: false } },
    ],
  };
}

/** User boleh tampil di halaman publik /author/{slug}. */
export function isUserPubliclyVisible(
  doc: Record<string, unknown> | null | undefined,
): boolean {
  if (!doc) return false;
  const deletedAt = doc.deletedAt;
  if (deletedAt != null && deletedAt !== "") return false;
  if (doc.isActive === false) return false;
  return true;
}

/**
 * Normalisasi nama untuk perbandingan unik:
 * trim → lowercase → NFKD → hapus tanda baca/simbol → collapse whitespace.
 */
export function normalizeUserName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\p{P}\p{S}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Slug URL dari nama tampilan. */
export function generateUserSlug(name: string): string {
  return slugify(name.trim(), { lower: true, strict: true });
}

/** Nilai nameNormalized untuk disimpan ke dokumen. */
export function nameNormalizedForStorage(name: string): string | null {
  const normalized = normalizeUserName(name);
  return normalized || null;
}
