const MEDIA_VIEW_PROXY_REGEX = /\/api\/media\/view\?key=([^&]+)/i;

/** Base URL publik untuk bucket images (tanpa trailing slash). */
export function getPublicMediaBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_STORAGE_MEDIA || "").replace(/\/$/, "");
}

/**
 * Ekstrak storage key dari berbagai format input.
 * Mengembalikan null jika input kosong atau sudah URL absolut http(s).
 */
export function extractMediaKeyFromInput(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const proxyMatch = trimmed.match(MEDIA_VIEW_PROXY_REGEX);
  if (proxyMatch) {
    try {
      return decodeURIComponent(proxyMatch[1]);
    } catch {
      return proxyMatch[1];
    }
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return null;
  }

  return trimmed;
}

/**
 * Bangun URL publik CDN dari filename, proxy path, atau URL absolut.
 */
export function resolvePublicMediaUrl(input?: string | null): string {
  if (input == null) return "";
  const trimmed = input.trim();
  if (!trimmed) return "";

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  const key = extractMediaKeyFromInput(trimmed);
  if (!key) return "";

  const base = getPublicMediaBaseUrl();
  if (!base) return "";

  const normalizedKey = key.replace(/^\//, "");
  return `${base}/${normalizedKey}`;
}

/** Regex untuk src proxy relatif atau absolut di HTML artikel. */
const HTML_PROXY_SRC_REGEX =
  /(\bsrc\s*=\s*)(["'])((?:https?:\/\/[^"'/]+)?\/api\/media\/view\?key=([^"'&]+)(?:&[^"']*)?)\2/gi;

function replaceProxySrcWithCdn(
  prefix: string,
  quote: string,
  encodedKey: string,
): string {
  let key = encodedKey;
  try {
    key = decodeURIComponent(encodedKey);
  } catch {
    // keep raw
  }
  const cdnUrl = resolvePublicMediaUrl(key);
  return `${prefix}${quote}${cdnUrl}${quote}`;
}

/**
 * Ganti semua src proxy gambar di HTML konten artikel menjadi URL CDN.
 */
export function rewriteArticleContentMediaUrls(html: string): string {
  if (!html?.trim()) return html ?? "";

  return html.replace(
    HTML_PROXY_SRC_REGEX,
    (_match, prefix: string, quote: string, _fullProxy: string, encodedKey: string) =>
      replaceProxySrcWithCdn(prefix, quote, encodedKey),
  );
}
