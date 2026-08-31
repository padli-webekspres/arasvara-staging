export type DetectedImageFormat = "webp" | "png" | "jpeg" | "unknown";

function readByte(buffer: Buffer | Uint8Array, index: number): number {
  return buffer[index] ?? 0;
}

/**
 * Deteksi format gambar dari magic bytes buffer.
 * Aman dipakai di browser (Uint8Array) dan server (Buffer).
 */
export function detectImageFormat(
  buffer: Buffer | Uint8Array,
): DetectedImageFormat {
  if (buffer.length < 12) return "unknown";

  // WebP: RIFF....WEBP
  if (
    readByte(buffer, 0) === 0x52 &&
    readByte(buffer, 1) === 0x49 &&
    readByte(buffer, 2) === 0x46 &&
    readByte(buffer, 3) === 0x46 &&
    readByte(buffer, 8) === 0x57 &&
    readByte(buffer, 9) === 0x45 &&
    readByte(buffer, 10) === 0x42 &&
    readByte(buffer, 11) === 0x50
  ) {
    return "webp";
  }

  // PNG: 89 50 4E 47
  if (
    readByte(buffer, 0) === 0x89 &&
    readByte(buffer, 1) === 0x50 &&
    readByte(buffer, 2) === 0x4e &&
    readByte(buffer, 3) === 0x47
  ) {
    return "png";
  }

  // JPEG: FF D8 FF
  if (
    readByte(buffer, 0) === 0xff &&
    readByte(buffer, 1) === 0xd8 &&
    readByte(buffer, 2) === 0xff
  ) {
    return "jpeg";
  }

  return "unknown";
}

/** True jika buffer adalah WebP valid (magic bytes RIFF/WEBP). */
export function isValidWebpBuffer(buffer: Buffer | Uint8Array): boolean {
  return detectImageFormat(buffer) === "webp";
}

/**
 * MIME `image/*` diterima. MIME kosong (Safari/IDB) lolos jika magic bytes jpeg/png/webp.
 */
export function assertDecodableImage(
  mimeType: string | undefined,
  buffer: Buffer | Uint8Array,
  message = "File harus berupa gambar",
): void {
  const hasImageMime =
    typeof mimeType === "string" && mimeType.startsWith("image/");
  if (hasImageMime) return;
  const detected = detectImageFormat(buffer);
  if (detected !== "jpeg" && detected !== "png" && detected !== "webp") {
    throw new Error(message);
  }
}

let isWebpSupported: boolean | null = null;

/**
 * Deteksi apakah browser mendukung ekspor canvas ke image/webp (CORS/Safari fallback).
 * Bernilai false pada browser Safari di iOS < 17.2.
 */
export function checkWebpSupport(): boolean {
  if (typeof window === "undefined") return false;
  if (isWebpSupported !== null) return isWebpSupported;

  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const dataUrl = canvas.toDataURL("image/webp");
    isWebpSupported = dataUrl.startsWith("data:image/webp");
  } catch {
    isWebpSupported = false;
  }
  return isWebpSupported;
}
