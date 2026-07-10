import { ROLES } from "@/lib/auth-client";

const AUTHOR_PREFIX = "/penulis";

/** Role yang boleh punya halaman profil publik `/penulis/{slug}`. */
export const PUBLIC_PROFILE_ROLES = [ROLES.WRITER, ROLES.EDITOR] as const;

/** Jumlah artikel pada muatan awal halaman penulis. */
export const AUTHOR_PAGE_INITIAL_LIMIT = 14;

/** Jumlah artikel per muatan "lihat berita lainnya". */
export const AUTHOR_PAGE_LOAD_MORE_LIMIT = 12;

/** Cek apakah role user eligible untuk halaman profil publik. */
export function isPublicProfileRole(role?: string | null): boolean {
  if (!role?.trim()) return false;
  const normalized = role.trim().toLowerCase();
  return PUBLIC_PROFILE_ROLES.some((r) => r === normalized);
}

/** Encode satu segmen slug untuk path URL. */
export function encodeAuthorSlugSegment(slug: string): string {
  const trimmed = slug.trim();
  if (!trimmed) return "";
  return encodeURIComponent(trimmed);
}

/** Bangun path publik halaman penulis: `/penulis/{slug}`. */
export function buildAuthorPublicPath(slug: string): string {
  const encoded = encodeAuthorSlugSegment(slug);
  if (!encoded) return AUTHOR_PREFIX;
  return `${AUTHOR_PREFIX}/${encoded}`;
}

/** Resolve href publik penulis; null jika slug/role tidak eligible. */
export function resolveAuthorPublicHref(
  profile?: { slug?: string | null; role?: string | null } | null,
): string | null {
  const slug = profile?.slug?.trim().toLowerCase();
  if (!slug || !isPublicProfileRole(profile?.role)) return null;
  return buildAuthorPublicPath(slug);
}
