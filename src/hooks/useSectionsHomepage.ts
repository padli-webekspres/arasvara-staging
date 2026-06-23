import { useQuery } from "@tanstack/react-query";
import { fetcher } from "@/lib/fetcher";
import { SectionArticleItem } from "@/types/articleSection";
import { Article } from "@/types/article";
import { FeaturedCategoryWithArticles } from "@/types/category";
import { useConfiguration } from "@/hooks/useConfiguration";

const DEFAULT_GRID_SECTION_CATEGORY_SLUG = "lifestyle";

/**
 * Custom hook to fetch carousel section from API
 * Returns: { data, isLoading, error }
 */
export function useCarouselSection() {
  return useQuery<SectionArticleItem[]>({
    queryKey: ["carousel-section"],
    queryFn: async () => {
      const res = await fetcher<{ data: SectionArticleItem[] }>(
        "/articles/carousel-section",
      );
      return res.data;
    },
    staleTime: 1000 * 60 * 10, // 10 menit cache
    retry: 1,
  });
}

/**
 * Custom hook to fetch grid section (lifestyle articles) from API
 * Returns: { data, isLoading, error }
 */
export function useGridSection() {
  const { getStringValue } = useConfiguration();
  const categorySlug =
    getStringValue(
      "grid_section_category_slug",
      DEFAULT_GRID_SECTION_CATEGORY_SLUG,
    ).trim() || DEFAULT_GRID_SECTION_CATEGORY_SLUG;

  return useQuery<SectionArticleItem[]>({
    queryKey: ["grid-section", categorySlug],
    queryFn: async () => {
      const res = await fetcher<{ articles: Article[] }>(
        `/articles?limit=4&category=${encodeURIComponent(categorySlug)}&status=PUBLISHED`,
      );
      return (res.articles || []).map((article, idx) => ({
        _id: article._id || String(idx),
        article_id: article._id || "",
        article: article,
        order: idx,
        createdAt: article.createdAt ? new Date(article.createdAt) : new Date(),
        createdBy: article.authorId || "",
      }));
    },
    staleTime: 1000 * 60 * 10, // 10 menit cache
    retry: 1,
  });
}

/**
 * Custom hook to fetch featured categories and their latest 4 articles from API
 * Returns: { data, isLoading, error }
 */
export function useFeaturedCategoriesSection() {
  return useQuery<FeaturedCategoryWithArticles[]>({
    queryKey: ["featured-categories-section"],
    queryFn: async () => {
      return fetcher<FeaturedCategoryWithArticles[]>("/categories/featured");
    },
    staleTime: 1000 * 60 * 10, // 10 menit cache
    retry: 1,
  });
}
