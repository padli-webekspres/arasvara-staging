import pica from "pica";
import {
  binarySearchQuality,
  computeFitInsideDimensions,
  resolveCompressImageOptions,
  scaleDownDimensions,
  type CompressImageOptions,
} from "@/lib/image/compressImageShared";
import { checkWebpSupport } from "@/lib/image/detectImageFormat";

function getOutputMimeType(): string {
  return checkWebpSupport() ? "image/webp" : "image/jpeg";
}

function getOutputExtension(): string {
  return checkWebpSupport() ? ".webp" : ".jpg";
}

function canvasToWebpBlob(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), getOutputMimeType(), quality / 100);
  });
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to load image"));
    };
    img.src = objectUrl;
  });
}

async function resizeToCanvas(
  img: HTMLImageElement,
  width: number,
  height: number,
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const picaInstance = pica();
  await picaInstance.resize(img, canvas);
  return canvas;
}

/**
 * Kompres gambar di browser (Pica + WebP) dengan target ukuran maksimum (default 500 KB).
 */
export async function compressImageFile(
  file: File,
  maxWidth?: number,
  maxHeight?: number,
  maxSizeMB?: number,
): Promise<File> {
  const options = resolveCompressImageOptions({
    maxWidth,
    maxHeight,
    maxSizeMB,
  });

  const img = await loadImageFromFile(file);
  const baseName = file.name.replace(/\.[^.]+$/, "") + getOutputExtension();

  let { width: targetWidth, height: targetHeight } = computeFitInsideDimensions(
    img.width,
    img.height,
    options.maxWidth,
    options.maxHeight,
  );

  let bestBlob: Blob | null = null;
  let atMinDimensions = false;

  while (!bestBlob) {
    const canvas = await resizeToCanvas(img, targetWidth, targetHeight);

    const preferred = await binarySearchQuality({
      minQuality: options.minQuality,
      maxQuality: options.maxQuality,
      maxSizeBytes: options.maxSizeBytes,
      encode: async (quality) => {
        const blob = await canvasToWebpBlob(canvas, quality);
        if (!blob) return null;
        return { data: blob, size: blob.size };
      },
    });

    if (preferred) {
      bestBlob = preferred.data;
      break;
    }

    if (atMinDimensions) {
      const fallback = await binarySearchQuality({
        minQuality: options.fallbackMinQuality,
        maxQuality: options.minQuality - 1,
        maxSizeBytes: options.maxSizeBytes,
        encode: async (quality) => {
          const blob = await canvasToWebpBlob(canvas, quality);
          if (!blob) return null;
          return { data: blob, size: blob.size };
        },
      });

      if (fallback) {
        bestBlob = fallback.data;
        break;
      }

      const lastBlob = await canvasToWebpBlob(canvas, options.fallbackMinQuality);
      if (!lastBlob) {
        throw new Error("Failed to compress image");
      }
      bestBlob = lastBlob;
      break;
    }

    const scaled = scaleDownDimensions(
      targetWidth,
      targetHeight,
      options.dimensionScaleStep,
      options.minLongEdge,
    );
    targetWidth = scaled.width;
    targetHeight = scaled.height;
    atMinDimensions = scaled.reachedMin;
  }

  return new File([bestBlob], baseName, { type: getOutputMimeType() });
}

export type { CompressImageOptions };
