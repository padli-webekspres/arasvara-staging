import { ResponsiveMediaImage } from "@/components/ui/ResponsiveMediaImage";
import { cn } from "@/lib/utils";
import {
  AdsCardSpan,
  AdsCardVariant,
  ADS_CARD_DEFAULT_BANNER,
  AdsPosition,
  type AdsCardProps,
} from "@/types/ads";
import {
  adsPositionToSocmedLayout,
  getVideoAdAspectClass,
} from "@/lib/socmed-video-layout";

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

function aspectDims(
  variant: AdsCardVariant,
  span: 1 | 2,
  position?: AdsPosition,
): { width: number; height: number } {
  if (variant === AdsCardVariant.FEATURED) {
    return { width: 16, height: 9 };
  }
  if (variant === AdsCardVariant.NEWS) {
    return span === 2 ? { width: 2, height: 1 } : { width: 1, height: 1 };
  }
  if (variant === AdsCardVariant.VIDEO && position) {
    const layout = adsPositionToSocmedLayout(position);
    if (layout === "portrait") {
      return span === 2 ? { width: 9, height: 8 } : { width: 9, height: 16 };
    }
    return span === 2 ? { width: 32, height: 9 } : { width: 16, height: 9 };
  }
  return span === 2 ? { width: 8, height: 5 } : { width: 4, height: 5 };
}

function variantShellClass(
  variant: AdsCardVariant,
  clickable: boolean,
): string {
  if (variant === AdsCardVariant.FEATURED) {
    return cn(
      "h-full w-full min-h-0 rounded-2xl shadow-lg",
      "flex justify-center items-center",
    );
  }
  if (variant === AdsCardVariant.VIDEO) {
    return cn(
      "group flex justify-center items-center",
      clickable && "cursor-pointer",
    );
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
  clickable = false,
}: AdsCardProps) {
  const safeSpan = normalizeSpan(span);

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden",
        roundedOuterClass(variant),
        variantShellClass(variant, clickable),
        aspectClass(variant, safeSpan, position),
        className,
      )}
    >
      <div className="absolute top-4 -right-8 w-36 transform rotate-45 bg-black/60 backdrop-blur-sm text-white text-center py-1 text-[10px] font-bold uppercase tracking-wider z-20 shadow-sm pointer-events-none">
        Iklan
      </div>

      <ResponsiveMediaImage
        src={bannerUrl}
        alt={alt === "Iklan" ? "" : alt}
        {...aspectDims(variant, safeSpan, position)}
        sizes={
          variant === AdsCardVariant.FEATURED
            ? "(max-width: 768px) 90vw, (max-width: 1024px) 75vw, 60vw"
            : variant === AdsCardVariant.VIDEO
              ? "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 28vw"
              : "(max-width: 768px) 70vw, 320px"
        }
        className={cn("absolute inset-0 h-full w-full object-cover", imageRoundedClass(variant))}
      />
    </div>
  );
}
