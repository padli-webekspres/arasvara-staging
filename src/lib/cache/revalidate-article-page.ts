import { revalidatePath, revalidateTag } from "next/cache";
import {
  getArticleCacheTag,
  getArticleCacheTagFromPublicPath,
} from "@/lib/cache/article-cache-config";

function normalizePublicPath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

/** Ambil slug artikel dari publicPath legacy atau structured (segmen terakhir). */
export function extractSlugFromPublicPath(publicPath: string): string | null {
  const normalized = normalizePublicPath(publicPath);
  if (!normalized) return null;

  const segments = normalized.replace(/^\/+/, "").split("/").filter(Boolean);
  if (segments.length === 0) return null;

  const last = segments[segments.length - 1];
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
}

/**
 * Invalidate ISR cache untuk halaman publik artikel.
 * `publicPath` adalah path penuh, mis. `/news/slug` atau `/{cat}/{y}/{m}/{d}/{slug}`.
 */
export function revalidateArticlePage(
  publicPath: string,
  previousPublicPath?: string,
): void {
  const normalized = normalizePublicPath(publicPath);
  if (!normalized) return;

  const slug = extractSlugFromPublicPath(normalized);
  if (slug) {
    revalidateTag(getArticleCacheTag(slug), "max");
  }
  revalidateTag(getArticleCacheTagFromPublicPath(normalized), "max");
  revalidatePath(normalized);

  const prev = previousPublicPath?.trim()
    ? normalizePublicPath(previousPublicPath)
    : "";
  if (prev && prev !== normalized) {
    const prevSlug = extractSlugFromPublicPath(prev);
    if (prevSlug) {
      revalidateTag(getArticleCacheTag(prevSlug), "max");
    }
    revalidateTag(getArticleCacheTagFromPublicPath(prev), "max");
    revalidatePath(prev);
  }
}
