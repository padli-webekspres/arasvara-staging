/**
 * Siapkan file gambar menjadi blob URL yang lebih andal untuk crop preview di mobile.
 *
 * Masalah yang ditangani:
 * - Foto kamera besar (multi-MB) sering gagal decode intermittent di iOS/iPad
 * - Format seperti HEIC kadang gagal di <img> blob URL meski File picker menerimanya
 * - EXIF orientation (foto portrait iPhone) diabaikan createImageBitmap tanpa opsi
 * - PNG/WebP transparan tidak boleh di-JPEG-kan (alpha hilang → hitam)
 *
 * Strategi: createImageBitmap + from-image → downscale.
 * JPEG/HEIC → JPEG. PNG/WebP → PNG (atau WebP jika canvas mendukung).
 * Fallback: Image() + canvas ≤ maxEdge — tidak pernah mengembalikan file asli.
 */

import {
  checkWebpSupport,
  detectImageFormat,
} from "@/lib/image/detectImageFormat";

const DEFAULT_MAX_EDGE = 2560;
const PROBE_TIMEOUT_MS = 10_000;

type RasterMime = "image/jpeg" | "image/png" | "image/webp";

function loadImageElement(
  url: string,
  timeoutMs = PROBE_TIMEOUT_MS,
): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const timeoutId = globalThis.setTimeout(() => {
      img.onload = null;
      img.onerror = null;
      reject(new Error("Image load timeout"));
    }, timeoutMs);

    img.onload = () => {
      globalThis.clearTimeout(timeoutId);
      resolve(img);
    };
    img.onerror = () => {
      globalThis.clearTimeout(timeoutId);
      reject(new Error("Failed to load image"));
    };
    img.src = url;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mime: RasterMime,
  quality = 0.92,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("canvas.toBlob failed"));
      },
      mime,
      mime === "image/png" ? undefined : quality,
    );
  });
}

function scaledSize(
  sourceWidth: number,
  sourceHeight: number,
  maxEdge: number,
): { width: number; height: number } {
  const longest = Math.max(sourceWidth, sourceHeight);
  const scale = longest > maxEdge ? maxEdge / longest : 1;
  return {
    width: Math.max(1, Math.round(sourceWidth * scale)),
    height: Math.max(1, Math.round(sourceHeight * scale)),
  };
}

function mimeFromTypeOrName(file: File): RasterMime | null {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  if (type === "image/png" || name.endsWith(".png")) return "image/png";
  if (type === "image/webp" || name.endsWith(".webp")) return "image/webp";
  if (
    type === "image/jpeg" ||
    type === "image/jpg" ||
    type === "image/heic" ||
    type === "image/heif" ||
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg") ||
    name.endsWith(".heic") ||
    name.endsWith(".heif")
  ) {
    return "image/jpeg";
  }
  return null;
}

async function rasterMimeForFile(file: File): Promise<RasterMime> {
  const fromMeta = mimeFromTypeOrName(file);
  let mime: RasterMime = "image/jpeg";
  if (fromMeta) {
    mime = fromMeta;
  } else {
    const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    const detected = detectImageFormat(head);
    if (detected === "png") mime = "image/png";
    else if (detected === "webp") mime = "image/webp";
  }
  if (mime === "image/webp" && !checkWebpSupport()) return "image/png";
  return mime;
}

async function rasterToObjectUrl(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  maxEdge: number,
  mime: RasterMime,
): Promise<string> {
  const { width, height } = scaledSize(sourceWidth, sourceHeight, maxEdge);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("2d context unavailable");
  }
  ctx.drawImage(source, 0, 0, width, height);
  const blob = await canvasToBlob(canvas, mime);
  return URL.createObjectURL(blob);
}

async function decodeBitmap(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return await createImageBitmap(file);
  }
}

/**
 * Decode & normalisasi file menjadi blob URL yang aman untuk CropImageModal.
 * JPEG/HEIC → JPEG. PNG/WebP → PNG/WebP (alpha dipertahankan).
 * Caller wajib `URL.revokeObjectURL` saat selesai.
 */
export async function prepareImageForCrop(
  file: File,
  options?: { maxEdge?: number },
): Promise<string> {
  const maxEdge = options?.maxEdge ?? DEFAULT_MAX_EDGE;
  const mime = await rasterMimeForFile(file);

  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await decodeBitmap(file);
      try {
        return await rasterToObjectUrl(
          bitmap,
          bitmap.width,
          bitmap.height,
          maxEdge,
          mime,
        );
      } finally {
        bitmap.close();
      }
    } catch {
      // Lanjut ke fallback <img> + canvas
    }
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImageElement(objectUrl);
    return await rasterToObjectUrl(
      img,
      img.naturalWidth,
      img.naturalHeight,
      maxEdge,
      mime,
    );
  } catch (error) {
    throw error instanceof Error
      ? error
      : new Error("Gambar tidak dapat dimuat");
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
