/**
 * Folder di bucket utama untuk upload gambar artikel (flow presigned).
 * Dokumen/media lama tanpa prefiks ini tetap valid — key disimpan apa adanya di DB.
 */

export const ARTICLE_OBJECT_STORAGE_FOLDER = {
  FEATURED: "featured",
  CONTENT_IMAGES: "content-images",
  GALLERY_CONTENT: "gallery-content",
  MEDIA_LIBRARY: "media-library",
  SOCMED: "socmed",
  AVATARS: "avatars",
  CONFIGURATION: "configuration",
} as const;

export type ArticleObjectStorageFolder =
  (typeof ARTICLE_OBJECT_STORAGE_FOLDER)[keyof typeof ARTICLE_OBJECT_STORAGE_FOLDER];

/** Nilai yang diizinkan sebagai segmen pertama object key untuk artikel & media. */
export const ARTICLE_UPLOAD_FOLDER_VALUES = [
  ARTICLE_OBJECT_STORAGE_FOLDER.FEATURED,
  ARTICLE_OBJECT_STORAGE_FOLDER.CONTENT_IMAGES,
  ARTICLE_OBJECT_STORAGE_FOLDER.GALLERY_CONTENT,
  ARTICLE_OBJECT_STORAGE_FOLDER.MEDIA_LIBRARY,
  ARTICLE_OBJECT_STORAGE_FOLDER.SOCMED,
  ARTICLE_OBJECT_STORAGE_FOLDER.AVATARS,
  ARTICLE_OBJECT_STORAGE_FOLDER.CONFIGURATION,
] as const;

/**
 * Scope yang dikirim client (JSON) ke POST /api/media/presigned-url.
 * Dipetakan ke folder di server — bukan menerima path bebas dari client.
 */
export const ARTICLE_PRESIGNED_UPLOAD_SCOPES = [
  "featured",
  "content",
  "gallery",
  "media-library",
  "socmed",
  "avatars",
  "configuration",
] as const;

export type ArticlePresignedUploadScope =
  (typeof ARTICLE_PRESIGNED_UPLOAD_SCOPES)[number];

const SCOPE_TO_FOLDER: Record<
  ArticlePresignedUploadScope,
  ArticleObjectStorageFolder
> = {
  featured: ARTICLE_OBJECT_STORAGE_FOLDER.FEATURED,
  content: ARTICLE_OBJECT_STORAGE_FOLDER.CONTENT_IMAGES,
  gallery: ARTICLE_OBJECT_STORAGE_FOLDER.GALLERY_CONTENT,
  "media-library": ARTICLE_OBJECT_STORAGE_FOLDER.MEDIA_LIBRARY,
  socmed: ARTICLE_OBJECT_STORAGE_FOLDER.SOCMED,
  avatars: ARTICLE_OBJECT_STORAGE_FOLDER.AVATARS,
  configuration: ARTICLE_OBJECT_STORAGE_FOLDER.CONFIGURATION,
};

export function articleUploadScopeToFolder(
  scope: unknown,
): ArticleObjectStorageFolder | undefined {
  if (typeof scope !== "string") return undefined;
  if (
    !(ARTICLE_PRESIGNED_UPLOAD_SCOPES as readonly string[]).includes(scope)
  ) {
    return undefined;
  }
  return SCOPE_TO_FOLDER[scope as ArticlePresignedUploadScope];
}

export function isAllowedArticleUploadFolder(
  folder: string,
): folder is ArticleObjectStorageFolder {
  return (ARTICLE_UPLOAD_FOLDER_VALUES as readonly string[]).includes(folder);
}

/**
 * Scope opsional dari client. `undefined` / string kosih = tanpa subfolder (legacy).
 * String tidak kosong yang tidak dikenal → error (jangan fallback ke root).
 */
export function parseArticleUploadScopeForPresign(
  scope: unknown,
): ArticleObjectStorageFolder | undefined {
  if (scope === undefined || scope === null) return undefined;
  if (typeof scope !== "string") {
    throw new Error("INVALID_ARTICLE_UPLOAD_SCOPE");
  }
  const trimmed = scope.trim();
  if (trimmed === "") return undefined;
  const folder = articleUploadScopeToFolder(trimmed);
  if (!folder) throw new Error("INVALID_ARTICLE_UPLOAD_SCOPE");
  return folder;
}
