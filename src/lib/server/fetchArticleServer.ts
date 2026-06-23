import { cookies } from "next/headers";
import { cache } from "react";
import { canViewArticleDetail } from "@/lib/articleViewAccess";
import { getServerApiSecret } from "@/lib/api-secret";
import {
  getAccessTokenFromCookieStore,
  getUserFromToken,
} from "@/lib/auth";
import {
  ACCESS_TOKEN_COOKIE,
  LEGACY_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from "@/lib/auth-config";
import {
  getArticleCacheTag,
  getArticleCacheTagFromPublicPath,
  getArticleRevalidateSeconds,
} from "@/lib/cache/article-cache-config";
import { getServerApiBaseUrl } from "@/lib/server/server-api";
import { Article, ArticleListResponse } from "@/types/article";

export type ArticleDetailFetchResult = {
  article: Article;
  related: ArticleListResponse[];
  totalPages?: number;
};

export { getArticleRevalidateSeconds, getArticleCacheTag, getArticleCacheTagFromPublicPath };

async function fetchArticleDetailByPathFromApi(
  publicPath: string,
  options: { revalidate?: boolean },
): Promise<ArticleDetailFetchResult | null> {
  const encoded = encodeURIComponent(publicPath);
  const baseUrl = getServerApiBaseUrl();
  const url = `${baseUrl}/articles/by-path?publicPath=${encoded}`;

  const headers: Record<string, string> = {};
  const secret = getServerApiSecret();
  if (secret) {
    headers["x-api-secret"] = secret;
  }

  const res = await fetch(
    url,
    options.revalidate
      ? {
          headers,
          next: {
            revalidate: getArticleRevalidateSeconds(),
            tags: [getArticleCacheTagFromPublicPath(publicPath)],
          },
        }
      : {
          headers,
          cache: "no-store",
        },
  );

  if (res.status === 404) {
    return null;
  }

  if (!res.ok) {
    throw new Error(
      `Fetch artikel gagal untuk "${url}": ${res.status} ${res.statusText}`,
    );
  }

  const data = (await res.json()) as {
    article?: Article;
    related?: ArticleListResponse[];
    totalPages?: number;
  };

  if (!data?.article) {
    return null;
  }

  return {
    article: data.article,
    related: data.related ?? [],
    totalPages: data.totalPages,
  };
}

/**
 * Fetch artikel PUBLISHED structured by exact publicPath (ISR).
 */
export const fetchPublishedArticleByPath = cache(
  async (publicPath: string): Promise<ArticleDetailFetchResult | null> => {
    const data = await fetchArticleDetailByPathFromApi(publicPath, {
      revalidate: true,
    });

    if (!data?.article || data.article.status !== "PUBLISHED") {
      return null;
    }

    return data;
  },
);

async function buildAuthCookieHeader(): Promise<string | null> {
  const cookieStore = await cookies();
  const parts: string[] = [];

  for (const name of [
    ACCESS_TOKEN_COOKIE,
    LEGACY_TOKEN_COOKIE,
    REFRESH_TOKEN_COOKIE,
  ]) {
    const value = cookieStore.get(name)?.value;
    if (value) {
      parts.push(`${name}=${value}`);
    }
  }

  return parts.length > 0 ? parts.join("; ") : null;
}

async function fetchArticleDetailFromApi(
  slug: string,
  options: { cookieHeader?: string; revalidate?: boolean },
): Promise<ArticleDetailFetchResult | null> {
  const encoded = encodeURIComponent(slug);
  const baseUrl = getServerApiBaseUrl();
  const url = `${baseUrl}/articles/${encoded}`;

  const headers: Record<string, string> = {};
  const secret = getServerApiSecret();
  if (secret) {
    headers["x-api-secret"] = secret;
  }
  if (options.cookieHeader) {
    headers.Cookie = options.cookieHeader;
  }

  const res = await fetch(
    url,
    options.revalidate
      ? {
          headers,
          next: {
            revalidate: getArticleRevalidateSeconds(),
            tags: [getArticleCacheTag(slug)],
          },
        }
      : {
          headers,
          cache: "no-store",
        },
  );

  if (res.status === 404) {
    return null;
  }

  if (!res.ok) {
    throw new Error(
      `Fetch artikel gagal untuk "${url}": ${res.status} ${res.statusText}`,
    );
  }

  const data = (await res.json()) as {
    article?: Article;
    related?: ArticleListResponse[];
    totalPages?: number;
  };

  if (!data?.article) {
    return null;
  }

  return {
    article: data.article,
    related: data.related ?? [],
    totalPages: data.totalPages,
  };
}

/**
 * Fetch artikel PUBLISHED untuk halaman publik dengan ISR + dedupe React cache().
 * Tidak meneruskan cookie — hanya artikel yang sudah dipublikasikan.
 */
export const fetchPublishedArticleBySlug = cache(
  async (slug: string): Promise<ArticleDetailFetchResult | null> => {
    const data = await fetchArticleDetailFromApi(slug, {
      revalidate: true,
    });

    if (!data?.article || data.article.status !== "PUBLISHED") {
      return null;
    }

    return data;
  },
);

/**
 * Fetch artikel non-published untuk staf CMS yang login (tanpa ISR).
 * Mengandalkan otorisasi yang sama dengan API /articles/[idOrSlug].
 */
export const fetchStaffArticleBySlug = cache(
  async (slug: string): Promise<ArticleDetailFetchResult | null> => {
    const token = await getAccessTokenFromCookieStore();
    if (!token) {
      return null;
    }

    const user = await getUserFromToken(token);
    if (!user) {
      return null;
    }

    const cookieHeader = await buildAuthCookieHeader();
    if (!cookieHeader) {
      return null;
    }

    const data = await fetchArticleDetailFromApi(slug, {
      cookieHeader,
    });

    if (!data?.article) {
      return null;
    }

    // Slug route hanya untuk preview staf non-PUBLISHED — PUBLISHED → 404
    if (data.article.status === "PUBLISHED") {
      return null;
    }

    if (!canViewArticleDetail(user, data.article)) {
      return null;
    }

    return data;
  },
);

/**
 * Fetch artikel untuk halaman /news/{slug} (preview staf CMS saja).
 * Artikel PUBLISHED tidak dilayani — gunakan structured publicPath.
 */
export async function fetchArticleBySlugForNewsPage(
  slug: string,
): Promise<ArticleDetailFetchResult | null> {
  return fetchStaffArticleBySlug(slug);
}
