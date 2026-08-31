import { checkWebpSupport } from "@/lib/image/detectImageFormat";

export interface PixelCropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CropImageExportOptions {
  /** Rasio tampilan crop (lebar ÷ tinggi). */
  aspect?: number;
  /** Jika diisi keduanya, hasil diskalakan ke ukuran tetap (mis. featured 1280×800). */
  outputWidth?: number;
  outputHeight?: number;
  /** Kualitas WebP `canvas.toBlob` (0–1). */
  webpQuality?: number;
  /** Batas ukuran file dalam MB (default: 0.78). */
  maxSizeMB?: number;
}

export const CROP_OUTPUT_TOO_LARGE =
  "File hasil crop masih terlalu besar. Coba area crop lebih kecil atau gunakan gambar lain.";

/**
 * Konversi koordinat pixel yang diterima dari react-image-crop (relatif terhadap
 * ukuran tampilan <img> di DOM) menjadi koordinat pixel pada gambar asli (natural size).
 */
export function toNaturalPixelCrop(
  image: HTMLImageElement,
  crop: PixelCropArea,
): PixelCropArea {
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  return {
    x: Math.round(crop.x * scaleX),
    y: Math.round(crop.y * scaleY),
    width: Math.round(crop.width * scaleX),
    height: Math.round(crop.height * scaleY),
  };
}

async function sourceBlobMime(src: string): Promise<string> {
  try {
    const res = await fetch(src);
    const blob = await res.blob();
    return blob.type || "";
  } catch {
    return "";
  }
}

function cropExportMime(sourceMime: string, supportWebp: boolean): string {
  if (supportWebp) return "image/webp";
  const mime = sourceMime.toLowerCase();
  if (mime.includes("png") || mime.includes("webp")) return "image/png";
  return "image/jpeg";
}

/**
 * Render area crop ke canvas dan ekspor sebagai WebP/PNG/JPEG Blob.
 * `pixelCrop` harus sudah dalam koordinat natural (full-resolution) gambar.
 * Mencoba beberapa kombinasi skala/kualitas hingga file berada di bawah `maxSizeMB`.
 */
export async function getCroppedImg(
  imageSrc: string,
  pixelCrop: PixelCropArea,
  {
    aspect = 4 / 5,
    outputWidth,
    outputHeight,
    webpQuality = 0.9,
    maxSizeMB = 0.78,
  }: CropImageExportOptions = {},
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    if (/^https?:\/\//i.test(imageSrc)) {
      image.crossOrigin = "anonymous";
    }
    image.onload = async () => {
      try {
        const hasFixedOutput =
          outputWidth != null &&
          outputHeight != null &&
          outputWidth > 0 &&
          outputHeight > 0;

        let baseWidth = 0;
        let baseHeight = 0;

        if (hasFixedOutput) {
          baseWidth = outputWidth;
          baseHeight = outputHeight;
        } else {
          /* Legacy: ukuran mengikuti crop + aspect */
          let canvasWidth = pixelCrop.width;
          let canvasHeight = pixelCrop.height;
          if (canvasWidth / canvasHeight > aspect) {
            canvasWidth = canvasHeight * aspect;
          } else {
            canvasHeight = canvasWidth / aspect;
          }
          baseWidth = Math.round(canvasWidth);
          baseHeight = Math.round(canvasHeight);
        }

        const maxSizeBytes = maxSizeMB * 1024 * 1024;
        const supportWebp = checkWebpSupport();
        const sourceMime = await sourceBlobMime(imageSrc);
        const exportMime = cropExportMime(sourceMime, supportWebp);

        const attempts = [
          { scale: 1.0, quality: webpQuality || 0.85 },
          { scale: 1.0, quality: 0.8 },
          { scale: 0.85, quality: 0.8 },
          { scale: 0.85, quality: 0.75 },
          { scale: 0.7, quality: 0.75 },
          { scale: 0.6, quality: 0.7 },
          { scale: 0.5, quality: 0.6 },
          { scale: 0.4, quality: 0.5 },
        ];

        let finalBlob: Blob | null = null;

        for (const attempt of attempts) {
          const targetWidth = Math.round(baseWidth * attempt.scale);
          const targetHeight = Math.round(baseHeight * attempt.scale);

          const canvas = document.createElement("canvas");
          canvas.width = targetWidth;
          canvas.height = targetHeight;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            throw new Error("No canvas context");
          }

          ctx.drawImage(
            image,
            pixelCrop.x,
            pixelCrop.y,
            pixelCrop.width,
            pixelCrop.height,
            0,
            0,
            targetWidth,
            targetHeight,
          );

          finalBlob = await new Promise<Blob | null>((res) =>
            canvas.toBlob((b) => res(b), exportMime, attempt.quality),
          );

          if (finalBlob && finalBlob.size <= maxSizeBytes) {
            break;
          }
        }

        if (!finalBlob) {
          reject(new Error("Failed to create blob"));
        } else if (finalBlob.size > maxSizeBytes) {
          reject(new Error(CROP_OUTPUT_TOO_LARGE));
        } else {
          resolve(finalBlob);
        }
      } catch (err) {
        reject(err);
      }
    };
    image.onerror = () => reject(new Error("Failed to load image"));
    image.src = imageSrc;
  });
}
