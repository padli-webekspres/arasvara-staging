// Route legacy artikel: /news/{slug}

import NewsDetailClient from "@/components/news/NewsDetailClient";
import { notFound } from "next/navigation";
import { parseLegacyNewsSegments } from "@/lib/article-public-path";
import {
  fetchArticleBySlugForNewsPage,
  fetchPublishedArticleByPath,
} from "@/lib/server/fetchArticleServer";
import {
  buildMetadataFromArticle,
  prepareArticleDetailPayload,
} from "@/lib/server/article-detail-page";
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

async function fetchArticleFromNewsRouteSegments(segments: string[]) {
  // Legacy URL: /news/{slug}
  const parsed = parseLegacyNewsSegments(segments);
  if (parsed) {
    return fetchArticleBySlugForNewsPage(parsed.slug);
  }

  // Structured URL for category "news": /news/{yyyy}/{mm}/{dd}/{slug}
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

  try {
    const data = await fetchArticleFromNewsRouteSegments(segments);

    if (!data?.article) {
      return notFound();
    }

    const payload = prepareArticleDetailPayload(data);

    return (
      <NewsDetailClient
        article={payload.article}
        related={payload.related}
        canonicalShareUrl={payload.canonicalShareUrl}
      />
    );
  } catch (err) {
    console.error("Gagal mengambil artikel legacy:", err);
    return notFound();
  }
}
