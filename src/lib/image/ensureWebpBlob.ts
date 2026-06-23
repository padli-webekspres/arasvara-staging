import { compressImageFile } from "@/lib/image/compressImage";
import { isValidWebpBuffer } from "@/lib/image/detectImageFormat";

const WEBP_MIME = "image/webp";

function buildWebpFilename(sourceName?: string): string {
  const base = (sourceName ?? "image").replace(/\.[^.]+$/, "");
  return `${base}.webp`;
}

/**
 * Pastikan blob/File yang akan di-upload adalah WebP valid.
 * Jika magic bytes tidak cocok, re-encode via compressImageFile (Pica).
 */
export async function ensureWebpFile(input: Blob | File): Promise<File> {
  const buffer = await input.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  if (input.type === WEBP_MIME && isValidWebpBuffer(bytes)) {
    const name =
      input instanceof File ? input.name : buildWebpFilename("image");
    return new File([bytes], buildWebpFilename(name), { type: WEBP_MIME });
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
