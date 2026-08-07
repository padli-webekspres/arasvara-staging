"use client";

import { useState, type ImgHTMLAttributes, type SyntheticEvent } from "react";
import {
  buildSrcSet,
  resolveMediaVariantUrl,
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
    if (hasWebp && !useOriginal) {
      setFailedVariantSrc(resolvedSrc);
    }
    onError?.(event);
  };

  return (
    <img
      {...props}
      alt={props.alt ?? ""}
      src={
        shouldUseVariant
          ? resolveMediaVariantUrl(resolvedSrc, 640)
          : resolvedSrc
      }
      srcSet={shouldUseVariant ? buildSrcSet(resolvedSrc) : undefined}
      sizes={sizes}
      loading={loading ?? (priority ? "eager" : "lazy")}
      decoding={decoding ?? "async"}
      fetchPriority={priority ? "high" : undefined}
      onError={handleError}
    />
  );
}
