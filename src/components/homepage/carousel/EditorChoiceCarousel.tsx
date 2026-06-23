"use client";

import React from "react";
import { useEditorChoices } from "@/hooks/useEditorChoices";
import { ArticleListResponse } from "@/types/article";
import NewsCarouselUi from "./NewsCarouselUi";
import { useHomepageAdsGrouped } from "@/hooks/useAds";

/**
 * Komponen EditorChoiceCarousel
 *
 * Menampilkan carousel artikel pilihan editor dengan responsive layout.
 * - View per slide: 2 item (xs), 2-3 item (sm-md), 3-4 item (lg-xl)
 * - Setiap item menggunakan SecondaryNewsCard untuk tampilan konsisten
 * - Navigasi dan scrollbar untuk kemudahan penggunaan
 * - Support free mode, touch, mouse drag, dan shift+scroll
 */

const EditorChoiceCarousel: React.FC = () => {
  const { data: editorChoices, isLoading, error } = useEditorChoices();
  const articles: ArticleListResponse[] =
    editorChoices
      ?.map((choice) => choice.article)
      .filter((a): a is ArticleListResponse => Boolean(a)) ?? [];

  const { isLoading: isLoadingAds, editorChoiceAds } = useHomepageAdsGrouped();
  return (
    <NewsCarouselUi
      ads={editorChoiceAds}
      articles={articles}
      isLoading={isLoading}
      error={error == null && false}
      emptyText="Belum ada Pilihan Editor"
      loadingText="Memuat..."
      errorText="Gagal memuat Pilihan Editor"
    />
  );
};

export default EditorChoiceCarousel;
