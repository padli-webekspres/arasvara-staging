export interface CropOutputSize {
  width: number;
  height: number;
}

/**
 * Ukuran output crop: sisi terpanjang = maxLongEdge, rasio dipertahankan.
 */
export function cropOutputFromAspect(
  aspect: number,
  maxLongEdge = 1920,
): CropOutputSize {
  const safeAspect = aspect > 0 ? aspect : 1;
  const edge = Math.max(1, maxLongEdge);
  if (safeAspect >= 1) {
    return {
      width: edge,
      height: Math.max(1, Math.round(edge / safeAspect)),
    };
  }
  return {
    width: Math.max(1, Math.round(edge * safeAspect)),
    height: edge,
  };
}
