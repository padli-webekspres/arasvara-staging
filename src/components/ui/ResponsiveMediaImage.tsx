"use client";

import { useState, type ImgHTMLAttributes, type SyntheticEvent } from "react";
import {
  buildSrcSet,
  resolvePublicMediaUrl,
} from "@/lib/media/public-media-url";

type ResponsiveMediaImageProps = Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  "src" | "srcSet"
> & {
  src: string;
  sizes?: string;
  priority?: boolean;
};

/**
 * Uses immutable CDN width variants while retaining a safe fallback for
 * legacy objects that have not been backfilled yet.
 */
export function ResponsiveMediaImage({
  src,
  sizes,
  priority = false,
  loading,
  decoding,
  onError,
  ...props
}: ResponsiveMediaImageProps) {
  const resolvedSrc = resolvePublicMediaUrl(src) || src;
  const hasWebp = /\.webp(?:$|[?#])/i.test(resolvedSrc);
  const [failedVariantSrc, setFailedVariantSrc] = useState<string | null>(null);
  const useOriginal = failedVariantSrc === resolvedSrc;
  const shouldUseVariant = hasWebp && !useOriginal;

  const handleError = (event: SyntheticEvent<HTMLImageElement>) => {
    // Varian CDN belum ada (404) → buang srcSet dan coba ulang dengan file original.
    // Jangan panggil onError parent di sini; parent biasanya menampilkan logo placeholder.
    if (hasWebp && !useOriginal) {
      setFailedVariantSrc(resolvedSrc);
      return;
    }
    onError?.(event);
  };

  // `src` selalu original agar SSR/pre-hydration tidak 404 sebelum backfill;
  // browser memilih varian dari srcSet jika ada, onError membuang srcSet jika gagal.
  return (
    <img
      {...props}
      key={shouldUseVariant ? "variant" : "original"}
      alt={props.alt ?? ""}
      src={resolvedSrc}
      srcSet={shouldUseVariant ? buildSrcSet(resolvedSrc) : undefined}
      sizes={sizes}
      loading={loading ?? (priority ? "eager" : "lazy")}
      decoding={decoding ?? "async"}
      fetchPriority={priority ? "high" : undefined}
      onError={handleError}
    />
  );
}
