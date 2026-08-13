"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Save, Plus, Loader2 } from "lucide-react";
import Image from "next/image";
import { DragDropProvider } from "@dnd-kit/react";
import { SortableArticleCard } from "@/components/admin/articles/SortableArticleCard";
import { ArticleListResponse } from "@/types/article";
import { SectionArticleItem } from "@/types/articleSection";
import { shouldUnoptimizeNewsCardImage } from "@/lib/utils";
import { getAdminStandardCardGridClass } from "@/lib/admin-card-grid";
import { useIsLgUp } from "@/hooks/useIsLgUp";

interface SelectAndSortProps {
  selectedArticles: SectionArticleItem[];
  availableArticles: ArticleListResponse[];
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  onSave: () => void;
  onSort: (event: unknown) => void;
  onRemove: (id: string) => void;
  onAdd: (article: ArticleListResponse) => void;
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  loadingSelected: boolean;
  title?: string;
  limit?: number;
}

const PANEL_CLASS =
  "bg-card rounded-lg border border-border p-4 min-h-0 flex flex-col";

/** Tinggi panel mobile: header admin + tabs + judul halaman */
const MOBILE_PANEL_HEIGHT =
  "h-[calc(100vh-12.5rem)] [height:calc(100dvh-12.5rem)]";

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
  const isLgUp = useIsLgUp();
  const [mobileTab, setMobileTab] = React.useState("selected");
  const [scrollContainer, setScrollContainer] =
    React.useState<HTMLDivElement | null>(null);
  const [sentinel, setSentinel] = React.useState<HTMLDivElement | null>(null);
  const loadingRef = React.useRef(loading);
  const hasMoreRef = React.useRef(hasMore);
  const onLoadMoreRef = React.useRef(onLoadMore);

  React.useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  React.useEffect(() => {
    hasMoreRef.current = hasMore;
  }, [hasMore]);

  React.useEffect(() => {
    onLoadMoreRef.current = onLoadMore;
  }, [onLoadMore]);

  const isSearchPanelVisible = isLgUp || mobileTab === "search";

  const tryLoadMore = React.useCallback(() => {
    if (loadingRef.current || !hasMoreRef.current) return;
    onLoadMoreRef.current();
  }, []);

  React.useEffect(() => {
    if (
      !isSearchPanelVisible ||
      !scrollContainer ||
      !sentinel ||
      typeof IntersectionObserver === "undefined"
    ) {
      return;
    }

    // Satu intersection hanya boleh menghasilkan satu request. Observer tidak
    // dibuat ulang saat loading/items berubah, sehingga sentinel yang tetap
    // terlihat tidak dapat memicu request berantai saat pengguna diam.
    let triggeredForCurrentIntersection = false;
    const observer = new IntersectionObserver(
      (entries) => {
        const isIntersecting = entries.some((entry) => entry.isIntersecting);
        if (!isIntersecting) {
          triggeredForCurrentIntersection = false;
          return;
        }
        if (triggeredForCurrentIntersection) return;
        triggeredForCurrentIntersection = true;
        tryLoadMore();
      },
      {
        root: scrollContainer,
        rootMargin: "120px 0px",
        threshold: 0,
      },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [
    isSearchPanelVisible,
    scrollContainer,
    sentinel,
    tryLoadMore,
    isLgUp,
  ]);

  const selectedCountLabel = limit
    ? `${selectedArticles.length} dari ${limit} artikel dipilih`
    : `${selectedArticles.length} artikel dipilih`;

  const renderSelectedPanel = () => (
    <>
      <div className="mb-4 flex flex-col sm:flex-row sm:justify-between sm:items-center shrink-0">
        <h3 className="text-lg font-semibold">{title} Terpilih</h3>
        <p className="font-light text-sm">{selectedCountLabel}</p>
      </div>

      <div className="overflow-y-auto flex-1 min-h-0 pr-2">
        {loadingSelected || !selectedArticles ? (
          <div className="h-full min-h-32 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : selectedArticles.length === 0 ? (
          <div className="h-full min-h-32 flex items-center justify-center border-2 border-dashed border-border rounded-lg">
            <p className="text-muted-foreground">
              Belum ada artikel yang dipilih.
            </p>
          </div>
        ) : (
          <DragDropProvider onDragEnd={onSort}>
            <div className={getAdminStandardCardGridClass()}>
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
    </>
  );

  const renderSearchPanel = () => (
    <>
      <h3 className="text-lg font-semibold mb-4 shrink-0">
        Cari & Tambahkan Artikel
      </h3>

      <Input
        type="text"
        placeholder="Ketik judul artikel..."
        className="mb-4 shrink-0"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />

      <div
        ref={setScrollContainer}
        className="grid grid-cols-1 gap-3 flex-1 min-h-0 overflow-y-auto overscroll-y-contain pr-2 touch-pan-y"
      >
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

                    <div
                      className={
                        hasImage ? "sm:col-span-3 min-w-0" : "sm:col-span-5 min-w-0"
                      }
                    >
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
                    variant="outline"
                    disabled={isLimitReached}
                    title={
                      isLimitReached
                        ? `Maksimal ${limit} artikel sudah dipilih`
                        : undefined
                    }
                  >
                    <Plus className="h-4 w-4 mr-1" /> Tambah ke {title}
                  </Button>
                </div>
              </div>
            );
          })
        )}

        {loading && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mr-2" />
            <span className="text-muted-foreground text-sm">
              Memuat artikel...
            </span>
          </div>
        )}

        <div ref={setSentinel} className="h-px w-full shrink-0" aria-hidden />
      </div>

      {hasMore && !loading && (
        <Button
          type="button"
          variant="outline"
          className="w-full mt-3 shrink-0"
          onClick={tryLoadMore}
        >
          Muat lebih banyak
        </Button>
      )}
    </>
  );

  return (
    <div className="min-w-0 max-w-full">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
        </div>
        <Button onClick={onSave}>
          <Save className="h-4 w-4 mr-2" /> Simpan Perubahan
        </Button>
      </div>

      {isLgUp ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0 lg:max-h-screen lg:h-[80vh]">
          <div className={`lg:col-span-2 ${PANEL_CLASS}`}>
            {renderSelectedPanel()}
          </div>
          <div className={PANEL_CLASS}>{renderSearchPanel()}</div>
        </div>
      ) : (
        <Tabs
          value={mobileTab}
          onValueChange={setMobileTab}
          className="w-full"
        >
          <TabsList className="w-full shrink-0">
            <TabsTrigger value="selected" className="flex-1">
              Terpilih
              <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs tabular-nums">
                {selectedArticles.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="search" className="flex-1">
              Cari & Tambah
            </TabsTrigger>
          </TabsList>

          <TabsContent
            value="selected"
            className="mt-4 focus-visible:outline-none data-[state=inactive]:hidden"
          >
            <div className={`${PANEL_CLASS} ${MOBILE_PANEL_HEIGHT}`}>
              {renderSelectedPanel()}
            </div>
          </TabsContent>

          <TabsContent
            value="search"
            className="mt-4 focus-visible:outline-none data-[state=inactive]:hidden"
          >
            <div className={`${PANEL_CLASS} ${MOBILE_PANEL_HEIGHT}`}>
              {renderSearchPanel()}
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default SelectAndSort;
