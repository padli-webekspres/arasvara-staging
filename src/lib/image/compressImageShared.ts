/**
 * Konstanta & utilitas bersama untuk kompresi gambar (client Sharp / server Pica).
 */

export const COMPRESS_IMAGE_DEFAULTS = {
  /** Batas ukuran file output (MB). */
  maxSizeMB: 0.6,
  maxWidth: 1920,
  maxHeight: 1080,
  /** Long edge minimum sebelum quality diturunkan di bawah minQuality. */
  minLongEdge: 1440,
  /** Rentang binary search — prioritaskan kualitas tinggi tanpa blur. */
  minQuality: 78,
  maxQuality: 92,
  /** Quality terendah jika sudah di dimensi minimum. */
  fallbackMinQuality: 55,
  /** Faktor perkecil dimensi per iterasi (10%). */
  dimensionScaleStep: 0.9,
} as const;

export interface CompressImageOptions {
  maxWidth?: number;
  maxHeight?: number;
  maxSizeMB?: number;
  minLongEdge?: number;
  minQuality?: number;
  maxQuality?: number;
  fallbackMinQuality?: number;
  dimensionScaleStep?: number;
}

export interface ResolvedCompressImageOptions {
  maxWidth: number;
  maxHeight: number;
  maxSizeBytes: number;
  minLongEdge: number;
  minQuality: number;
  maxQuality: number;
  fallbackMinQuality: number;
  dimensionScaleStep: number;
}

export function resolveCompressImageOptions(
  options: CompressImageOptions = {},
): ResolvedCompressImageOptions {
  const maxSizeMB = options.maxSizeMB ?? COMPRESS_IMAGE_DEFAULTS.maxSizeMB;
  return {
    maxWidth: options.maxWidth ?? COMPRESS_IMAGE_DEFAULTS.maxWidth,
    maxHeight: options.maxHeight ?? COMPRESS_IMAGE_DEFAULTS.maxHeight,
    maxSizeBytes: maxSizeMB * 1024 * 1024,
    minLongEdge: options.minLongEdge ?? COMPRESS_IMAGE_DEFAULTS.minLongEdge,
    minQuality: options.minQuality ?? COMPRESS_IMAGE_DEFAULTS.minQuality,
    maxQuality: options.maxQuality ?? COMPRESS_IMAGE_DEFAULTS.maxQuality,
    fallbackMinQuality:
      options.fallbackMinQuality ?? COMPRESS_IMAGE_DEFAULTS.fallbackMinQuality,
    dimensionScaleStep:
      options.dimensionScaleStep ?? COMPRESS_IMAGE_DEFAULTS.dimensionScaleStep,
  };
}

/** Hitung dimensi target `fit: inside` tanpa memperbesar. */
export function computeFitInsideDimensions(
  width: number,
  height: number,
  maxWidth: number,
  maxHeight: number,
): { width: number; height: number } {
  if (width <= maxWidth && height <= maxHeight) {
    return { width, height };
  }

  const scale = Math.min(maxWidth / width, maxHeight / height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export function getLongEdge(width: number, height: number): number {
  return Math.max(width, height);
}

/**
 * Perkecil dimensi dengan faktor step, tetapi tidak di bawah minLongEdge (long edge).
 */
export function scaleDownDimensions(
  width: number,
  height: number,
  step: number,
  minLongEdge: number,
): { width: number; height: number; reachedMin: boolean } {
  const longEdge = getLongEdge(width, height);
  if (longEdge <= minLongEdge) {
    return { width, height, reachedMin: true };
  }

  const nextLong = Math.max(minLongEdge, Math.round(longEdge * step));
  const ratio = nextLong / longEdge;

  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
    reachedMin: nextLong <= minLongEdge,
  };
}

/**
 * Binary search: cari quality tertinggi yang menghasilkan ukuran ≤ maxSizeBytes.
 */
export async function binarySearchQuality<T>(params: {
  minQuality: number;
  maxQuality: number;
  maxSizeBytes: number;
  encode: (quality: number) => Promise<{ data: T; size: number } | null>;
}): Promise<{ data: T; quality: number; size: number } | null> {
  const { minQuality, maxQuality, maxSizeBytes, encode } = params;
  let lo = minQuality;
  let hi = maxQuality;
  let best: { data: T; quality: number; size: number } | null = null;

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const result = await encode(mid);
    if (!result) {
      hi = mid - 1;
      continue;
    }

    if (result.size <= maxSizeBytes) {
      best = { data: result.data, quality: mid, size: result.size };
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  return best;
}
