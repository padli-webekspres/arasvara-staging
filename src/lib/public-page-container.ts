/** Padding horizontal konsisten halaman publik (selaras dengan NavbarContainer). */
export const PUBLIC_PAGE_PADDING_CLASS = "px-4 md:px-6 lg:px-8";

/** Container standar halaman listing (kategori, penulis, search, dll.). */
export const PUBLIC_PAGE_CONTAINER_CLASS = `container mx-auto w-full min-w-0 ${PUBLIC_PAGE_PADDING_CLASS}`;

/** Container halaman artikel dengan max-width reading column. */
export const PUBLIC_PAGE_ARTICLE_CONTAINER_CLASS = `${PUBLIC_PAGE_CONTAINER_CLASS} lg:max-w-6xl`;

export function getPublicPageContainerClass(options?: {
  articleMaxWidth?: boolean;
}): string {
  return options?.articleMaxWidth
    ? PUBLIC_PAGE_ARTICLE_CONTAINER_CLASS
    : PUBLIC_PAGE_CONTAINER_CLASS;
}
