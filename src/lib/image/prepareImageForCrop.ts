/**
 * Siapkan file gambar menjadi blob URL yang lebih andal untuk crop preview di mobile.
 *
 * Masalah yang ditangani:
 * - Foto kamera besar (multi-MB) sering gagal decode intermittent di iOS/iPad
 * - Format seperti HEIC kadang gagal di <img> blob URL meski File picker menerimanya
 *
 * Strategi: decode via createImageBitmap → (opsional) downscale → canvas JPEG blob URL.
 * Fallback: probe Image() terhadap object URL asli.
 */

const DEFAULT_MAX_EDGE = 2560;
const PROBE_TIMEOUT_MS = 10_000;

function probeImageUrl(url: string, timeoutMs = PROBE_TIMEOUT_MS): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const timeoutId = window.setTimeout(() => {
      img.onload = null;
      img.onerror = null;
      reject(new Error("Image load timeout"));
    }, timeoutMs);

    img.onload = () => {
      window.clearTimeout(timeoutId);
      resolve();
    };
    img.onerror = () => {
      window.clearTimeout(timeoutId);
      reject(new Error("Failed to load image"));
    };
    img.src = url;
  });
}

function canvasToJpegBlob(
  canvas: HTMLCanvasElement,
  quality = 0.92,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("canvas.toBlob failed"));
      },
      "image/jpeg",
      quality,
    );
  });
}

/**
 * Decode & normalisasi file menjadi blob URL JPEG yang aman untuk CropImageModal.
 * Caller wajib `URL.revokeObjectURL` saat selesai.
 */
export async function prepareImageForCrop(
  file: File,
  options?: { maxEdge?: number },
): Promise<string> {
  const maxEdge = options?.maxEdge ?? DEFAULT_MAX_EDGE;

  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      try {
        const longest = Math.max(bitmap.width, bitmap.height);
        const scale = longest > maxEdge ? maxEdge / longest : 1;
        const width = Math.max(1, Math.round(bitmap.width * scale));
        const height = Math.max(1, Math.round(bitmap.height * scale));

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          throw new Error("2d context unavailable");
        }
        ctx.drawImage(bitmap, 0, 0, width, height);
        const blob = await canvasToJpegBlob(canvas);
        return URL.createObjectURL(blob);
      } finally {
        bitmap.close();
      }
    } catch {
      // Lanjut ke fallback di bawah
    }
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    await probeImageUrl(objectUrl);
    return objectUrl;
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error instanceof Error
      ? error
      : new Error("Gambar tidak dapat dimuat");
  }
}
