import type { Article } from "@/types/article";
import {
  resolveArticleDateModified,
  toIsoStringOrNull,
} from "@/lib/datetime-jakarta";
import { resolveAuthorPublicHref } from "@/lib/author-public-path";
import { buildAbsoluteUrl, getSiteBaseUrl, SITE_LOGO } from "@/lib/og-image";

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
      width?: number;
      height?: number;
    };
  };
  // NEW FIELDS
  articleBody?: string;
  articleSection?: string;
  wordCount?: number;
  inLanguage?: string;
  isAccessibleForFree?: boolean;
  keywords?: string[];
};

/**
 * Strip HTML tags and normalize whitespace for plain text extraction.
 * Reused pattern from google-analytics.ts:224-226.
 */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Count words in plain text.
 * Reused pattern from google-analytics.ts:228-232.
 */
function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

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

  // NEW: Extract 6 additional fields
  const content = article.content?.trim() || "";
  const plainTextBody = content ? stripHtml(content) : undefined;
  const wordCount = plainTextBody ? countWords(plainTextBody) : undefined;
  const categoryName = article.category?.name?.trim() || undefined;
  const keywords = article.tags
    ?.map((t) => (typeof t === "string" ? t : t?.name))
    .filter(Boolean) as string[] | undefined;

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
        url: buildAbsoluteUrl(SITE_LOGO.path, getSiteBaseUrl()),
        width: SITE_LOGO.width,
        height: SITE_LOGO.height,
      },
    },
    // NEW: Add 6 fields conditionally
    ...(plainTextBody ? { articleBody: plainTextBody } : {}),
    ...(categoryName ? { articleSection: categoryName } : {}),
    ...(wordCount ? { wordCount } : {}),
    inLanguage: "id-ID",
    isAccessibleForFree: true,
    ...(keywords && keywords.length > 0 ? { keywords } : {}),
  };
}
