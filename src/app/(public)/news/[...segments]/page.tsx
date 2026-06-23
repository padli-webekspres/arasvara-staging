// app/news/[...segments]/page.tsx
// Catch-all route untuk URL legacy (1 segmen) dan structured (5 segmen).

import NewsDetailClient from "./NewsDetailClient";
import { Article } from "@/types/article";
import { notFound } from "next/navigation";
import {
  buildLegacyArticlePath,
  parseNewsArticlePath,
} from "@/lib/article-public-path";
import {
  fetchArticleBySlugForNewsPage,
  fetchPublishedArticleByPath,
} from "@/lib/server/fetchArticleServer";
import type { Metadata } from "next";
import {
  buildArticleOpenGraphImages,
  buildArticleTwitterImages,
  getSiteBaseUrl,
} from "@/lib/og-image";
import { buildArticleUrl } from "@/lib/utils";

/** Bungkus teks polos menjadi paragraf HTML agar parser & page-break konsisten */
function prepareGalleryContent(content: string): string {
  const trimmed = content?.trim() ?? "";
  if (!trimmed) return "";
  if (/<[a-z][\s\S]*>/i.test(trimmed)) return trimmed;
  return trimmed
    .split(/\n{2,}/)
    .filter(Boolean)
    .map((block) => {
      const escaped = block
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      return `<p>${escaped.replace(/\n/g, "<br/>")}</p>`;
    })
    .join("");
}

function injectTagLinks(html: string, tags: { name: string; slug: string }[]) {
  if (!tags || tags.length === 0) return html;

  let modifiedHtml = html;

  tags.forEach((tag) => {
    const regex = new RegExp(`(?<!<[^>]*)\\b(${tag.name})\\b(?![^<]*>)`, "gi");

    modifiedHtml = modifiedHtml.replace(
      regex,
      `<a href="/search?tags=${tag.slug}" class="text-hijauSawah font-semibold hover:underline">$1</a>`,
    );
  });

  return modifiedHtml;
}

function resolveCanonicalShareUrl(article: Article): string {
  const path =
    article.publicPath ??
    (article.slug ? buildLegacyArticlePath(article.slug) : "");
  return path ? buildArticleUrl(path) : "";
}

function buildMetadataFromArticle(article: Article): Metadata {
  const title = article.title;
  const description =
    article.excerpt ||
    article.content?.replace(/<[^>]*>/g, "").slice(0, 160) ||
    "";

  const baseUrl = getSiteBaseUrl();
  const shareUrl = resolveCanonicalShareUrl(article) || baseUrl;

  const defaultKeywords = [
    "arasvara",
    "berita",
    "berita terkini",
    "portal berita indonesia",
    "berita online",
    "media digital indonesia",
  ];
  const tagKeywords =
    article.tags
      ?.map((t) => (typeof t === "string" ? t : t?.name))
      .filter(Boolean) || [];
  const keywords = Array.from(new Set([...defaultKeywords, ...tagKeywords]));

  return {
    title,
    description,
    keywords,
    alternates: {
      canonical: shareUrl,
    },
    openGraph: {
      title,
      description,
      type: "article",
      url: shareUrl,
      siteName: "Arasvara",
      locale: "id_ID",
      images: buildArticleOpenGraphImages(article.featuredImage, title, baseUrl),
      publishedTime:
        article.publishedAt || article.createdAt
          ? new Date(article.publishedAt || article.createdAt).toISOString()
          : undefined,
      authors: article.author ? [article.author.name] : [],
    },
    twitter: {
      card: "summary_large_image",
      site: "@arasvara",
      title,
      description,
      images: buildArticleTwitterImages(article.featuredImage, baseUrl),
    },
  };
}

async function fetchArticleForSegments(
  segments: string[],
): Promise<Awaited<ReturnType<typeof fetchPublishedArticleByPath>>> {
  const parsed = parseNewsArticlePath(segments);
  if (!parsed) return null;

  if (parsed.kind === "legacy") {
    return fetchArticleBySlugForNewsPage(parsed.slug);
  }

  return fetchPublishedArticleByPath(parsed.publicPath);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ segments: string[] }>;
}): Promise<Metadata> {
  const { segments } = await params;

  try {
    const data = await fetchArticleForSegments(segments);
    if (!data?.article) {
      return {};
    }
    return buildMetadataFromArticle(data.article);
  } catch (error) {
    console.error("Gagal mengambil metadata untuk artikel:", error);
    return {};
  }
}

export default async function NewsDetailPage({
  params,
}: {
  params: Promise<{ segments: string[] }>;
}) {
  const { segments } = await params;

  try {
    const data = await fetchArticleForSegments(segments);

    if (!data?.article) {
      return notFound();
    }

    const isGallery = data.article.format === "GALLERY";
    const processedContent = isGallery
      ? prepareGalleryContent(data.article.content || "")
      : injectTagLinks(data.article.content || "", data.article.tags || []);

    const processedArticle = {
      ...data.article,
      content: processedContent,
    };

    const canonicalShareUrl = resolveCanonicalShareUrl(processedArticle);

    return (
      <NewsDetailClient
        article={processedArticle}
        related={data.related}
        canonicalShareUrl={canonicalShareUrl}
      />
    );
  } catch (err) {
    console.error("Gagal mengambil artikel:", err);
    return notFound();
  }
}
