import Image from "next/image";
import { cn, shouldUnoptimizeNewsCardImage } from "@/lib/utils";
import {
  AdsCardSpan,
  AdsCardVariant,
  ADS_CARD_DEFAULT_BANNER,
  AdsPosition,
  type AdsCardProps,
} from "@/types/ads";
import { getVideoAdAspectClass } from "@/lib/socmed-video-layout";

export { ADS_CARD_DEFAULT_BANNER, AdsCardVariant, AdsCardSpan };
export type { AdsCardProps } from "@/types/ads";

function normalizeSpan(span: AdsCardProps["span"]): 1 | 2 {
  if (span === AdsCardSpan.WIDE || span === 2) return 2;
  return 1;
}

function aspectClass(
  variant: AdsCardVariant,
  span: 1 | 2,
  position?: AdsPosition,
): string {
  if (variant === AdsCardVariant.FEATURED) {
    return "";
  }
  if (variant === AdsCardVariant.NEWS) {
    return span === 2 ? "aspect-2/1" : "aspect-square";
  }
  if (variant === AdsCardVariant.VIDEO && position) {
    return getVideoAdAspectClass(position, span);
  }
  return span === 2 ? "aspect-8/5" : "aspect-4/5";
}

function variantShellClass(variant: AdsCardVariant): string {
  if (variant === AdsCardVariant.FEATURED) {
    return cn(
      "h-full w-full min-h-0 rounded-2xl shadow-lg",
      "flex justify-center items-center",
    );
  }
  if (variant === AdsCardVariant.VIDEO) {
    return "group cursor-pointer flex justify-center items-center";
  }
  return "";
}

function roundedOuterClass(variant: AdsCardVariant): string {
  if (variant === AdsCardVariant.FEATURED) return "";
  return variant === AdsCardVariant.NEWS ? "rounded-lg" : "rounded-2xl";
}

function imageRoundedClass(variant: AdsCardVariant): string {
  if (
    variant === AdsCardVariant.FEATURED ||
    variant === AdsCardVariant.VIDEO
  ) {
    return "rounded-2xl";
  }
  return "";
}

/**
 * Kartu iklan banner untuk carousel — satu implementasi untuk semua preset rasio/sudut.
 */
export function AdsCard({
  variant = AdsCardVariant.NEWS,
  span = AdsCardSpan.SINGLE,
  position,
  bannerUrl = ADS_CARD_DEFAULT_BANNER,
  className,
  alt = "Iklan",
}: AdsCardProps) {
  const safeSpan = normalizeSpan(span);

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden",
        roundedOuterClass(variant),
        variantShellClass(variant),
        aspectClass(variant, safeSpan, position),
        className,
      )}
    >
      <div className="absolute top-4 -right-8 w-36 transform rotate-45 bg-black/60 backdrop-blur-sm text-white text-center py-1 text-[10px] font-bold uppercase tracking-wider z-20 shadow-sm pointer-events-none">
        Iklan
      </div>

      <Image
        src={bannerUrl}
        alt={alt}
        fill
        sizes={
          variant === AdsCardVariant.FEATURED
            ? "(max-width: 768px) 90vw, (max-width: 1024px) 75vw, 60vw"
            : variant === AdsCardVariant.VIDEO
              ? "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 28vw"
              : "(max-width: 768px) 70vw, 320px"
        }
        className={cn("object-cover", imageRoundedClass(variant))}
        unoptimized={shouldUnoptimizeNewsCardImage(bannerUrl)}
      />
    </div>
  );
}
