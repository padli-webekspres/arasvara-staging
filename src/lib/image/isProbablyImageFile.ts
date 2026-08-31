/** Safari/iOS sering mengirim File.type kosong; anggap gambar sampai terbukti sebaliknya. */
export function isProbablyImageFile(file: File): boolean {
  return !file.type || file.type.startsWith("image/");
}

/** Extensi HEIC/HEIF + image/* — File System Access API desktop sering menyembunyikan HEIC. */
export const IMAGE_DROPZONE_ACCEPT = {
  "image/*": [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"],
};

export const IMAGE_DROPZONE_COPY = {
  primary: "Ketuk untuk pilih gambar",
  secondary: "atau tarik ke sini",
  formats: "JPG, PNG, WebP, HEIC",
} as const;
