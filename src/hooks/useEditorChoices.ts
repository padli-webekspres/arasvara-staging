import { useQuery } from "@tanstack/react-query";
import { fetcher } from "@/lib/fetcher";
import { SectionArticleItem } from "@/types/articleSection";

/**
 * Custom hook to fetch editor choices from API
 * Returns: { data, isLoading, error }
 */
export function useEditorChoices() {
  return useQuery<SectionArticleItem[]>({
    queryKey: ["editor-choices"],
    queryFn: async () => {
      const res = await fetcher<{ data: SectionArticleItem[] }>(
        "/articles/editor-choice",
      );
      return res.data;
    },
    staleTime: 1000 * 60 * 10, // 10 menit cache
    retry: 1,
  });
}
