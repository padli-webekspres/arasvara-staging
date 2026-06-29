"use client";

import React, { useEffect } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { trackAuthorProfileView } from "@/lib/ga-events";
import LoadingOverlay from "@/components/loading/LoadingOverlay";
import NewsCard from "@/components/news/NewsCard";
import ArticleFeaturedHero from "@/components/news/ArticleFeaturedHero";
import { fetcher } from "@/lib/fetcher";
import { ArticleListResponse } from "@/types/article";
import { ArticleSearchResult } from "@/types/search";
import LoadMoreButton from "@/components/ui/LoadMoreButton";
import UserAvatar from "@/components/users/AvatarUser";
import { User } from "@/types/user";
import {
  AUTHOR_PAGE_INITIAL_LIMIT,
  AUTHOR_PAGE_LOAD_MORE_LIMIT,
} from "@/lib/author-public-path";


function buildAuthorArticlesSearchUrl(
  authorId: string,
  offset: number,
): string {
  const limit =
    offset === 0 ? AUTHOR_PAGE_INITIAL_LIMIT : AUTHOR_PAGE_LOAD_MORE_LIMIT;
  const params = new URLSearchParams({
    type: "ARTICLES",
    authorId,
    status: "published",
    limit: String(limit),
    page: "1",
  });

  if (offset > 0) {
    params.set("skip", String(offset));
  }

  return `/search?${params.toString()}`;
}

interface AuthorClientProps {
  authorId: string;
  authorSlug: string;
  authorName: string;
  authorAvatar?: User["avatar"];
  initialArticleCount?: number;
}

export default function AuthorClient({
  authorId,
  authorSlug,
  authorName,
  authorAvatar,
  initialArticleCount,
}: AuthorClientProps) {

  useEffect(() => {
    trackAuthorProfileView({
      author_id: authorId,
      author_slug: authorSlug,
      author_name: authorName,
    });
  }, []);

  const { data, isLoading, isFetching, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery<ArticleSearchResult, Error>({
      queryKey: ["author-articles", authorSlug],
      queryFn: ({ pageParam }) =>
        fetcher<ArticleSearchResult>(
          buildAuthorArticlesSearchUrl(
            authorId,
            typeof pageParam === "number" ? pageParam : 0,
          ),
        ),
      getNextPageParam: (lastPage, allPages) => {
        const loadedCount = allPages.reduce(
          (sum, page) => sum + page.data.length,
          0,
        );
        return loadedCount < lastPage.meta.total ? loadedCount : undefined;
      },
      enabled: !!authorId,
      initialPageParam: 0,
    });

  const articles: ArticleListResponse[] =
    data?.pages?.flatMap((page) => page.data) ?? [];

  const showInitialLoading =
    isLoading && articles.length === 0 && initialArticleCount === undefined;

  const SkeletonCard = () => (
    <div className="animate-pulse bg-muted rounded-lg h-48" />
  );

  if (showInitialLoading) {
    return <LoadingOverlay />;
  }

  const hasArticles =
    articles.length > 0 ||
    (initialArticleCount !== undefined && initialArticleCount > 0);

  return (
    <main className="pt-48 pb-8">
      <div className="container mx-auto px-4">
        <div className="text-center mb-4 md:mb-8 py-4">
          <UserAvatar
            avatar={authorAvatar}
            name={authorName}
            className="mx-auto mb-4 md:mb-8 size-24"
            fallbackClassName="text-3xl"
          />
          <h1 className="font-sans uppercase text-4xl md:text-5xl font-bold mb-4 animate-fade-in">
            {authorName}
          </h1>
        </div>

        {!hasArticles && !isFetching ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              Belum ada artikel yang dipublikasikan oleh penulis ini.
            </p>
          </div>
        ) : articles.length === 0 && isFetching ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-y-4 gap-x-8">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : (
          <>
            <ArticleFeaturedHero articles={articles} />

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-y-4 gap-x-8">
              {articles.slice(2).map((article) => (
                <NewsCard key={article.slug} article={article} />
              ))}
              {isFetchingNextPage &&
                Array.from({ length: 4 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
            </div>

            {hasNextPage && (
              <LoadMoreButton
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                variant="hijauSawah"
                wrapperClassName="text-center mt-12"
              />
            )}
          </>
        )}
      </div>
    </main>
  );
}
