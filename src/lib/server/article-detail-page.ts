import type { Metadata } from "next";
import { Article } from "@/types/article";
import { buildLegacyArticlePath } from "@/lib/article-public-path";
import {
  buildArticleOpenGraphImages,
  buildArticleTwitterImages,
  getSiteBaseUrl,
} from "@/lib/og-image";
import {
  resolveArticleDateModified,
  toIsoStringOrNull,
} from "@/lib/datetime-jakarta";
import { buildArticleUrl } from "@/lib/utils";
import type { ArticleDetailFetchResult } from "@/lib/server/fetchArticleServer";

/** Bungkus teks polos menjadi paragraf HTML agar parser & page-break konsisten */
export function prepareGalleryContent(content: string): string {
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

export function injectTagLinks(
  html: string,
  tags: { name: string; slug: string }[],
): string {
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

export function resolveCanonicalShareUrl(article: Article): string {
  const path =
    article.publicPath ??
    (article.slug ? buildLegacyArticlePath(article.slug) : "");
  return path ? buildArticleUrl(path) : "";
}

export function buildMetadataFromArticle(article: Article): Metadata {
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
        toIsoStringOrNull(article.publishedAt) ??
        toIsoStringOrNull(article.createdAt) ??
        undefined,
      modifiedTime: resolveArticleDateModified(article) ?? undefined,
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

export function prepareArticleDetailPayload(data: ArticleDetailFetchResult) {
  const isGallery = data.article.format === "GALLERY";
  const processedContent = isGallery
    ? prepareGalleryContent(data.article.content || "")
    : injectTagLinks(data.article.content || "", data.article.tags || []);

  const processedArticle = {
    ...data.article,
    content: processedContent,
  };

  return {
    article: processedArticle,
    related: data.related,
    canonicalShareUrl: resolveCanonicalShareUrl(processedArticle),
  };
}
