"use client";

import { useParams } from "next/navigation";
import { useInfiniteQuery } from "@tanstack/react-query";
import { CATEGORIES } from "@/lib/constants";
import ArticleFeaturedHero from "@/components/news/ArticleFeaturedHero";
import NewsCard from "@/components/news/NewsCard";
import { fetcher } from "@/lib/fetcher";
import { Article, ArticleListPage } from "@/types/article";
import React from "react";
import LoadMoreButton from "@/components/ui/LoadMoreButton";

interface CategoryClientProps {
  initialCategory?: { slug: string; name: string } | null;
}

export default function CategoryClient({ initialCategory }: CategoryClientProps) {
  const params = useParams();
  const categorySlug =
    (typeof params?.category === "string" ? params.category : "") ||
    initialCategory?.slug ||
    "";
  const category =
    initialCategory || CATEGORIES.find((c) => c.slug === categorySlug);
  const categoryTitle =
    category?.name || (categorySlug ? categorySlug.toUpperCase() : "");

  // Infinite Query for articles by category
  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<
    ArticleListPage<Article>,
    Error
  >({
    queryKey: ["category-articles", categorySlug],
    queryFn: (context) => {
      const pageParam =
        typeof context.pageParam === "string" ? context.pageParam : "";
      const searchParams = new URLSearchParams({
        category: categorySlug,
        limit: "10",
        status: "PUBLISHED",
      });
      if (pageParam) searchParams.set("cursor", pageParam);
      return fetcher<ArticleListPage<Article>>(
        `/articles?${searchParams.toString()}`,
      );
    },
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? (lastPage.nextCursor ?? undefined) : undefined,
    enabled: !!categorySlug,
    initialPageParam: "",
  });

  // Flatten all articles
  const articles: Article[] =
    data?.pages?.flatMap((page) => page.articles) || [];
  const hasMore = hasNextPage;
  const loading = isLoading;
  const loadingMore = isFetchingNextPage;

  // Skeleton loader for grid
  const SkeletonCard = () => (
    <div className="animate-pulse bg-muted rounded-lg h-48" />
  );

  return (
    <main className="pt-48 pb-8">
      <div className="container mx-auto w-full min-w-0 px-4 md:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-4 md:mb-8">
          <h1 className="font-sans uppercase text-4xl md:text-5xl font-bold mb-4 animate-fade-in">
            {categoryTitle}
          </h1>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-y-4 gap-x-8 py-8">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : articles.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              No articles found in this category.
            </p>
          </div>
        ) : (
          <>
            <ArticleFeaturedHero
              articles={articles}
              gaClickLocation="category_listing"
            />

            {/* Article Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-y-4 gap-x-8">
              {articles.slice(2).map((article, index) => (
                <NewsCard
                  key={article.slug}
                  article={article}
                  gaClickLocation="category_listing"
                  gaPosition={index + 3}
                />
              ))}
              {loadingMore &&
                Array.from({ length: 4 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
            </div>

            {hasMore && (
              <LoadMoreButton
                onClick={() => fetchNextPage()}
                disabled={loadingMore}
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
