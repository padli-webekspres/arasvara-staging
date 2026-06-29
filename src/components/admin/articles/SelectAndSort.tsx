"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Save, Plus, Loader2 } from "lucide-react";
import Image from "next/image";
import { DragDropProvider } from "@dnd-kit/react";
import { SortableArticleCard } from "@/components/admin/articles/SortableArticleCard";
import { ArticleListResponse } from "@/types/article";
import { SectionArticleItem } from "@/types/articleSection";
import { shouldUnoptimizeNewsCardImage } from "@/lib/utils";

interface SelectAndSortProps {
  selectedArticles: SectionArticleItem[];
  availableArticles: ArticleListResponse[];
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  onSave: () => void;
  onSort: (event: any) => void;
  onRemove: (id: string) => void;
  onAdd: (article: ArticleListResponse) => void;
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  loadingSelected: boolean;
  title?: string;
  limit?: number;
}

const SelectAndSort = ({
  selectedArticles,
  availableArticles,
  searchQuery,
  setSearchQuery,
  onSave,
  onSort,
  onRemove,
  onAdd,
  loading,
  hasMore,
  onLoadMore,
  loadingSelected,
  title = "Daftar Artikel",
  limit,
}: SelectAndSortProps) => {
  // Setup Intersection Observer untuk infinite scroll
  const observerTargetRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!observerTargetRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          onLoadMore();
        }
      },
      {
        root: observerTargetRef.current.parentElement,
        threshold: 0.1,
      },
    );

    observer.observe(observerTargetRef.current);

    return () => observer.disconnect();
  }, [hasMore, loading, onLoadMore]);

  return (
    <div className="min-w-0 max-w-full">
      {/* heading */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
        </div>
        <Button onClick={onSave} className="">
          <Save className="h-4 w-4 mr-2" /> Simpan Perubahan
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:max-h-screen lg:h-[80vh]">
        {/* --- KIRI: AREA DROP & SORTING --- */}
        <div className="lg:col-span-2 order-2 lg:order-1 bg-card rounded-lg border border-border p-4 flex flex-col min-h-0">
          <div className="mb-4 flex flex-col lg:flex-row lg:justify-between lg:items-center">
            <h3 className="text-lg font-semibold">{title} Terpilih</h3>
            {limit ? (
              <p className="font-light text-sm">
                {selectedArticles.length} dari {limit} artikel dipilih
              </p>
            ) : (
              <p className="font-light text-sm">
                {selectedArticles.length} artikel dipilih
              </p>
            )}
          </div>

          <div className="overflow-y-auto flex-1 min-h-0 pr-2">
            {loadingSelected || !selectedArticles ? (
              <div className="h-full flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : selectedArticles.length === 0 ? (
              <div className="h-full flex items-center justify-center border-2 border-dashed border-border rounded-lg">
                <p className="text-muted-foreground">
                  Belum ada artikel yang dipilih.
                </p>
              </div>
            ) : (
              // Bungkus seluruh area draggable dengan DragDropProvider
              <DragDropProvider onDragEnd={onSort}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {selectedArticles.map((item, index) => (
                    <SortableArticleCard
                      key={item.article_id.toString()}
                      editorChoice={item}
                      index={index}
                      onRemove={onRemove}
                    />
                  ))}
                </div>
              </DragDropProvider>
            )}
          </div>
        </div>

        {/* --- KANAN: AREA PENCARIAN (Tetap sama) --- */}
        <div className="bg-card order-1 lg:order-2 rounded-lg border border-border p-4 min-h-0 flex flex-col max-h-[min(70vh,32rem)] lg:max-h-none overflow-y-auto">
          <h3 className="text-lg font-semibold mb-4">
            Cari & Tambahkan Artikel
          </h3>

          <Input
            type="text"
            placeholder="Ketik judul artikel..."
            className="mb-4"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <div className="grid grid-cols-1 gap-3 flex-1 min-h-0 overflow-y-auto pr-2">
            {availableArticles.length === 0 && !loading ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                <p>Cari artikel untuk ditambahkan</p>
              </div>
            ) : (
              availableArticles.map((article) => {
                const isLimitReached =
                  limit !== undefined && selectedArticles.length >= limit;
                const imageUrl = article.featuredImage?.url?.trim() ?? "";
                const hasImage = !!imageUrl;
                return (
                  <div
                    className="bg-card rounded-lg border border-border p-2"
                    key={article._id}
                  >
                    <div className="block group">
                      <article className="flex flex-col gap-3 sm:grid sm:grid-cols-5 sm:gap-4">
                        {hasImage && (
                          <div className="sm:col-span-2 relative overflow-hidden rounded-lg aspect-video shrink-0 w-full">
                            <Image
                              src={imageUrl}
                              alt={article.title}
                              fill
                              className="object-cover transition-transform duration-300 group-hover:scale-105"
                              sizes="(max-width: 768px) 100vw, 300px"
                              unoptimized={shouldUnoptimizeNewsCardImage(imageUrl)}
                            />
                          </div>
                        )}

                        <div className={hasImage ? "sm:col-span-3 min-w-0" : "sm:col-span-5 min-w-0"}>
                          <div className="flex flex-wrap items-center gap-2">
                            {article.category && (
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-hijauSawah">
                                {article.category.name}
                              </span>
                            )}
                          </div>

                          <h3 className="font-bold leading-tight group-hover:text-hijauSawah transition-colors text-base lg:text-lg line-clamp-2 min-w-0">
                            {article.title}
                          </h3>

                          <p className="text-xs text-muted-foreground mt-1">
                            By {article.author.name || "ARASVARA"}
                          </p>
                        </div>
                      </article>
                    </div>
                    <div className="flex flex-row justify-end w-full mt-2">
                      <Button
                        size="sm"
                        onClick={() => !isLimitReached && onAdd(article)}
                        variant={"outline"}
                        disabled={isLimitReached}
                        title={
                          isLimitReached
                            ? `Maksimal ${limit} artikel sudah dipilih`
                            : undefined
                        }
                      >
                        <Plus className="h-4 w-4 mr-1" /> Tambah ke Pilihan
                        Editor
                      </Button>
                    </div>
                  </div>
                );
              })
            )}

            {/* Loading indicator */}
            {loading && (
              <div className="flex items-center justify-center py-4">
                <div className="text-muted-foreground text-sm">
                  Memuat artikel...
                </div>
              </div>
            )}

            {/* Intersection observer target untuk infinite scroll */}
            {hasMore && !loading && availableArticles.length > 0 && (
              <div ref={observerTargetRef} className="py-4" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SelectAndSort;
