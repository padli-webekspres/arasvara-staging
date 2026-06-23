// Halaman detail artikel structured: /{category}/{yyyy}/{mm}/{dd}/{slug}

import NewsDetailClient from "@/components/news/NewsDetailClient";
import { notFound } from "next/navigation";
import { parseStructuredArticleSegments } from "@/lib/article-public-path";
import { fetchPublishedArticleByPath } from "@/lib/server/fetchArticleServer";
import {
  buildMetadataFromArticle,
  prepareArticleDetailPayload,
} from "@/lib/server/article-detail-page";
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

  try {
    const data = await fetchArticleForStructuredParams(resolved);

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
    console.error("Gagal mengambil artikel structured:", err);
    return notFound();
  }
}
