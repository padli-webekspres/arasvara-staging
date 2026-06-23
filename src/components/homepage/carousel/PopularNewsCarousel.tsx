"use client";

import React from "react";
import { usePopularArticles } from "@/hooks/useSectionArticles";
import { ArticleListResponse } from "@/types/article";
import NewsCarouselUi from "./NewsCarouselUi";
import { useHomepageAdsGrouped } from "@/hooks/useAds";

/**
 * Komponen PopularNewsCarousel
 *
 * Menampilkan carousel artikel pilihan editor dengan responsive layout.
 * - View per slide: 2 item (xs), 2-3 item (sm-md), 3-4 item (lg-xl)
 * - Setiap item menggunakan SecondaryNewsCard untuk tampilan konsisten
 * - Navigasi dan scrollbar untuk kemudahan penggunaan
 * - Support free mode, touch, mouse drag, dan shift+scroll
 */

interface PopularNewsCarouselProps {
  showAds?: boolean;
}

const PopularNewsCarousel: React.FC<PopularNewsCarouselProps> = ({
  showAds = true,
}) => {
  const { data: popularArticles, isLoading, error } = usePopularArticles();
  const articles: ArticleListResponse[] =
    popularArticles
      ?.map((popular) => popular.article)
      .filter((a): a is ArticleListResponse => Boolean(a)) ?? [];

  const { isLoading: isLoadingAds, popularAds } = useHomepageAdsGrouped();

  return (
    <NewsCarouselUi
      articles={articles}
      isLoading={isLoading}
      maxSlidesPerView={4}
      error={error == null && false}
      emptyText="Belum ada Berita Populer"
      loadingText="Memuat..."
      errorText="Gagal memuat Berita Populer"
      ads={showAds ? popularAds : undefined}
    />
  );
};

export default PopularNewsCarousel;
