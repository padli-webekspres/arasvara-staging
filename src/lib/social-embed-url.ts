/** URL embed sosial: normalisasi, klasifikasi Facebook, dan tautan bersih. */

const FACEBOOK_HOSTS = new Set([
  "facebook.com",
  "www.facebook.com",
  "m.facebook.com",
  "web.facebook.com",
  "fb.com",
  "www.fb.com",
  "fb.watch",
  "www.fb.watch",
]);

const TRACKING_PARAMS = new Set([
  "ref",
  "referral_code",
  "referral_story_type",
  "fbclid",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "igsh",
  "igshid",
  "is_from_webapp",
  "sender_device",
  "is_copy_url",
  "rdid",
  "share_url",
]);

export type FacebookEmbedKind =
  | "post"
  | "video"
  | "reel"
  | "marketplace"
  | "unsupported";

export function decodeEmbedAttributeUrl(raw: string | undefined | null): string {
  if (!raw) return "";
  return raw
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

export function stripTrackingParams(url: string): string {
  try {
    const parsed = new URL(url);
    for (const key of [...parsed.searchParams.keys()]) {
      if (TRACKING_PARAMS.has(key.toLowerCase())) {
        parsed.searchParams.delete(key);
      }
    }
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return url;
  }
}

export function normalizeFacebookUrl(raw: string): string {
  const decoded = decodeEmbedAttributeUrl(raw);
  let value = decoded;
  try {
    if (/%[0-9A-Fa-f]{2}/.test(decoded)) {
      value = decodeURIComponent(decoded);
    }
  } catch {
    value = decoded;
  }

  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase();
    if (host === "fb.com" || host === "www.fb.com") {
      parsed.hostname = "www.facebook.com";
    } else if (host === "m.facebook.com" || host === "web.facebook.com") {
      parsed.hostname = "www.facebook.com";
    }
    if (host === "fb.watch" || host === "www.fb.watch") {
      return stripTrackingParams(parsed.toString());
    }
    return stripTrackingParams(parsed.toString());
  } catch {
    return value;
  }
}

export function classifyFacebookUrl(raw: string): FacebookEmbedKind {
  const url = normalizeFacebookUrl(raw);
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "unsupported";
  }

  if (!FACEBOOK_HOSTS.has(parsed.hostname.toLowerCase())) {
    return "unsupported";
  }

  const path = parsed.pathname.toLowerCase();
  const host = parsed.hostname.toLowerCase();

  if (path.includes("/marketplace/")) return "marketplace";
  if (path.includes("/events/")) return "unsupported";
  if (path.includes("/groups/") && !path.includes("/posts/")) {
    return "unsupported";
  }

  // Reel dan short link /share/v|r/ hampir selalu ditolak plugin Facebook
  // (pesan "This Facebook post is no longer available"), termasuk setelah
  // di-resolve ke /reel/{id}. Jangan kirim ke iframe plugin.
  if (
    path.includes("/reel/") ||
    path.includes("/reels/") ||
    path.includes("/share/v/") ||
    path.includes("/share/r/")
  ) {
    return "reel";
  }

  if (
    host === "fb.watch" ||
    host === "www.fb.watch" ||
    path.includes("/videos/") ||
    path.includes("/watch")
  ) {
    return "video";
  }

  if (
    path.includes("/posts/") ||
    path.includes("/permalink.php") ||
    path.includes("/story.php") ||
    path.includes("/photo.php") ||
    path.includes("/photos/") ||
    path.includes("/share/p/") ||
    path.includes("/share/")
  ) {
    return "post";
  }

  return "unsupported";
}

/** Short link Facebook (`/share/v/`, `/share/p/`, `/share/r/`) perlu di-resolve ke /reel, /videos, atau /posts. */
export function isFacebookShareShortLink(raw: string): boolean {
  try {
    const parsed = new URL(normalizeFacebookUrl(raw));
    return /\/share\/(?:v|p|r)\//i.test(parsed.pathname);
  } catch {
    return false;
  }
}

export function isAllowedFacebookHost(hostname: string): boolean {
  return FACEBOOK_HOSTS.has(hostname.toLowerCase());
}

export function facebookPluginSrc(
  url: string,
  kind: "post" | "video",
  width = 500,
): string {
  const href = encodeURIComponent(normalizeFacebookUrl(url));
  const plugin = kind === "video" ? "video.php" : "post.php";
  return `https://www.facebook.com/plugins/${plugin}?href=${href}&show_text=true&width=${width}`;
}

const TIKTOK_ID_PATH = /\/(?:video|photo|v)\/(\d+)/i;

export function parseTikTokVideoId(raw: string): string | null {
  const decoded = decodeEmbedAttributeUrl(raw);
  try {
    const parsed = new URL(decoded);
    const fromPath = parsed.pathname.match(TIKTOK_ID_PATH);
    if (fromPath?.[1]) return fromPath[1];
  } catch {
    const fallback = decoded.match(TIKTOK_ID_PATH);
    if (fallback?.[1]) return fallback[1];
  }
  return null;
}

export function normalizeTikTokUrl(raw: string): string {
  const decoded = decodeEmbedAttributeUrl(raw);
  const id = parseTikTokVideoId(decoded);
  if (id) {
    const userMatch = decoded.match(/tiktok\.com\/(@[^/?#]+)/i);
    const user = userMatch?.[1] ?? "@tiktok";
    return `https://www.tiktok.com/${user}/video/${id}`;
  }
  try {
    return stripTrackingParams(decoded);
  } catch {
    return decoded;
  }
}

/** Iframe resmi TikTok. Jangan pakai `/player/v1/` — itu yang menampilkan "overload-protect triggered". */
export function tiktokEmbedSrc(videoId: string): string {
  return `https://www.tiktok.com/embed/v2/${videoId}`;
}

export function tiktokOembedRequestUrl(canonicalVideoUrl: string): string {
  return `https://www.tiktok.com/oembed?url=${encodeURIComponent(canonicalVideoUrl)}`;
}
