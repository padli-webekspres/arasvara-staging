import { useInfiniteQuery } from "@tanstack/react-query";
import { fetcher } from "@/lib/fetcher";
import { Article } from "@/types/article";

interface UseLatestArticlesOptions {
  limit?: number;
  enabled?: boolean;
}

export function useLatestArticles({
  limit = 9,
  enabled = true,
}: UseLatestArticlesOptions = {}) {
  return useInfiniteQuery<
    { articles: Article[]; nextCursor: string | null },
    Error
  >({
    queryKey: ["latest", limit],
    queryFn: (context) => {
      const cursor =
        typeof context.pageParam === "string" ? context.pageParam : "";
      // Menambahkan status=PUBLISHED agar artikel yang berstatus TAKEN_DOWN atau draf tidak ikut terambil di publik
      return fetcher<{ articles: Article[]; nextCursor: string | null }>(
        `/articles?limit=${limit}&status=PUBLISHED${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
      );
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: "",
    enabled,
  });
}
