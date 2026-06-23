"use client";

import React from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import LoadingOverlay from "@/components/loading/LoadingOverlay";
import NewsCard from "@/components/news/NewsCard";
import ArticleFeaturedHero from "@/components/news/ArticleFeaturedHero";
import { fetcher } from "@/lib/fetcher";
import { ArticleListResponse } from "@/types/article";
import { ArticleSearchResult } from "@/types/search";
import LoadMoreButton from "@/components/ui/LoadMoreButton";

interface AuthorClientProps {
  authorId: string;
  authorName: string;
}

const PAGE_LIMIT = 10;

export default function AuthorClient({
  authorId,
  authorName,
}: AuthorClientProps) {
  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<ArticleSearchResult, Error>({
    queryKey: ["author-articles", authorId],
    queryFn: ({ pageParam = 1 }) =>
      fetcher<ArticleSearchResult>(
        `/search?type=ARTICLES&authorId=${encodeURIComponent(authorId)}&status=published&limit=${PAGE_LIMIT}&page=${pageParam}`,
      ),
    getNextPageParam: (lastPage) =>
      lastPage.meta.hasNextPage ? lastPage.meta.page + 1 : undefined,
    enabled: !!authorId,
    initialPageParam: 1,
  });

  const articles: ArticleListResponse[] =
    data?.pages?.flatMap((page) => page.data) ?? [];

  const SkeletonCard = () => (
    <div className="animate-pulse bg-muted rounded-lg h-48" />
  );

  if (isLoading) {
    return <LoadingOverlay />;
  }

  return (
    <main className="pt-48 pb-8">
      <div className="container mx-auto px-4">
        <div className="text-center mb-4 md:mb-8">
          <h1 className="font-serif uppercase text-4xl md:text-5xl font-bold mb-4 animate-fade-in">
            {authorName}
          </h1>
        </div>

        {articles.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              Belum ada artikel yang dipublikasikan oleh penulis ini.
            </p>
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
