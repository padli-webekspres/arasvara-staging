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

/** Title tag halaman profil — format: Arasvara | Profil {nama} */
export function buildAuthorPageTitle(name: string): string {
  const trimmed = name.trim();
  return `Arasvara | Profil ${trimmed}`;
}

/** Nilai bio placeholder dari DB/CMS yang dianggap kosong. */
const EMPTY_BIO_PLACEHOLDERS = new Set([
  "",
  "-",
  "null",
  "undefined",
  "n/a",
  "na",
]);

function isMeaningfulBio(bio: string | undefined | null): bio is string {
  const trimmed = bio?.trim();
  if (!trimmed) return false;
  return !EMPTY_BIO_PLACEHOLDERS.has(trimmed.toLowerCase());
}

/** Teks bio untuk tampilan UI — pakai bio DB jika ada, else fallback generik. */
export function buildAuthorBioDisplay(
  bio: string | undefined | null,
  name: string,
): string {
  if (isMeaningfulBio(bio)) return bio.trim();

  const trimmedName = name.trim() || "Anggota tim";
  return `${trimmedName} adalah bagian dari tim editorial Arasvara, portal berita digital Indonesia untuk generasi Milenial dan Gen Z.`;
}

function truncateMetaDescription(text: string, maxLength = 175): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 3).trimEnd()}...`;
}

export async function fetchAuthorArticlesPage(
  db: Db,
  authorId: string,
  page = 1,
  limit = AUTHOR_PAGE_INITIAL_LIMIT,
): Promise<ArticleSearchResult> {
  return searchArticles(db, {
    authorId,
    includeEdited: true,
    status: "published",
    sortBy: "date",
    sortOrder: "desc",
    page,
    limit,
  });
}

function buildAuthorMetaDescription(
  user: User,
  articleMeta: { total: number },
): string {
  if (isMeaningfulBio(user.bio)) {
    return truncateMetaDescription(user.bio.trim());
  }
  return buildAuthorDescription(user.name, articleMeta.total);
}

function buildAuthorDescription(name: string, totalArticles: number): string {
  if (totalArticles > 0) {
    return `${name} adalah bagian dari tim editorial Arasvara. Baca ${totalArticles} artikel terbaru terkait ${name}, portal berita digital Indonesia.`;
  }
  return `${name} adalah bagian dari tim editorial Arasvara. Portal berita digital Indonesia untuk generasi Milenial dan Gen Z.`;
}

function buildAuthorKeywords(name: string): string[] {
  const normalized = name.trim();
  return Array.from(
    new Set([
      normalized,
      `${normalized} arasvara`,
      `tim editorial ${normalized}`,
      `profil ${normalized}`,
      "arasvara",
      "tim editorial arasvara",
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
  const title = buildAuthorPageTitle(user.name);
  const description = buildAuthorMetaDescription(user, articleMeta);
  const keywords = buildAuthorKeywords(user.name);

  return {
    title: {
      absolute: title,
    },
    description,
    keywords,
    alternates: {
      canonical: canonicalUrl,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-snippet": -1,
        "max-image-preview": "large" as const,
        "max-video-preview": -1,
      },
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

  const bioDescription = buildAuthorBioDisplay(user.bio, user.name);

  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    url: canonicalUrl,
    name: user.name,
    description: bioDescription,
    inLanguage: "id",
    mainEntity: {
      "@type": "Person",
      name: user.name,
      url: canonicalUrl,
      description: bioDescription,
      ...(image ? { image } : {}),
      ...(user.jobTitle ? { jobTitle: user.jobTitle } : {}),
      ...(user.coverageAreas?.length
        ? { knowsAbout: user.coverageAreas }
        : {}),
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
