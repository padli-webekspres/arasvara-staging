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

/**
 * Render area crop ke canvas dan ekspor sebagai WebP Blob.
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

        // Hybrid scaling & quality configuration list
        const attempts = [
          { scale: 1.0, quality: webpQuality || 0.85 },
          { scale: 1.0, quality: 0.8 },
          { scale: 0.85, quality: 0.8 },
          { scale: 0.85, quality: 0.75 },
          { scale: 0.7, quality: 0.75 },
          { scale: 0.6, quality: 0.7 },
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
            canvas.toBlob((b) => res(b), "image/webp", attempt.quality),
          );

          if (finalBlob && finalBlob.size <= maxSizeBytes) {
            break;
          }
        }

        if (finalBlob) {
          resolve(finalBlob);
        } else {
          reject(new Error("Failed to create blob"));
        }
      } catch (err) {
        reject(err);
      }
    };
    image.onerror = () => reject(new Error("Failed to load image"));
    image.src = imageSrc;
  });
}
