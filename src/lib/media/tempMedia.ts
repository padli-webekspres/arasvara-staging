/**
 * Helper untuk media draft yang di-upload sementara ke object storage
 * (folder `temp/`) sebelum dipromosikan ke folder final saat submit artikel.
 *
 * Alur baru (issue iPad — offload processing + hapus IndexedDB):
 * 1. `POST /api/media/process-temp`  — klien upload hasil crop; server memproses
 *    (decode HEIC/JPEG/PNG, kompresi WebP, watermark) lalu simpan `temp/{id}.webp`.
 * 2. Preview draft & galeri memakai `tempUrl` (URL server — aman setelah reload,
 *    tidak bergantung IndexedDB yang rawan di-evict Safari iOS).
 * 3. `POST /api/media/promote-temp`  — saat submit, pindah objek ke folder final
 *    (featured | content-images | gallery-content) + buat row di koleksi `media`.
 * 4. `POST /api/media/cleanup-temp`  — scheduler hapus objek `temp/` > 24 jam.
 */

export const TEMP_MEDIA_FOLDER = "temp";

/** Temp media yang tidak pernah di-promote akan dihapus scheduler setelah ini. */
export const TEMP_MEDIA_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** ID temp media dibuat dari ULID — aman untuk dijadikan segmen object key. */
const TEMP_MEDIA_ID_REGEX = /^[A-Za-z0-9-]{8,64}$/;

/** Key object storage untuk media temp: `temp/{id}.webp`. */
export function buildTempMediaKey(tempMediaId: string): string {
  return `${TEMP_MEDIA_FOLDER}/${tempMediaId}.webp`;
}

/** Validasi id temp media — cegah path traversal & karakter berbahaya. */
export function isValidTempMediaId(
  tempMediaId: unknown,
): tempMediaId is string {
  return (
    typeof tempMediaId === "string" &&
    TEMP_MEDIA_ID_REGEX.test(tempMediaId) &&
    !tempMediaId.includes("..") &&
    !tempMediaId.includes("/")
  );
}

/**
 * URL view server untuk media temp.
 * Aman dipakai di klien maupun server (fungsi murni, tanpa dependensi server).
 */
export function buildTempMediaViewUrl(tempMediaId: string): string {
  return `/api/media/view?key=${encodeURIComponent(
    buildTempMediaKey(tempMediaId),
  )}`;
}
