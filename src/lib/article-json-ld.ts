import type { Article } from "@/types/article";
import {
  resolveArticleDateModified,
  toIsoStringOrNull,
} from "@/lib/datetime-jakarta";
import { resolveAuthorPublicHref } from "@/lib/author-public-path";
import { buildAbsoluteUrl, getSiteBaseUrl } from "@/lib/og-image";

const PUBLISHER_LOGO = "https://arasvara.id/logo.png";

export type NewsArticleJsonLd = {
  "@context": "https://schema.org";
  "@type": "NewsArticle";
  headline: string;
  description?: string;
  image?: string | string[];
  datePublished: string | undefined;
  dateModified: string | undefined;
  url?: string;
  mainEntityOfPage?: {
    "@type": "WebPage";
    "@id": string;
  };
  author: {
    "@type": "Person";
    name: string;
    url?: string;
  };
  publisher: {
    "@type": "Organization";
    name: string;
    logo: {
      "@type": "ImageObject";
      url: string;
    };
  };
};

/**
 * Bangun JSON-LD NewsArticle dengan datePublished/dateModified sebagai ISO UTC.
 */
export function buildArticleNewsArticleJsonLd(
  article: Article,
  shareUrl: string,
): NewsArticleJsonLd {
  const datePublished =
    toIsoStringOrNull(article.publishedAt) ??
    toIsoStringOrNull(article.createdAt) ??
    undefined;
  const dateModified =
    resolveArticleDateModified(article) ?? datePublished ?? undefined;

  const authorHref = resolveAuthorPublicHref(article.author);
  const authorProfileUrl = authorHref
    ? buildAbsoluteUrl(authorHref, getSiteBaseUrl())
    : undefined;

  const featured = article.featuredImage;
  const imageUrl =
    featured && typeof featured === "object" && "url" in featured
      ? String((featured as { url?: string }).url ?? "")
      : "";

  const cleanShare = shareUrl?.trim() || undefined;

  return {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.title,
    description: article.excerpt || undefined,
    ...(imageUrl ? { image: imageUrl } : {}),
    datePublished,
    dateModified,
    ...(cleanShare
      ? {
          url: cleanShare,
          mainEntityOfPage: {
            "@type": "WebPage" as const,
            "@id": cleanShare,
          },
        }
      : {}),
    author: {
      "@type": "Person",
      name: article.author?.name || "Unknown Author",
      ...(authorProfileUrl ? { url: authorProfileUrl } : {}),
    },
    publisher: {
      "@type": "Organization",
      name: "ARASVARA",
      logo: {
        "@type": "ImageObject",
        url: PUBLISHER_LOGO,
      },
    },
  };
}
