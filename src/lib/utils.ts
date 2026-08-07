import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { resolveCmsArticleViewHref } from "@/lib/article-public-path";
import type { ArticleStatus } from "@/types/article";
import { resolvePublicMediaUrl } from "@/lib/media/public-media-url";
import {
  formatDateReadableJakarta,
  formatDatetimeLocalFromUtc,
  formatDateTimeReadableJakarta,
  formatTimeReadableJakarta,
} from "@/lib/datetime-jakarta";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Konversi UTC ISO → string input datetime-local (wall-clock Asia/Jakarta). */
export function toJakartaDatetimeLocal(dateValue: string) {
  return formatDatetimeLocalFromUtc(dateValue);
}

/** Format tanggal di Asia/Jakarta (mis. 19 Juli 2026). */
export function formatDateReadable(dateValue: string | Date, locale = "id-ID") {
  return formatDateReadableJakarta(dateValue, locale);
}

/** Format tanggal + jam di Asia/Jakarta (mis. 19 Juli 2026, 22:35). */
export function formatDateTimeReadable(
  dateValue: string | Date,
  locale = "id-ID",
) {
  return formatDateTimeReadableJakarta(dateValue, locale);
}

/** Format jam di Asia/Jakarta dengan suffix WIB (mis. 22:35 WIB). */
export function formatTimeReadable(dateValue: string | Date, locale = "id-ID") {
  return formatTimeReadableJakarta(dateValue, locale);
}

/** URL absolut dari publicPath kanonik artikel. */
export function buildArticleUrl(publicPath: string): string {
  const cleanPath = publicPath.trim();
  if (!cleanPath) return "";
  const path = cleanPath.startsWith("/") ? cleanPath : `/${cleanPath}`;
  if (typeof window !== "undefined") {
    return `${window.location.origin}${path}`;
  }
  const base = (
    process.env.NEXT_PUBLIC_BASE_URL || "https://arasvara.id"
  ).replace(/\/+$/, "");
  return `${base}${path}`;
}

/** URL absolut untuk link "Lihat"/share dari CMS admin (status-aware). */
export function resolveCmsArticleShareUrl(article: {
  status: ArticleStatus | string;
  slug?: string | null;
  publicPath?: string | null;
  categorySlug?: string | null;
  publishedAt?: Date | string | null;
}): string {
  const href = resolveCmsArticleViewHref(article);
  if (!href || href === "#") return "";
  return buildArticleUrl(href);
}

/** URL kanonikal artikel untuk share CMS preview by slug (non-PUBLISHED). */
export function buildArticleShareUrl(slug: string): string {
  const cleanSlug = slug.trim();
  if (!cleanSlug) return "";
  const path = `/news/${encodeURIComponent(cleanSlug)}`;
  if (typeof window !== "undefined") {
    return `${window.location.origin}${path}`;
  }
  const base = (
    process.env.NEXT_PUBLIC_BASE_URL || "https://arasvara.id"
  ).replace(/\/+$/, "");
  return `${base}${path}`;
}

/** @deprecated Gunakan buildArticleShareUrl(slug) */
export function getShareUrl(slug?: string) {
  if (slug?.trim()) return buildArticleShareUrl(slug);
  if (typeof window === "undefined") return "";
  return `${window.location.origin}${window.location.pathname}`;
}

/**
 * Salin teks ke clipboard — aman di Windows/Mac/Android/iOS
 * dan Chrome/Firefox/Safari, termasuk konteks non-HTTPS (mis. http://192.168.x.x).
 *
 * `navigator.clipboard` hanya ada di secure context (HTTPS/localhost).
 * Di HTTP LAN / beberapa Safari, API itu undefined → pakai fallback execCommand.
 */
