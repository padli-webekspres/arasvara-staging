/**
 * Kompresi gambar server-side dengan Sharp → WebP.
 * Strategi: pertahankan resolusi, binary search quality; turunkan dimensi hanya jika perlu.
 */

import sharp from "sharp";
import {
  binarySearchQuality,
  computeFitInsideDimensions,
  resolveCompressImageOptions,
  scaleDownDimensions,
  type CompressImageOptions,
} from "@/lib/image/compressImageShared";

export interface CompressedImageResult {
  buffer: Buffer;
  format: "webp";
  mimeType: "image/webp";
  width: number;
  height: number;
  fileSize: number;
}

async function encodeWebpAtDimensions(
  inputBuffer: Buffer,
  width: number,
  height: number,
  quality: number,
): Promise<Buffer> {
  const resized = await sharp(inputBuffer)
    .rotate()
    .resize(width, height, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .toBuffer();

  return sharp(resized).webp({ quality, effort: 4 }).toBuffer();
}

/**
 * Kompres gambar ke WebP dengan target ukuran maksimum (default 500 KB).
 */
export async function compressImageWithSharp(
  inputBuffer: Buffer,
  maxWidth?: number,
  maxHeight?: number,
  maxSizeMB?: number,
): Promise<CompressedImageResult> {
  const options = resolveCompressImageOptions({
    maxWidth,
    maxHeight,
    maxSizeMB,
  });

  try {
    const metadata = await sharp(inputBuffer).metadata();

    if (!metadata.width || !metadata.height) {
      throw new Error("Could not determine original image dimensions");
    }

    let { width: targetWidth, height: targetHeight } = computeFitInsideDimensions(
      metadata.width,
      metadata.height,
      options.maxWidth,
      options.maxHeight,
    );

    let bestBuffer: Buffer | null = null;
    let atMinDimensions = false;

    while (!bestBuffer) {
      const preferred = await binarySearchQuality({
        minQuality: options.minQuality,
        maxQuality: options.maxQuality,
        maxSizeBytes: options.maxSizeBytes,
        encode: async (quality) => {
          const buffer = await encodeWebpAtDimensions(
            inputBuffer,
            targetWidth,
            targetHeight,
            quality,
          );
          return { data: buffer, size: buffer.length };
        },
      });

      if (preferred) {
        bestBuffer = preferred.data;
        break;
      }

      if (atMinDimensions) {
        const fallback = await binarySearchQuality({
          minQuality: options.fallbackMinQuality,
          maxQuality: options.minQuality - 1,
          maxSizeBytes: options.maxSizeBytes,
          encode: async (quality) => {
            const buffer = await encodeWebpAtDimensions(
              inputBuffer,
              targetWidth,
              targetHeight,
              quality,
            );
            return { data: buffer, size: buffer.length };
          },
        });

        if (fallback) {
          bestBuffer = fallback.data;
          break;
        }

        // Terakhir: quality minimum pada dimensi terkecil
        bestBuffer = await encodeWebpAtDimensions(
          inputBuffer,
          targetWidth,
          targetHeight,
          options.fallbackMinQuality,
        );
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

    const compressedMetadata = await sharp(bestBuffer).metadata();

    if (!compressedMetadata.width || !compressedMetadata.height) {
      throw new Error("Could not determine compressed image dimensions");
    }

    return {
      buffer: bestBuffer,
      format: "webp",
      mimeType: "image/webp",
      width: compressedMetadata.width,
      height: compressedMetadata.height,
      fileSize: bestBuffer.length,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Image compression failed: ${error.message}`);
    }
    throw new Error("Image compression failed for unknown reason");
  }
}

export type { CompressImageOptions };
