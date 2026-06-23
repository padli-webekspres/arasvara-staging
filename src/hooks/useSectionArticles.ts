import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { SectionArticleItem } from "@/types/articleSection";
import { fetcher } from "@/lib/fetcher";

/**
 * Custom hook to fetch popular articles from API
 * Returns: { data, isLoading, isError }
 */
export function usePopularArticles() {
  return useQuery<SectionArticleItem[]>({
    queryKey: ["popular-articles-carousel"],
    queryFn: async () => {
      const res = await fetcher<{ data: SectionArticleItem[] }>(
        "/articles/popular",
      );
      return res.data;
    },
    staleTime: 1000 * 60 * 5, // 5 menit cache
    retry: 1,
  });
}

export function useHeadlineArticles() {
  return useQuery<SectionArticleItem[]>({
    queryKey: ["headline-articles-carousel"],
    queryFn: async () => {
      const res = await fetcher<{ data: SectionArticleItem[] }>(
        "/articles/headline",
      );
      return res.data;
    },
    staleTime: 1000 * 60 * 5, // 5 menit cache
    retry: 1,
  });
}
