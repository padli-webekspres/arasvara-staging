"use client";

import { useParams } from "next/navigation";
import { useInfiniteQuery } from "@tanstack/react-query";
import LoadingOverlay from "@/components/loading/LoadingOverlay";
import { CATEGORIES } from "@/lib/constants";
import ArticleFeaturedHero from "@/components/news/ArticleFeaturedHero";
import NewsCard from "@/components/news/NewsCard";
import { fetcher } from "@/lib/fetcher";
import { Article } from "@/types/article";
import React from "react";
import LoadMoreButton from "@/components/ui/LoadMoreButton";

export default function CategoryClient() {
  const params = useParams();
  const categorySlug = params.category;
  const category = CATEGORIES.find((c) => c.slug === categorySlug);

  // Infinite Query for articles by category
  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
    error,
  } = useInfiniteQuery<
    { articles: Article[]; nextCursor: string | null },
    Error
  >({
    queryKey: ["category-articles", categorySlug],
    queryFn: (context) => {
      const pageParam =
        typeof context.pageParam === "string" ? context.pageParam : "";
      // Menambahkan status=PUBLISHED agar hanya mengambil artikel yang dipublikasikan pada halaman kategori publik
      return fetcher<{ articles: Article[]; nextCursor: string | null }>(
        `/articles?category=${categorySlug}&limit=10&status=PUBLISHED${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ""}`,
      );
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
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

  // Sederhanakan: jika loading, langsung return LoadingOverlay
  if (loading) {
    return <LoadingOverlay />;
  }

  return (
    <main className="pt-48 pb-8">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-4 md:mb-8">
          <h1 className="font-serif uppercase text-4xl md:text-5xl font-bold mb-4 animate-fade-in">
            {category?.name || categorySlug}
          </h1>
        </div>

        {articles.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              No articles found in this category.
            </p>
          </div>
        ) : (
          <>
            <ArticleFeaturedHero articles={articles} />

            {/* Article Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-y-4 gap-x-8">
              {articles.slice(2).map((article) => (
                <NewsCard key={article.slug} article={article} />
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
