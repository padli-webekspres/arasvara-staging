"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Loader2, Check } from "lucide-react";
import api from "@/lib/axios";
import type { ArticleSearchResult } from "@/types/search";

interface ArticleItem {
  _id: string;
  title: string;
  slug: string;
  excerpt?: string;
  publicPath?: string | null;
}

export interface ReadAlsoPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (article: ArticleItem) => void;
}

const PAGE_LIMIT = 10;

function mapRows(data: ArticleSearchResult["data"]): ArticleItem[] {
  return data.map((a) => ({
    _id: String(a._id ?? ""),
    title: a.title,
    slug: a.slug ?? "",
    excerpt: a.excerpt ?? "",
    publicPath: a.publicPath ?? null,
  }));
}

async function fetchSearchPage(
  page: number,
  q: string,
  signal?: AbortSignal,
): Promise<{ items: ArticleItem[]; meta: ArticleSearchResult["meta"] | null }> {
  const params = new URLSearchParams({
    type: "ARTICLES",
    limit: String(PAGE_LIMIT),
    sortBy: "date",
    sortOrder: "desc",
    status: "PUBLISHED",
    page: String(page),
  });
  const trimmed = q.trim();
  if (trimmed) params.set("q", trimmed);

  const { data } = await api.get<ArticleSearchResult | { success?: false }>(
    `/search?${params.toString()}`,
    { signal },
  );

  if (
    !data ||
    typeof data !== "object" ||
    !("success" in data) ||
    data.success !== true ||
    !Array.isArray((data as ArticleSearchResult).data)
  ) {
    return {
      items: [],
      meta: null,
    };
  }

  const ok = data as ArticleSearchResult;
  return { items: mapRows(ok.data), meta: ok.meta };
}

export function ReadAlsoPickerDialog({
  open,
  onOpenChange,
  onSelect,
}: ReadAlsoPickerDialogProps) {
  const [search, setSearch] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [articles, setArticles] = useState<ArticleItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRootRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Debounce input → query untuk fetch halaman 1 */
  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(search.trim());
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, open]);

  /** Reset saat dialog dibuka */
  useEffect(() => {
    if (!open) return;
    setSearch("");
    setDebouncedQuery("");
    setArticles([]);
    setPage(1);
    setHasNextPage(false);
    setLoadingMore(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  /** Fetch halaman pertama saat query berubah (termasuk kosong = terbaru) */
  useEffect(() => {
    if (!open) return;

    const controller = new AbortController();

    const run = async () => {
      setLoading(true);
      try {
        const { items, meta } = await fetchSearchPage(
          1,
          debouncedQuery,
          controller.signal,
        );
        if (controller.signal.aborted) return;
        setArticles(items);
        setPage(1);
        setHasNextPage(meta?.hasNextPage ?? false);
      } catch (e: unknown) {
        if (
          typeof e === "object" &&
          e !== null &&
          "code" in e &&
          (e as { code?: string }).code === "ERR_CANCELED"
        ) {
          return;
        }
        console.error("ReadAlsoPickerDialog fetch:", e);
        if (!controller.signal.aborted) {
          setArticles([]);
          setHasNextPage(false);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    void run();
    return () => controller.abort();
  }, [open, debouncedQuery]);

  const loadMore = useCallback(async () => {
    if (!open || !hasNextPage || loading || loadingMore) return;

    const nextPage = page + 1;
    setLoadingMore(true);
    try {
      const { items, meta } = await fetchSearchPage(nextPage, debouncedQuery);
      setArticles((prev) => {
        const seen = new Set(prev.map((a) => a._id));
        const merged = [...prev];
        for (const item of items) {
          if (item._id && !seen.has(item._id)) {
            seen.add(item._id);
            merged.push(item);
          }
        }
        return merged;
      });
      setPage(nextPage);
      setHasNextPage(meta?.hasNextPage ?? false);
    } catch (e) {
      console.error("ReadAlsoPickerDialog loadMore:", e);
    } finally {
      setLoadingMore(false);
    }
  }, [open, hasNextPage, loading, loadingMore, page, debouncedQuery]);

  /** Infinite scroll: pantau sentinel di dalam area scroll */
  useEffect(() => {
    if (!open || !hasNextPage || loading) return;

    const root = scrollRootRef.current;
    const sentinel = sentinelRef.current;
    if (!root || !sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const hit = entries.some((en) => en.isIntersecting);
        if (hit) void loadMore();
      },
      { root, rootMargin: "80px", threshold: 0 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [open, hasNextPage, loading, loadMore, articles.length]);

  const handleSelect = (article: ArticleItem) => {
    onSelect(article);
    onOpenChange(false);
  };

  const emptyMessage = loading
    ? null
    : articles.length === 0
      ? debouncedQuery
        ? "Tidak ada artikel ditemukan"
        : "Belum ada artikel publikasi"
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Sisipkan &quot;Baca Juga&quot;</DialogTitle>
          <DialogDescription>
            Cari dan pilih artikel yang ingin ditautkan (hanya yang sudah
            terbit, urut terbaru).
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            ref={inputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari judul artikel (kosongkan untuk daftar terbaru)..."
            className="pl-9"
            autoComplete="off"
          />
        </div>

        <div
          ref={scrollRootRef}
          className="flex-1 overflow-y-auto min-h-[200px] max-h-[400px] border border-border rounded-lg"
        >
          {loading && articles.length === 0 ? (
            <div className="flex items-center justify-center h-full min-h-[200px] py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">
                Memuat...
              </span>
            </div>
          ) : articles.length === 0 ? (
            <div className="flex items-center justify-center h-full min-h-[200px] py-12 px-4 text-center">
              <p className="text-sm text-muted-foreground">{emptyMessage}</p>
            </div>
          ) : (
            <>
              <ul className="divide-y divide-border">
                {articles.map((article) => (
                  <li
                    key={article._id}
                    className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {article.title}
                      </p>
                      {article.excerpt ? (
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                          {article.excerpt}
                        </p>
                      ) : null}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0 gap-1"
                      onClick={() => handleSelect(article)}
                    >
                      <Check className="h-3.5 w-3.5" />
                      Pilih
                    </Button>
                  </li>
                ))}
              </ul>

              <div className="flex flex-col items-center gap-2 py-3">
                {loadingMore ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                    Memuat lebih banyak...
                  </div>
                ) : null}
                <div
                  ref={sentinelRef}
                  className="h-1 w-full shrink-0"
                  aria-hidden
                />
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
