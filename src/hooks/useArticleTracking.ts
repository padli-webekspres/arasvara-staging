/**
 * Hook tracking artikel.
 *
 * - Fase 1: event `view_article` dikirim server-only via Measurement Protocol
 *   di /api/analytics/view-article (NewsDetailClient). Hook ini tidak memanggil
 *   trackArticleView() dari browser untuk menghindari double-count.
 *
 * - Fase 2: scroll depth tracking via useScrollDepth — kirim `article_read_complete`
 *   saat user mencapai akhir konten artikel.
 */
import { useScrollDepth } from "@/hooks/useScrollDepth";
import type { Article } from "@/types/article";

export function useArticleTracking(article: Article, pageNum: number | "all") {
  useScrollDepth(String(article._id ?? ""), pageNum, article);
}
