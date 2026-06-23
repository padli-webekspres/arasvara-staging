"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Loader2, Plus, Check } from "lucide-react";
import useSWRInfinite from "swr/infinite";
import { SectionArticleItem } from "@/types/articleSection";
import { fetcher } from "@/lib/fetcher";
import { useDebounce } from "@/hooks/use-debounce";

interface RelatedArticleSearchModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectArticle: (article: any) => void;
  currentArticleId?: string; // Untuk mengecualikan artikel yang sedang diedit
  selectedArticleIds: string[]; // Untuk mengecek mana yang sudah terpilih
}

interface SearchArticlesResponse {
  success: boolean;
  data: any[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
  };
  error?: string;
}

export function RelatedArticleSearchModal({
  isOpen,
  onOpenChange,
  onSelectArticle,
  currentArticleId,
  selectedArticleIds,
}: RelatedArticleSearchModalProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 500);

  const getKey = (
    pageIndex: number,
    previousPageData: SearchArticlesResponse | null,
  ) => {
    if (previousPageData && previousPageData.error) return null;
    if (previousPageData && !previousPageData.data?.length) return null;
    if (previousPageData && !previousPageData.meta?.hasNextPage) return null;

    const pageNum = pageIndex + 1;
    let url = `/search?type=ARTICLES&status=PUBLISHED&limit=10&page=${pageNum}`;
    if (debouncedSearch) {
      url += `&q=${encodeURIComponent(debouncedSearch)}`;
    }
    return url;
  };

  const { data, size, setSize, isValidating, isLoading } =
    useSWRInfinite<SearchArticlesResponse>(getKey, fetcher);

  const articles = data ? data.flatMap((page) => page?.data || []) : [];
  const isEmpty = data?.[0]?.data?.length === 0;
  const isReachingEnd =
    isEmpty || (data && !data[data.length - 1]?.meta?.hasNextPage);

  const handleSelect = (article: any) => {
    onSelectArticle(article);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] h-[80vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-6 pb-2 border-b">
          <DialogTitle>Pilih Artikel Terkait</DialogTitle>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari berdasarkan judul..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : isEmpty ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Tidak ada artikel ditemukan.
            </div>
          ) : (
            articles.map((article) => {
              if (!article) return null;
              // Exclude the currently edited article
              if (currentArticleId && article._id === currentArticleId)
                return null;

              const isSelected = selectedArticleIds.includes(article._id);

              let thumbUrl = "";
              if (article.featuredImage) {
                if (typeof article.featuredImage === "string")
                  thumbUrl = article.featuredImage;
                else if (article.featuredImage.url)
                  thumbUrl = article.featuredImage.url;
              }

              return (
                <div
                  key={article._id}
                  className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                >
                  {/* Thumbnail */}
                  {thumbUrl ? (
                    <div className="h-12 w-16 flex-shrink-0 bg-muted rounded overflow-hidden">
                      <img
                        src={thumbUrl}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="h-12 w-16 flex-shrink-0 bg-muted rounded flex items-center justify-center">
                      <span className="text-xs text-muted-foreground">
                        No Img
                      </span>
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm line-clamp-1">
                      {article.title}
                    </h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(
                        article.publishedAt || article.createdAt,
                      ).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>

                  <Button
                    size="sm"
                    variant={isSelected ? "secondary" : "default"}
                    onClick={() => handleSelect(article)}
                    disabled={isSelected}
                    className="flex-shrink-0"
                  >
                    {isSelected ? (
                      <>
                        <Check className="h-4 w-4 mr-1" /> Terpilih
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-1" /> Tambah
                      </>
                    )}
                  </Button>
                </div>
              );
            })
          )}

          {!isLoading && !isReachingEnd && (
            <div className="flex justify-center pt-4 pb-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSize(size + 1)}
                disabled={isValidating}
              >
                {isValidating ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Muat Lebih Banyak
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