export async function copyToClipboard(
  text: string,
  setCopied?: (copied: boolean) => void,
): Promise<boolean> {
  if (typeof window === "undefined" || !text) return false;

  const markCopied = () => {
    if (!setCopied) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  // 1) Clipboard API (HTTPS, localhost, sebagian browser modern)
  if (
    window.isSecureContext &&
    typeof navigator !== "undefined" &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === "function"
  ) {
    try {
      await navigator.clipboard.writeText(text);
      markCopied();
      return true;
    } catch {
      // Lanjut ke fallback (permission ditolak, dsb.)
    }
  }

  // 2) Fallback: textarea + document.execCommand("copy")
  //    Berjalan di HTTP, iOS Safari, Firefox lama, dll.
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.setAttribute("aria-hidden", "true");
  // Jangan pakai display:none — iOS Safari tidak bisa select isinya
  textarea.style.cssText =
    "position:fixed;top:0;left:0;width:1px;height:1px;padding:0;border:0;opacity:0;";
  document.body.appendChild(textarea);

  const isIOS =
    /ipad|iphone|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  let succeeded = false;
  try {
    textarea.focus();
    if (isIOS) {
      const range = document.createRange();
      range.selectNodeContents(textarea);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      textarea.setSelectionRange(0, text.length);
    } else {
      textarea.select();
    }
    succeeded = document.execCommand("copy");
  } catch {
    succeeded = false;
  } finally {
    document.body.removeChild(textarea);
  }

  if (succeeded) markCopied();
  return succeeded;
}

// Helper untuk mendapatkan initials dari nama (misal: "John Doe" -> "JD"). harus 2 huruf outputnya. jika hanya 1 kata, ambil 2 huruf pertama (misal: "Madonna" -> "MA")
export function getInitials(name: string) {
  if (!name) return "";
  const words = name.trim().split(" ");
  if (words.length === 1) {
    return words[0].substring(0, 2).toUpperCase();
  }
  return (words[0][0] + words[1][0]).toUpperCase();
}

/**
 * Split article HTML content into pages by page break markers inserted by the
 * PageBreak tiptap extension (`<div data-page-break="true">`).
 * Works on both server (regex fallback) and client (DOMParser).
 * Returns an array of HTML strings, one per page.
 * If there are no markers, returns a single-element array with the full HTML.
 */
export function splitContentByPageBreak(html: string): string[] {
  if (!html) return [""];

  if (typeof window !== "undefined") {
    // Client-side: use DOM for accurate parsing
    const container = document.createElement("div");
    container.innerHTML = html;
    const pages: string[] = [];
    let current = "";
    for (const child of Array.from(container.children)) {
      if (child.getAttribute("data-page-break") === "true") {
        pages.push(current);
        current = "";
      } else {
        current += child.outerHTML;
      }
    }
    pages.push(current);
    return pages.map((p) => p.trim()).filter(Boolean);
  }

  // Server-side fallback: depth-counting parser to find page break divs
  const SENTINEL = "\x00PB\x00";
  const tag = 'data-page-break="true"';
  let result = "";
  let i = 0;
  while (i < html.length) {
    if (
      html.startsWith("<div", i) &&
      html.indexOf(tag, i) !== -1 &&
      html.indexOf(tag, i) < html.indexOf(">", i)
    ) {
      // Found a page break opening div — skip entire block by counting depth
      let depth = 0;
      let j = i;
      while (j < html.length) {
        if (html.startsWith("</div>", j)) {
          if (depth === 1) {
            j += 6;
            break;
          }
          depth--;
          j += 6;
        } else if (html.startsWith("<div", j)) {
          depth++;
          while (j < html.length && html[j] !== ">") j++;
          j++;
        } else {
          j++;
        }
      }
      result += SENTINEL;
      i = j;
    } else {
      result += html[i];
      i++;
    }
  }
  return result
    .split(SENTINEL)
    .map((p) => p.trim())
    .filter(Boolean);
}

export const getPageNumbers = (current: number, total: number) => {
  // Show up to 5 pages, with ellipsis if needed
  const pages = [];
  if (total <= 5) {
    for (let i = 1; i <= total; i++) pages.push(i);
  } else {
    if (current <= 3) {
      pages.push(1, 2, 3, 4, "...", total);
    } else if (current >= total - 2) {
      pages.push(1, "...", total - 3, total - 2, total - 1, total);
    } else {
      pages.push(1, "...", current - 1, current, current + 1, "...", total);
    }
  }
  return pages;
};

// Extract all media keys (filenames) from editor HTML (for contentMediaIds)
export function extractContentMediaIdsFromHtml(html: string): string[] {
  if (!html) return [];
  const regex = /\/api\/media\/view\?key=([^"'>]+)/g;
  const ids: string[] = [];
  let match;
  while ((match = regex.exec(html))) {
    ids.push(match[1]);
  }
  return ids;
}

/**
 * Bangun URL proxy relatif dari filename atau key storage.
 * Selalu valid di semua environment — server akan redirect ke CDN.
 */
function buildProxyUrl(key: string): string {
  const cleaned = key.trim().replace(/^\//, "");
  if (!cleaned) return "";
  return `/api/media/view?key=${encodeURIComponent(cleaned)}`;
}

/**
 * Ambil URL preview media untuk dipakai di editor admin.
 * Prioritas: CDN URL absolut → proxy relatif (fallback aman di semua env).
 * Menerima Media object, filename string, proxy path, atau URL absolut.
 */
export function getMediaPreviewUrl(media: unknown): string | null {
  if (!media) return null;

  if (typeof media === "string") {
    const trimmed = media.trim();
    if (!trimmed) return null;
    // URL absolut — pakai langsung
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    // Proxy path — pakai langsung
    if (trimmed.startsWith("/api/media/view")) return trimmed;
    // Coba resolve ke CDN dulu, fallback ke proxy
    const resolved = resolvePublicMediaUrl(trimmed);
    return resolved || buildProxyUrl(trimmed);
  }

  if (typeof media === "object" && media !== null) {
    const obj = media as Record<string, unknown>;

    // 1. Coba dari obj.url
    if (typeof obj.url === "string" && obj.url.trim()) {
      const urlStr = obj.url.trim();
      if (/^https?:\/\//i.test(urlStr)) return urlStr;
      if (urlStr.startsWith("/api/media/view")) return urlStr;
      const resolved = resolvePublicMediaUrl(urlStr);
      if (resolved) return resolved;
    }

    // 2. Coba dari obj.filename → CDN dulu, fallback proxy
    if (typeof obj.filename === "string" && obj.filename.trim()) {
      const resolved = resolvePublicMediaUrl(obj.filename);
      if (resolved) return resolved;
      return buildProxyUrl(obj.filename.trim());
    }

    // 3. Coba dari obj._id sebagai key storage (jarang, tapi sebagai last resort)
    if (obj._id) {
      const idStr = String(obj._id).trim();
      const resolved = resolvePublicMediaUrl(idStr);
      if (resolved) return resolved;
    }
  }

  return null;
}

/**
 * Kartu list/search: URL absolut (CDN/MinIO) dan proxy relatif tidak lewat next/image optimizer.
 */
export function shouldUnoptimizeNewsCardImage(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return true;
  if (trimmed.startsWith("https://") || trimmed.startsWith("http://")) return true;
  return !trimmed.startsWith("http");
}
