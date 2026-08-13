"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import api from "@/lib/axios";
import {
  ArticleListPage,
  ArticleListResponse,
} from "@/types/article";
import { SectionArticleItem } from "@/types/articleSection";
import { useDebounce } from "@/hooks/use-debounce";

const PAGE_LIMIT = 7;
const MAX_EXCLUDED_IDS = 100;

type SearchStatus = "idle" | "loading" | "loadingMore" | "error";

interface UseSectionArticleSearchOptions {
  enabled?: boolean;
  resetKey?: string;
}

function mergeUniqueArticles(
  current: ArticleListResponse[],
  incoming: ArticleListResponse[],
): ArticleListResponse[] {
  const byId = new Map<string, ArticleListResponse>();
  for (const article of [...current, ...incoming]) {
    if (article._id) byId.set(article._id, article);
  }
  return [...byId.values()];
}

/**
 * Search + infinite scroll untuk panel "Cari & Tambahkan Artikel" di SelectAndSort.
 * Filter artikel terpilih via ref agar list tidak di-reset saat add/remove.
 */
export function useSectionArticleSearch(
  selectedArticles: SectionArticleItem[],
  {
    enabled = true,
    resetKey = "",
  }: UseSectionArticleSearchOptions = {},
) {
  const selectedIdsRef = useRef<Set<string>>(new Set());
  const requestIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const inFlightRef = useRef(false);
  const hasMoreRef = useRef(true);
  const nextCursorRef = useRef<string | null>(null);
  const seenCursorsRef = useRef<Set<string>>(new Set());

  const [availableArticles, setAvailableArticles] = useState<
    ArticleListResponse[]
  >([]);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 500);
  const [status, setStatus] = useState<SearchStatus>("idle");
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    selectedIdsRef.current = new Set(
      selectedArticles.flatMap((item) => [
        item.article_id,
        item.article?._id,
      ])
        .filter((id): id is string => Boolean(id)),
    );

    setAvailableArticles((prev) =>
      prev.filter(
        (article) =>
          article._id && !selectedIdsRef.current.has(article._id),
      ),
    );
  }, [selectedArticles]);

  const filterAvailable = useCallback((articles: ArticleListResponse[]) => {
    return articles.filter(
      (article) =>
        article._id && !selectedIdsRef.current.has(article._id),
    );
  }, []);

  const fetchPage = useCallback(
    async (
      searchTerm: string,
      mode: "replace" | "append",
      cursor?: string,
    ) => {
      if (inFlightRef.current) return;

      inFlightRef.current = true;
      const requestId = ++requestIdRef.current;
      const controller = new AbortController();
      abortControllerRef.current = controller;
      setStatus(mode === "replace" ? "loading" : "loadingMore");

      try {
        const selectedIds = [...selectedIdsRef.current].slice(
          0,
          MAX_EXCLUDED_IDS,
        );
        const params: Record<string, string | number> = {
          limit: PAGE_LIMIT,
          status: "PUBLISHED",
        };
        if (searchTerm.trim()) params.search = searchTerm.trim();
        if (cursor) params.cursor = cursor;
        if (selectedIds.length > 0) params.excludeIds = selectedIds.join(",");

        const response = await api.get<
          ArticleListPage<ArticleListResponse>
        >("/articles", {
          params,
          signal: controller.signal,
        });

        if (requestId !== requestIdRef.current) return;

        const filteredArticles = filterAvailable(response.data.articles ?? []);
        setAvailableArticles((current) =>
          mode === "replace"
            ? mergeUniqueArticles([], filteredArticles)
            : mergeUniqueArticles(current, filteredArticles),
        );

        const nextCursor = response.data.nextCursor;
        const repeatedCursor =
          !!nextCursor && seenCursorsRef.current.has(nextCursor);
        if (nextCursor) seenCursorsRef.current.add(nextCursor);

        const canContinue =
          response.data.hasMore === true &&
          !!nextCursor &&
          !repeatedCursor;
        nextCursorRef.current = canContinue ? nextCursor : null;
        hasMoreRef.current = canContinue;
        setHasMore(canContinue);
        setStatus("idle");

        if (repeatedCursor) {
          console.error("Pagination artikel dihentikan: cursor berulang");
        }
        if (filteredArticles.length === 0 && mode === "replace") {
          toast.info("Tidak ada artikel yang ditemukan");
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error("Error fetching articles:", error);
        toast.error("Gagal memuat artikel");
        setStatus("error");
      } finally {
        if (requestId === requestIdRef.current) {
          inFlightRef.current = false;
          abortControllerRef.current = null;
        }
      }
    },
    [filterAvailable],
  );

  useEffect(() => {
    abortControllerRef.current?.abort();
    requestIdRef.current += 1;
    inFlightRef.current = false;
    nextCursorRef.current = null;
    hasMoreRef.current = true;
    seenCursorsRef.current.clear();
    setAvailableArticles([]);
    setHasMore(true);
    setStatus("idle");

    if (!enabled) return;
    void fetchPage(debouncedSearch, "replace");

    return () => {
      abortControllerRef.current?.abort();
    };
  }, [debouncedSearch, enabled, fetchPage, resetKey]);

  const handleLoadMore = useCallback(() => {
    const cursor = nextCursorRef.current;
    if (inFlightRef.current || !hasMoreRef.current || !cursor) return;
    void fetchPage(debouncedSearch, "append", cursor);
  }, [debouncedSearch, fetchPage]);

  const excludeFromAvailable = useCallback((articleId: string) => {
    setAvailableArticles((prev) => prev.filter((a) => a._id !== articleId));
  }, []);

  const prependToAvailable = useCallback((article: ArticleListResponse) => {
    if (!article._id || selectedIdsRef.current.has(article._id)) return;

    setAvailableArticles((prev) => {
      if (prev.some((a) => a._id === article._id)) return prev;
      return [article, ...prev];
    });
  }, []);

  return {
    availableArticles,
    searchQuery,
    setSearchQuery,
    loading: status === "loading" || status === "loadingMore",
    loadingMore: status === "loadingMore",
    error: status === "error",
    hasMore,
    handleLoadMore,
    excludeFromAvailable,
    prependToAvailable,
  };
}
