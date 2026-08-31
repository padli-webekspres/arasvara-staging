/** Timeout axios untuk upload / proses gambar (bukan default API 10s). */
export const IMAGE_UPLOAD_TIMEOUT_MS = 60_000;

/** `POST /media/process-temp` — Sharp + upload, lebih lama dari PUT metadata. */
export const IMAGE_PROCESS_TEMP_TIMEOUT_MS = 120_000;
