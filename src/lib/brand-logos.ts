/**
 * Path aset brand Arasvara.
 * PNG penuh untuk konteks yang butuh resolusi tinggi / cetak.
 * Varian *-w400 / *-w640.webp untuk UI di atas fold (LCP / navbar mobile).
 */
export const BRAND_LOGO = {
  mainDark: "/logo-arasvara/main-logo/main-logo-hitam-gema.png",
  mainLight: "/logo-arasvara/main-logo/main-logo-putih-naskah.png",
  /** Navbar / header mobile (~h-9–h-10) — ~11 KiB vs PNG 113 KiB */
  mainDarkW640: "/logo-arasvara/main-logo/main-logo-hitam-gema-w640.webp",
  /** Hero monogram overlay (~h-12–h-24) — ~8 KiB vs PNG 168 KiB */
  mainLightW400: "/logo-arasvara/main-logo/main-logo-putih-naskah-w400.webp",
  mainLightW640: "/logo-arasvara/main-logo/main-logo-putih-naskah-w640.webp",
  stackedDark: "/logo-arasvara/stacked-logo/stacked-logo-hitam-gema.png",
  stackedLight: "/logo-arasvara/stacked-logo/stacked-logo-putih-naskah.png",
  stackedLightW640:
    "/logo-arasvara/stacked-logo/stacked-logo-putih-naskah-w640.webp",
  monogramDark: "/logo-arasvara/monogram/monogram-hitam-gema.png",
  monogramLight: "/logo-arasvara/monogram/monogram-putih-naskah.png",
  containedMonogramDark:
    "/logo-arasvara/monogram/contained-monogram-hitam-gema.png",
  containedMonogramLight:
    "/logo-arasvara/monogram/contained-monogram-putih-naskah.png",
} as const;

/** Props aman untuk next/image logo brand (hindari re-encode WebP). */
export const BRAND_LOGO_IMAGE_PROPS = {
  unoptimized: true,
} as const;
