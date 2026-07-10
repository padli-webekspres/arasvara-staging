import type { HomepageAdItem } from "@/types/ads";
import { AdsPosition } from "@/types/ads";
import {
  getAdminLandscapeVideoCardGridClass,
  getAdminPortraitCardGridClass,
} from "./admin-card-grid";

export type SocmedPlatform = "tiktok" | "instagram" | "youtube";
export type SocmedVideoLayout = "portrait" | "landscape";

const PORTRAIT_PLATFORMS: SocmedPlatform[] = ["instagram", "tiktok"];

export function getSocmedLayout(platform: SocmedPlatform): SocmedVideoLayout {
  return PORTRAIT_PLATFORMS.includes(platform) ? "portrait" : "landscape";
}

export function getSocmedCropAspect(layout: SocmedVideoLayout): number {
  return layout === "portrait" ? 9 / 16 : 16 / 9;
}

export function getSocmedAspectLabel(layout: SocmedVideoLayout): string {
  return layout === "portrait" ? "9:16" : "16:9";
}

/** Class thumbnail / slide video (span 1). */
export function getSocmedVideoAspectClass(
  layout: SocmedVideoLayout,
  span: 1 | 2 = 1,
): string {
  if (layout === "portrait") {
    return span === 2 ? "aspect-[9/8]" : "aspect-[9/16]";
  }
  return span === 2 ? "aspect-[32/9]" : "aspect-video";
}

export function getCropOutputSize(layout: SocmedVideoLayout): {
  width: number;
  height: number;
} {
  return layout === "portrait"
    ? { width: 720, height: 1280 }
    : { width: 1280, height: 720 };
}

/** Alias untuk upload Sharp (sama dengan output crop). */
export const getSharpThumbnailSize = getCropOutputSize;

export function getAdminCardGridClass(layout: SocmedVideoLayout): string {
  return layout === "portrait"
    ? getAdminPortraitCardGridClass()
    : getAdminLandscapeVideoCardGridClass();
}

export function getAdminCardMaxWidthClass(layout: SocmedVideoLayout): string {
  return layout === "landscape" ? "max-w-xl mx-auto w-full" : "w-full";
}

function maxAdSpan(ads: HomepageAdItem[]): 0 | 1 | 2 {
  if (ads.length === 0) return 0;
  return ads.reduce<1 | 2>(
    (max, ad) => ((ad.span === 2 ? 2 : 1) > max ? (ad.span === 2 ? 2 : 1) : max),
    1,
  );
}

/** Jumlah video yang ditampilkan di carousel (layar besar). */
export function getSocmedMaxVisibleVideos(
  layout: SocmedVideoLayout,
  ads: HomepageAdItem[],
): number {
  const span = maxAdSpan(ads);
  if (layout === "portrait") {
    if (span === 0) return 5;
    if (span === 2) return 3;
    return 4;
  }
  return span === 0 ? 4 : 3;
}

/** Lebar slide Swiper di breakpoint lg (Tailwind arbitrary width). */
export function getSocmedSlideWidthClasses(
  layout: SocmedVideoLayout,
  span: 1 | 2,
): string {
  if (span === 2) {
    return layout === "portrait"
      ? "!w-[85%] sm:!w-[50%] lg:!w-[36%]"
      : "!w-[85%] sm:!w-[55%] lg:!w-[48%]";
  }
  return layout === "portrait"
    ? "!w-[60%] sm:!w-[32%] lg:!w-[18%]"
    : "!w-[75%] sm:!w-[45%] lg:!w-[24%]";
}

export function adsPositionToSocmedLayout(position: AdsPosition): SocmedVideoLayout {
  if (position === AdsPosition.YOUTUBE) return "landscape";
  if (
    position === AdsPosition.TIKTOK ||
    position === AdsPosition.REELS
  ) {
    return "portrait";
  }
  return "portrait";
}

export function getVideoAdAspectClass(
  position: AdsPosition,
  span: 1 | 2,
): string {
  return getSocmedVideoAspectClass(adsPositionToSocmedLayout(position), span);
}
