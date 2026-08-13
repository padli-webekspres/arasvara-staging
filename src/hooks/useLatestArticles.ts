import { useInfiniteQuery } from "@tanstack/react-query";
import { fetcher } from "@/lib/fetcher";
import { Article, ArticleListPage } from "@/types/article";

interface UseLatestArticlesOptions {
  limit?: number;
  enabled?: boolean;
}

export function useLatestArticles({
  limit = 9,
  enabled = true,
}: UseLatestArticlesOptions = {}) {
  return useInfiniteQuery<
    ArticleListPage<Article>,
    Error
  >({
    queryKey: ["latest", limit],
    queryFn: (context) => {
      const cursor =
        typeof context.pageParam === "string" ? context.pageParam : "";
      const searchParams = new URLSearchParams({
        limit: String(limit),
        status: "PUBLISHED",
      });
      if (cursor) searchParams.set("cursor", cursor);
      return fetcher<ArticleListPage<Article>>(
        `/articles?${searchParams.toString()}`,
      );
    },
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? (lastPage.nextCursor ?? undefined) : undefined,
    initialPageParam: "",
    enabled,
  });
}
