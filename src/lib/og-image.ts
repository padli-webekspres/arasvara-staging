import type { Metadata } from "next";
import type { ArticleMedia } from "@/types/article";
import { resolvePublicMediaUrl } from "@/lib/media/public-media-url";

/** Rasio 1.91:1 — direkomendasikan Facebook/WhatsApp untuk link preview. */
export const SITE_OG_IMAGE = {
  path: "/og/arasvara-share.png",
  width: 1200,
  height: 630,
  type: "image/png" as const,
  alt: "Logo Arasvara — Portal Berita Digital Indonesia",
} as const;

/** Logo monogram asli untuk JSON-LD / favicon. */
export const SITE_LOGO = {
  path: "/logo-arasvara/monogram/contained-monogram-putih-naskah.png",
  width: 1821,
  height: 1821,
} as const;

export function getSiteBaseUrl(): string {
  return process.env.NEXT_PUBLIC_BASE_URL || "https://arasvara.id";
}

export function buildAbsoluteUrl(
  assetPath: string,
  baseUrl: string = getSiteBaseUrl(),
): string {
  if (assetPath.startsWith("http://") || assetPath.startsWith("https://")) {
    return assetPath;
  }

  const normalizedBase = baseUrl.replace(/\/$/, "");
  const normalizedPath = assetPath.startsWith("/")
    ? assetPath
    : `/${assetPath}`;

  return `${normalizedBase}${normalizedPath}`;
}

export function buildSiteOpenGraphImages(
  baseUrl: string = getSiteBaseUrl(),
): NonNullable<Metadata["openGraph"]>["images"] {
  const url = buildAbsoluteUrl(SITE_OG_IMAGE.path, baseUrl);

  return [
    {
      url,
      secureUrl: url,
      width: SITE_OG_IMAGE.width,
      height: SITE_OG_IMAGE.height,
      alt: SITE_OG_IMAGE.alt,
      type: SITE_OG_IMAGE.type,
    },
  ];
}

export function buildSiteTwitterImages(
  baseUrl: string = getSiteBaseUrl(),
): NonNullable<Metadata["twitter"]>["images"] {
  return [buildAbsoluteUrl(SITE_OG_IMAGE.path, baseUrl)];
}

function inferImageMimeType(url: string): string | undefined {
  const path = url.split("?")[0].toLowerCase();

  if (path.endsWith(".webp")) return "image/webp";
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".gif")) return "image/gif";

  return undefined;
}

/**
 * Ubah featured image artikel menjadi URL absolut yang bisa di-fetch crawler
 * WhatsApp/Facebook (path relatif, storage key, atau URL eksternal).
 */
export function resolveFeaturedImageAbsoluteUrl(
  featuredImage?: ArticleMedia | string | null,
  baseUrl: string = getSiteBaseUrl(),
): string | undefined {
  if (!featuredImage) return undefined;

  if (typeof featuredImage === "string") {
    const resolved = resolvePublicMediaUrl(featuredImage.trim());
    if (!resolved) return undefined;
    if (/^https?:\/\//i.test(resolved)) return resolved;
    return buildAbsoluteUrl(resolved, baseUrl);
  }

  const urlFromMedia = featuredImage.url?.trim();
  if (urlFromMedia) {
    if (/^https?:\/\//i.test(urlFromMedia)) return urlFromMedia;
    const resolved = resolvePublicMediaUrl(urlFromMedia);
    if (resolved) return resolved;
    return buildAbsoluteUrl(urlFromMedia, baseUrl);
  }

  return undefined;
}

export function buildArticleOpenGraphImages(
  featuredImage: ArticleMedia | undefined | null,
  alt: string,
  baseUrl: string = getSiteBaseUrl(),
): NonNullable<Metadata["openGraph"]>["images"] {
  const url = resolveFeaturedImageAbsoluteUrl(featuredImage, baseUrl);

  if (!url) {
    return buildSiteOpenGraphImages(baseUrl);
  }

  const type =
    (typeof featuredImage === "object" && featuredImage?.media?.mimetype) ||
    inferImageMimeType(url);

  return [
    {
      url,
      secureUrl: url,
      alt,
      ...(type ? { type } : {}),
      width: 1280,
      height: 800,
    },
  ];
}

export function buildArticleTwitterImages(
  featuredImage: ArticleMedia | undefined | null,
  baseUrl: string = getSiteBaseUrl(),
): NonNullable<Metadata["twitter"]>["images"] {
  const url = resolveFeaturedImageAbsoluteUrl(featuredImage, baseUrl);

  if (!url) {
    return buildSiteTwitterImages(baseUrl);
  }

  return [url];
}
