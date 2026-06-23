const AUTHOR_PREFIX = "/author";

/** Encode satu segmen slug untuk path URL. */
export function encodeAuthorSlugSegment(slug: string): string {
  const trimmed = slug.trim();
  if (!trimmed) return "";
  return encodeURIComponent(trimmed);
}

/** Bangun path publik halaman penulis: `/author/{slug}`. */
export function buildAuthorPublicPath(slug: string): string {
  const encoded = encodeAuthorSlugSegment(slug);
  if (!encoded) return AUTHOR_PREFIX;
  return `${AUTHOR_PREFIX}/${encoded}`;
}

/** Resolve href publik penulis; null jika slug belum tersedia. */
export function resolveAuthorPublicHref(
  author?: { slug?: string | null } | null,
): string | null {
  const slug = author?.slug?.trim().toLowerCase();
  if (!slug) return null;
  return buildAuthorPublicPath(slug);
}
