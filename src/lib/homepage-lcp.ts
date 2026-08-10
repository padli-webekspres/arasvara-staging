import { BRAND_LOGO } from "@/lib/brand-logos";
import type { Configuration } from "@/types/configuration";

/** Path statis logo monogram hero — WebP kecil; jadi LCP bila poster hero tidak ada. */
export const HERO_MONOGRAM_SRC = BRAND_LOGO.mainLightW400;

/** Key konfigurasi file untuk poster hero full-viewport (target LCP). */
export const HERO_POSTER_CONFIG_KEY = "hero_video_poster_bg";

/**
 * Ambil URL file dari array konfigurasi server (tipe file).
 */
export function getHeroPosterUrlFromConfigs(
  configs: Configuration[],
): string | undefined {
  const config = configs.find(
    (c) => c.key === HERO_POSTER_CONFIG_KEY && c.type === "file",
  );
  const value = config?.value as { url?: string } | undefined;
  return value?.url || undefined;
}
