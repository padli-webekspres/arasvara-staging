import { compressImageFile } from "@/lib/image/compressImage";
import { isValidWebpBuffer, checkWebpSupport, detectImageFormat } from "@/lib/image/detectImageFormat";

const WEBP_MIME = "image/webp";
const JPEG_MIME = "image/jpeg";

function buildWebpFilename(sourceName?: string): string {
  const base = (sourceName ?? "image").replace(/\.[^.]+$/, "");
  return `${base}.webp`;
}

function buildJpegFilename(sourceName?: string): string {
  const base = (sourceName ?? "image").replace(/\.[^.]+$/, "");
  return `${base}.jpg`;
}

/**
 * Pastikan blob/File yang akan di-upload adalah format valid (WebP atau JPEG fallback).
 * Jika format target tidak sesuai, re-encode via compressImageFile (Pica).
 */
export async function ensureWebpFile(input: Blob | File): Promise<File> {
  const buffer = await input.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const format = detectImageFormat(bytes);

  // Jika formatnya WebP dan valid, langsung gunakan
  if (format === "webp" && isValidWebpBuffer(bytes)) {
    const name =
      input instanceof File ? input.name : buildWebpFilename("image");
    return new File([bytes], buildWebpFilename(name), { type: WEBP_MIME });
  }

  // Jika browser tidak mendukung WebP, dan input sudah JPEG valid yang berukuran cukup kecil (<= 800 KB),
  // langsung gunakan JPEG tersebut tanpa re-compress untuk menghemat waktu CPU.
  const supportWebp = checkWebpSupport();
  if (!supportWebp && format === "jpeg" && input.size <= 800 * 1024) {
    const name =
      input instanceof File ? input.name : buildJpegFilename("image");
    return new File([bytes], buildJpegFilename(name), { type: JPEG_MIME });
  }

  const sourceName = input instanceof File ? input.name : "image";
  const asFile =
    input instanceof File
      ? input
      : new File([input], sourceName, {
          type: input.type || "application/octet-stream",
        });

  return compressImageFile(asFile);
}
