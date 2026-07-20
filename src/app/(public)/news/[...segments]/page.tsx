// Route legacy artikel: /news/{slug}
// PUBLISHED → permanentRedirect ke publicPath structured (301)

import NewsDetailClient from "@/components/news/NewsDetailClient";
import { notFound, permanentRedirect } from "next/navigation";
import { parseLegacyNewsSegments } from "@/lib/article-public-path";
import {
  fetchArticleBySlugForNewsPage,
  fetchPublishedArticleByPath,
  fetchPublishedArticleBySlug,
} from "@/lib/server/fetchArticleServer";
import {
  buildMetadataFromArticle,
  prepareArticleDetailPayload,
} from "@/lib/server/article-detail-page";
import ArticleJsonLd from "@/components/news/ArticleJsonLd";
import type { Metadata } from "next";

function buildNewsCategoryStructuredPath(segments: string[]): string | null {
  if (segments.length !== 4) return null;

  const [year, month, day, slug] = segments.map((segment) => segment.trim());
  if (!year || !month || !day || !slug) return null;
  if (!/^\d{4}$/.test(year)) return null;
  if (!/^\d{1,2}$/.test(month) || !/^\d{1,2}$/.test(day)) return null;

  const monthNum = Number(month);
  const dayNum = Number(day);
  if (monthNum < 1 || monthNum > 12) return null;
  if (dayNum < 1 || dayNum > 31) return null;

  return `/news/${year}/${month.padStart(2, "0")}/${day.padStart(2, "0")}/${encodeURIComponent(slug)}`;
}

/**
 * Resolve artikel dari segmen /news/...
 * - 1 segmen (legacy slug): PUBLISHED → redirect ke publicPath; non-published → preview staf
 * - 4 segmen: structured kategori "news"
 */
async function fetchArticleFromNewsRouteSegments(segments: string[]) {
  const parsed = parseLegacyNewsSegments(segments);
  if (parsed) {
    const published = await fetchPublishedArticleBySlug(parsed.slug);
    if (published?.article) {
      const publicPath = published.article.publicPath?.trim();
      if (publicPath) {
        permanentRedirect(publicPath);
      }
      // Fallback: render di /news/{slug} jika belum punya publicPath
      return published;
    }

    return fetchArticleBySlugForNewsPage(parsed.slug);
  }

  const structuredPath = buildNewsCategoryStructuredPath(segments);
  if (!structuredPath) return null;
  return fetchPublishedArticleByPath(structuredPath);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ segments: string[] }>;
}): Promise<Metadata> {
  const { segments } = await params;

  try {
    const data = await fetchArticleFromNewsRouteSegments(segments);
    if (!data?.article) {
      return {};
    }
    return buildMetadataFromArticle(data.article);
  } catch (error) {
    // permanentRedirect / notFound melempar — biarkan propagate
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      typeof (error as { digest?: unknown }).digest === "string" &&
      ((error as { digest: string }).digest.startsWith("NEXT_REDIRECT") ||
        (error as { digest: string }).digest.startsWith(
          "NEXT_HTTP_ERROR_FALLBACK",
        ))
    ) {
      throw error;
    }
    console.error("Gagal mengambil metadata untuk artikel legacy:", error);
    return {};
  }
}

export default async function LegacyNewsDetailPage({
  params,
}: {
  params: Promise<{ segments: string[] }>;
}) {
  const { segments } = await params;

  const data = await fetchArticleFromNewsRouteSegments(segments);

  if (!data?.article) {
    notFound();
  }

  const payload = prepareArticleDetailPayload(data);

  return (
    <>
      <ArticleJsonLd
        article={payload.article}
        shareUrl={payload.canonicalShareUrl}
      />
      <NewsDetailClient
        article={payload.article}
        related={payload.related}
        canonicalShareUrl={payload.canonicalShareUrl}
      />
    </>
  );
}
