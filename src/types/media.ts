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
 * Media yang belum dipromosikan — blob sudah diproses server & disimpan
 * sementara di folder `temp/` object storage (instant upload, bukan IndexedDB).
 * `_id: null` membedakannya dari `Media` yang sudah tersimpan di database.
 */
export interface PendingMedia {
  _id: null;
  /** ID objek di folder `temp/` — dipakai saat promote (POST /media/promote-temp). */
  tempMediaId: string;
  /** URL preview server — aman setelah reload (tidak bergantung IndexedDB). */
  tempUrl: string;
  filename: string;
  size: number;
  mimetype: "image/webp";
  url: string; // same as tempUrl — kept for interface symmetry
  caption?: string;
  credit?: string;
  watermark?: boolean;
}

/** Response `POST /api/media/process-temp`. */
export interface TempMediaUploadResult {
  success: boolean;
  tempMediaId: string;
  tempUrl: string;
  filename: string;
  size: number;
  mimetype: string;
}

export interface MediaUsageInArticle {
  _id: string;
  title: string;
  slug: string;
  status: string;
  usedAs: ("featured" | "content" | "gallery")[];
}
