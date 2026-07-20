// Halaman detail artikel structured: /{category}/{yyyy}/{mm}/{dd}/{slug}

import NewsDetailClient from "@/components/news/NewsDetailClient";
import { notFound } from "next/navigation";
import { parseStructuredArticleSegments } from "@/lib/article-public-path";
import { fetchPublishedArticleByPath } from "@/lib/server/fetchArticleServer";
import {
  buildMetadataFromArticle,
  prepareArticleDetailPayload,
} from "@/lib/server/article-detail-page";
import ArticleJsonLd from "@/components/news/ArticleJsonLd";
import type { Metadata } from "next";

type StructuredPageParams = {
  category: string;
  yyyy: string;
  mm: string;
  dd: string;
  slug: string;
};

function parseStructuredParams(params: StructuredPageParams) {
  return parseStructuredArticleSegments([
    params.category,
    params.yyyy,
    params.mm,
    params.dd,
    params.slug,
  ]);
}

async function fetchArticleForStructuredParams(params: StructuredPageParams) {
  const parsed = parseStructuredParams(params);
  if (!parsed) return null;
  return fetchPublishedArticleByPath(parsed.publicPath);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<StructuredPageParams>;
}): Promise<Metadata> {
  const resolved = await params;

  try {
    const data = await fetchArticleForStructuredParams(resolved);
    if (!data?.article) {
      return {};
    }
    return buildMetadataFromArticle(data.article);
  } catch (error) {
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
    console.error("Gagal mengambil metadata untuk artikel structured:", error);
    return {};
  }
}

export default async function StructuredArticlePage({
  params,
}: {
  params: Promise<StructuredPageParams>;
}) {
  const resolved = await params;

  const data = await fetchArticleForStructuredParams(resolved);

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
