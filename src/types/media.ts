export interface Media extends PayloadCreateMedia {
  _id: string;
  createdAt: string;
  updatedAt: string;
}

export interface PayloadCreateMedia {
  url: string;
  filename: string;
  mimetype: string;
  size: number;
  caption?: string;
  credit?: string;
  watermark?: boolean;
}

/**
 * Media yang belum diunggah ke server — disimpan di IndexedDB sebagai Blob.
 * `_id: null` membedakannya dari `Media` yang sudah tersimpan di database.
 */
export interface PendingMedia {
  _id: null;
  idbKey: string;
  blobUrl: string;
  filename: string;
  size: number;
  mimetype: "image/webp";
  url: string; // same as blobUrl — kept for interface symmetry
  caption?: string;
  credit?: string;
  watermark?: boolean;
}

export interface MediaUsageInArticle {
  _id: string;
  title: string;
  slug: string;
  usedAs: ("featured" | "content")[];
}
