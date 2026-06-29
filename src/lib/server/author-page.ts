import type { Metadata } from "next";
import type { Db } from "mongodb";
import {
  AUTHOR_PAGE_INITIAL_LIMIT,
  buildAuthorPublicPath,
} from "@/lib/author-public-path";
import { buildArticleUrl } from "@/lib/utils";
import { resolveUserAvatarUrl } from "@/lib/user-avatar";
import {
  buildAbsoluteUrl,
  buildSiteOpenGraphImages,
  buildSiteTwitterImages,
  getSiteBaseUrl,
} from "@/lib/og-image";
import { searchArticles } from "@/services/searchService";
import type { ArticleListResponse } from "@/types/article";
import type { ArticleSearchResult } from "@/types/search";
import type { User } from "@/types/user";

export function buildAuthorCanonicalUrl(authorSlug: string): string {
  const path = buildAuthorPublicPath(authorSlug);
  return buildAbsoluteUrl(path, getSiteBaseUrl());
}

export async function fetchAuthorArticlesPage(
  db: Db,
  authorId: string,
  page = 1,
  limit = AUTHOR_PAGE_INITIAL_LIMIT,
): Promise<ArticleSearchResult> {
  return searchArticles(db, {
    authorId,
    status: "published",
    sortBy: "date",
    sortOrder: "desc",
    page,
    limit,
  });
}

function buildAuthorDescription(name: string, totalArticles: number): string {
  if (totalArticles > 0) {
    return `${name} adalah penulis di Arasvara. Baca ${totalArticles} artikel terbaru oleh ${name}, portal berita digital Indonesia.`;
  }
  return `${name} adalah penulis di Arasvara. Portal berita digital Indonesia untuk generasi Milenial dan Gen Z.`;
}

function buildAuthorKeywords(name: string): string[] {
  const normalized = name.trim();
  return Array.from(
    new Set([
      normalized,
      `${normalized} arasvara`,
      `penulis ${normalized}`,
      "arasvara",
      "penulis arasvara",
      "jurnalis arasvara",
      "portal berita indonesia",
    ]),
  ).filter(Boolean);
}

function buildAuthorOpenGraphImages(
  avatar: User["avatar"],
  alt: string,
  baseUrl: string,
): NonNullable<Metadata["openGraph"]>["images"] {
  const avatarUrl = resolveUserAvatarUrl(avatar);
  if (!avatarUrl) {
    return buildSiteOpenGraphImages(baseUrl);
  }

  const absoluteUrl = avatarUrl.startsWith("http")
    ? avatarUrl
    : buildAbsoluteUrl(avatarUrl, baseUrl);

  return [
    {
      url: absoluteUrl,
      secureUrl: absoluteUrl,
      alt,
    },
  ];
}

function buildAuthorTwitterImages(
  avatar: User["avatar"],
  baseUrl: string,
): NonNullable<Metadata["twitter"]>["images"] {
  const avatarUrl = resolveUserAvatarUrl(avatar);
  if (!avatarUrl) {
    return buildSiteTwitterImages(baseUrl);
  }

  return [
    avatarUrl.startsWith("http")
      ? avatarUrl
      : buildAbsoluteUrl(avatarUrl, baseUrl),
  ];
}

export function buildMetadataFromAuthor(
  user: User,
  articleMeta: { total: number },
  authorSlug: string,
): Metadata {
  const baseUrl = getSiteBaseUrl();
  const canonicalUrl = buildAuthorCanonicalUrl(authorSlug);
  const title = `${user.name} | Arasvara`;
  const description = buildAuthorDescription(user.name, articleMeta.total);
  const keywords = buildAuthorKeywords(user.name);
  const isIndexable = articleMeta.total > 0;

  return {
    title,
    description,
    keywords,
    alternates: {
      canonical: canonicalUrl,
    },
    robots: {
      index: isIndexable,
      follow: true,
      ...(isIndexable
        ? {
            googleBot: {
              index: true,
              follow: true,
              "max-snippet": -1,
              "max-image-preview": "large" as const,
              "max-video-preview": -1,
            },
          }
        : {}),
    },
    openGraph: {
      title,
      description,
      type: "profile",
      url: canonicalUrl,
      siteName: "Arasvara",
      locale: "id_ID",
      images: buildAuthorOpenGraphImages(user.avatar, user.name, baseUrl),
    },
    twitter: {
      card: "summary_large_image",
      site: "@arasvara",
      title,
      description,
      images: buildAuthorTwitterImages(user.avatar, baseUrl),
    },
  };
}

function resolveArticleAbsoluteUrl(article: ArticleListResponse): string | null {
  const path = article.publicPath?.trim();
  if (!path) return null;
  return buildArticleUrl(path);
}

export function buildAuthorJsonLd(
  user: User,
  articles: ArticleListResponse[],
  canonicalUrl: string,
) {
  const baseUrl = getSiteBaseUrl();
  const avatarUrl = resolveUserAvatarUrl(user.avatar);
  const image = avatarUrl
    ? avatarUrl.startsWith("http")
      ? avatarUrl
      : buildAbsoluteUrl(avatarUrl, baseUrl)
    : undefined;

  const articleUrls = articles
    .map(resolveArticleAbsoluteUrl)
    .filter((url): url is string => Boolean(url));

  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    url: canonicalUrl,
    name: user.name,
    inLanguage: "id",
    mainEntity: {
      "@type": "Person",
      name: user.name,
      url: canonicalUrl,
      ...(image ? { image } : {}),
      worksFor: {
        "@type": "Organization",
        name: "Arasvara",
        url: baseUrl,
      },
    },
    ...(articleUrls.length > 0
      ? {
          hasPart: {
            "@type": "ItemList",
            itemListElement: articleUrls.map((url, index) => ({
              "@type": "ListItem",
              position: index + 1,
              url,
            })),
          },
        }
      : {}),
  };
}
