/**
 * Path aset brand Arasvara.
 * Pakai PNG (bukan WebP) agar alpha transparan aman di Safari/iOS/Android
 * dan tidak terkena black-matte bug saat dioptimasi next/image.
 */
export const BRAND_LOGO = {
  mainDark: "/logo-arasvara/main-logo/main-logo-hitam-gema.png",
  mainLight: "/logo-arasvara/main-logo/main-logo-putih-naskah.png",
  stackedDark: "/logo-arasvara/stacked-logo/stacked-logo-hitam-gema.png",
  stackedLight: "/logo-arasvara/stacked-logo/stacked-logo-putih-naskah.png",
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
