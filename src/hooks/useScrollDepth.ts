import { useEffect, useRef } from "react";
import { trackArticleReadComplete } from "@/lib/google-analytics";
import type { Article } from "@/types/article";
import { shouldCountArticleView } from "@/lib/articleViewAccess";

const MARKER_ID = "article-end-marker";
const SESSION_KEY_PREFIX = "read_complete_";

function getSessionKey(articleId: string, contentPage: number | "all"): string {
  return `${SESSION_KEY_PREFIX}${articleId}_${contentPage}`;
}

function isAlreadyTracked(articleId: string, contentPage: number | "all"): boolean {
  try {
    return Boolean(sessionStorage.getItem(getSessionKey(articleId, contentPage)));
  } catch {
    return false;
  }
}

function markAsTracked(articleId: string, contentPage: number | "all"): void {
  try {
    sessionStorage.setItem(getSessionKey(articleId, contentPage), "1");
  } catch {
    // Ignore storage errors (private browsing, quota exceeded)
  }
}

/**
 * Hook tracking scroll depth artikel (Fase 2).
 *
 * Menggunakan IntersectionObserver pada elemen #article-end-marker.
 * Ketika marker masuk viewport, kirim event `article_read_complete` via gtag
 * beserta `time_on_page_seconds` sejak hook ini di-mount.
 *
 * Event hanya dikirim sekali per artikel per page per sesi (sessionStorage dedup).
 */
export function useScrollDepth(
  articleId: string,
  contentPage: number | "all",
  article: Article,
): void {
  const mountTimeRef = useRef<number>(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!articleId) return;
    if (!shouldCountArticleView(article.status)) return;

    // Reset timer setiap kali article/page berubah
    mountTimeRef.current = Date.now();

    // Sudah ditandai di sesi ini — tidak perlu observe lagi
    if (isAlreadyTracked(articleId, contentPage)) return;

    let observer: IntersectionObserver | null = null;

    function setupObserver(): (() => void) | void {
      const marker = document.getElementById(MARKER_ID);
      if (!marker) return;

      observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (!entry?.isIntersecting) return;

          // Hindari double-fire jika observer callback dipanggil ulang
          if (isAlreadyTracked(articleId, contentPage)) {
            observer?.disconnect();
            return;
          }

          const timeOnPageSeconds = (Date.now() - mountTimeRef.current) / 1000;
          markAsTracked(articleId, contentPage);
          observer?.disconnect();

          trackArticleReadComplete(article, timeOnPageSeconds, contentPage);
        },
        { threshold: 0 },
      );

      observer.observe(marker);
    }

    // Marker mungkin belum ter-render saat effect jalan (React batching).
    // Gunakan requestAnimationFrame untuk menunggu satu paint cycle.
    let rafId: number;
    let retryCount = 0;
    const MAX_RETRIES = 10;

    function trySetupObserver() {
      const marker = document.getElementById(MARKER_ID);
      if (marker) {
        setupObserver();
        return;
      }
      if (retryCount < MAX_RETRIES) {
        retryCount++;
        rafId = requestAnimationFrame(trySetupObserver);
      }
    }

    rafId = requestAnimationFrame(trySetupObserver);

    return () => {
      cancelAnimationFrame(rafId);
      observer?.disconnect();
    };
    // article disertakan agar closure punya data terbaru saat event dikirim
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articleId, contentPage]);
}
