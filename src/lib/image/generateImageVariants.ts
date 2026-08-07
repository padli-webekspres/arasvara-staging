import {
  compressImageWithSharp,
  type CompressedImageResult,
} from "@/lib/image/compressImageWithSharp";
import {
  RESPONSIVE_IMAGE_WIDTHS,
  type ResponsiveImageWidth,
} from "@/lib/media/cropPresets";

export { RESPONSIVE_IMAGE_WIDTHS, type ResponsiveImageWidth };

export interface GeneratedImageVariants {
  original: CompressedImageResult;
  w640: CompressedImageResult;
  w1280: CompressedImageResult;
}

/**
 * Generate the two sizes used by cards while preserving the original upload.
 * Re-encoding the source for each width keeps the CDN files independently cacheable.
 */
export async function generateImageVariants(
  inputBuffer: Buffer,
  options?: { maxSizeMB?: number },
): Promise<GeneratedImageVariants> {
  const [original, w640, w1280] = await Promise.all([
    compressImageWithSharp(inputBuffer, 1920, 1080, options?.maxSizeMB),
    compressImageWithSharp(
      inputBuffer,
      RESPONSIVE_IMAGE_WIDTHS[0],
      RESPONSIVE_IMAGE_WIDTHS[0],
      options?.maxSizeMB,
    ),
    compressImageWithSharp(
      inputBuffer,
      RESPONSIVE_IMAGE_WIDTHS[1],
      RESPONSIVE_IMAGE_WIDTHS[1],
      options?.maxSizeMB,
    ),
  ]);

  return { original, w640, w1280 };
}

export function getVariantKey(
  baseKey: string,
  width: ResponsiveImageWidth,
): string {
  return baseKey.replace(/\.webp$/i, `-w${width}.webp`);
}
