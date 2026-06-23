"use client";

import { useState, useCallback, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import api from "@/lib/axios";
import LoadMoreButton from "@/components/ui/LoadMoreButton";
import NewsCard from "@/components/news/NewsCard";
import { Skeleton } from "@/components/ui/skeleton";
import { ArticleListResponse } from "@/types/article";
import { VideoItem } from "@/types/search";
import SidebarSearch, {
  SearchFilters,
} from "@/components/sidebarPublic/SidebarSearch";
import { Loader2, SlidersHorizontal } from "lucide-react";
import SecondaryNewsCard from "@/components/news/SecondaryNewsCard";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { VideoFormCard } from "@/components/admin/articles/VideoFormCard";
import VideoCarouselItem from "@/components/homepage/carousel/VideoCarouselItem";
import Link from "next/link";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function filtersToSearchParams(filters: SearchFilters): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.selectedType) params.set("type", filters.selectedType);
  if (filters.searchText.trim()) params.set("q", filters.searchText.trim());
  if (filters.selectedFormat.length > 0)
    params.set("format", filters.selectedFormat.join(","));
  if (filters.selectedCategories.length > 0)
    params.set("category", filters.selectedCategories.join(","));
  if (filters.selectedTags.length > 0)
    params.set("tags", filters.selectedTags.join(","));
  if (filters.selectedHighlights.length > 0)
    params.set("flags", filters.selectedHighlights.join(","));
  if (filters.selectedPlatform.length > 0)
    params.set("platform", filters.selectedPlatform.join(","));
  if (filters.dateRange?.from && filters.dateRange.from instanceof Date)
    params.set("dateFrom", filters.dateRange.from.toISOString().split("T")[0]);
  if (filters.dateRange?.to && filters.dateRange.to instanceof Date)
    params.set("dateTo", filters.dateRange.to.toISOString().split("T")[0]);
  if (filters.sortBy !== "date") params.set("sortBy", filters.sortBy);
  if (filters.sortOrder !== "desc") params.set("sortOrder", filters.sortOrder);

  return params;
}

function buildApiUrl(searchParams: URLSearchParams): string {
  return `/api/search?${searchParams.toString()}`;
}

// ─── Skeleton Components ──────────────────────────────────────────────────────

function NewsCardSkeleton() {
  return (
    <div className="grid grid-cols-5 gap-4">
      <div className="col-span-2">
        <Skeleton className="w-full aspect-video rounded-lg" />
      </div>
      <div className="col-span-3 flex flex-col gap-2 justify-center">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-3 w-full mt-1" />
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-3 w-24 mt-1" />
      </div>
    </div>
  );
}

function VideoCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 p-4 border border-muted rounded-xl">
      <Skeleton className="w-full aspect-video rounded-lg" />
      <Skeleton className="h-3 w-16" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
    </div>
  );
}

// ─── Inner Component (requires useSearchParams) ───────────────────────────────

function SearchPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [articles, setArticles] = useState<ArticleListResponse[]>([]);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const currentType = searchParams.get("type") || "ARTICLES";

  const fetchResults = useCallback(
    async (params: URLSearchParams, page: number = 1, append = false) => {
      setIsLoading(true);
      setError(null);
      try {
        const fetchParams = new URLSearchParams(params.toString());
        fetchParams.set("page", String(page));

        const response = await api.get<{
          success: boolean;
          error?: string;
          data: ArticleListResponse[] | VideoItem[];
          meta: { total: number; totalPages: number; page: number };
        }>(`/search?${fetchParams.toString()}`);
        const json = response.data;

        if (!json.success)
          throw new Error(json.error || "Gagal mengambil data");

        const type = fetchParams.get("type") || "ARTICLES";
        setTotal(json.meta.total);
        setTotalPages(json.meta.totalPages);
        setCurrentPage(json.meta.page);

        if (type === "VIDEO") {
          const videoData = json.data as VideoItem[];
          setVideos((prev) => (append ? [...prev, ...videoData] : videoData));
          setArticles([]);
        } else {
          const articleData = json.data as ArticleListResponse[];
          setArticles((prev) => (append ? [...prev, ...articleData] : articleData));
          setVideos([]);
        }

        setHasSearched(true);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Terjadi kesalahan";
        setError(message);
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (searchParams.toString()) {
      fetchResults(searchParams, 1, false);
    }
  }, [searchParams, fetchResults]);

  const handleSearch = useCallback(
    (filters: SearchFilters) => {
      const params = filtersToSearchParams(filters);
      router.push(`/search?${params.toString()}`, { scroll: false });
    },
    [router],
  );

  const handleSearchMobile = useCallback(
    (filters: SearchFilters) => {
      handleSearch(filters);
      setIsDrawerOpen(false);
    },
    [handleSearch],
  );

  const handleLoadMore = useCallback(() => {
    const nextPage = currentPage + 1;
    fetchResults(searchParams, nextPage, true);
  }, [currentPage, searchParams, fetchResults]);

  const hasMore = currentPage < totalPages;
  const isEmpty = hasSearched && articles.length === 0 && videos.length === 0;

  return (
    <main className="pt-32">
      <section className="container mx-auto px-4 py-8 flex gap-6 min-h-[70vh]">
        <SidebarSearch
          className="w-1/4 shrink-0 hidden md:block sticky top-36"
          onSearch={handleSearch}
        />

        <div className="border-l border-muted h-auto hidden md:block" />

        <div className="flex-1 min-w-0">
          <div className="flex w-full justify-between items-center mb-6 md:hidden">
            <div>
              <h2 className="text-2xl font-bold">Pencarian</h2>
              {hasSearched && !isLoading && (
                <p className="text-sm text-muted-foreground ">
                  {total > 0
                    ? `Menampilkan ${articles.length + videos.length} dari ${total} hasil`
                    : "Tidak ada hasil yang cocok"}
                </p>
              )}
            </div>
            <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
              <DrawerContent className="rounded-t-2xl h-[50vh] flex flex-col">
                <DrawerHeader className="border-b px-4 py-3 shrink-0">
                  <DrawerTitle className="text-left text-lg">
                    Search &amp; Filter
                  </DrawerTitle>
                </DrawerHeader>
                <div className="overflow-y-auto flex-1 p-4 w-full">
                  <SidebarSearch
                    onSearch={handleSearchMobile}
                    className="py-0"
                  />
                </div>
              </DrawerContent>
              <DrawerTrigger asChild>
                <Button
                  size="icon"
                  variant={"outline"}
                  className="fixed bottom-6 right-6 h-12 w-12 rounded-full shadow-lg z-40 md:hidden"
                  aria-label="Buka filter"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                </Button>
              </DrawerTrigger>
            </Drawer>
          </div>

          {isLoading && articles.length === 0 && videos.length === 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) =>
                currentType === "VIDEO" ? (
                  <VideoCardSkeleton key={i} />
                ) : (
                  <NewsCardSkeleton key={i} />
                ),
              )}
            </div>
          )}

          {error && (
            <div className="py-10 text-center text-destructive">
              <p className="font-semibold">Terjadi kesalahan</p>
              <p className="text-sm mt-1">{error}</p>
            </div>
          )}

          {isEmpty && !error && (
            <div className="py-20 text-center text-muted-foreground">
              <p className="text-lg font-medium">Tidak ada hasil ditemukan</p>
              <p className="text-sm mt-1">
                Coba ubah filter atau kata kunci pencarian
              </p>
            </div>
          )}

          {!hasSearched && !isLoading && (
            <div className="py-20 text-center text-muted-foreground">
              <p className="text-lg font-medium">Mulai pencarian</p>
              <p className="text-sm mt-1 hidden md:block">
                Gunakan form di sebelah kiri untuk mencari artikel atau video
              </p>
              <p className="text-sm mt-1 md:hidden">
                Gunakan tombol filter di atas untuk mencari artikel atau video
              </p>
            </div>
          )}

          {currentType !== "VIDEO" && articles.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {articles.map((article) => (
                <SecondaryNewsCard
                  key={article._id ?? article.slug}
                  article={article}
                />
              ))}
            </div>
          )}

          {currentType === "VIDEO" && videos.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {videos.map((video) => (
                <Link
                  key={video._id}
                  href={video.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`relative block w-full rounded-2xl overflow-hidden group cursor-pointer shrink-0 aspect-4/5`}
                  title={video.title}
                  aria-label={`Tonton video: ${video.title}`}
                >
                  <div
                    className="absolute inset-0 w-full h-full bg-cover bg-center transition-transform duration-500 group-hover:scale-110"
                    style={{ backgroundImage: `url(${video.thumbnailUrl})` }}
                  />
                  <div className="absolute inset-0 bg-black/40 transition-colors duration-300 group-hover:bg-black/20" />
                  <div className="absolute bottom-0 left-0 right-0 p-3 bg-linear-to-t from-black/70 to-transparent">
                    <p className="text-white text-sm font-medium line-clamp-2">
                      {video.title}
                    </p>
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex items-center justify-center w-14 h-14 md:w-16 md:h-16 bg-white/30 backdrop-blur-md rounded-full text-white transition-transform duration-300 scale-0 group-hover:scale-110 group-hover:bg-primary/90">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                        className="w-8 h-8 ml-1"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347c-.75.412-1.667-.13-1.667-.986V5.653Z"
                        />
                      </svg>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {hasMore && (
            <LoadMoreButton
              onClick={handleLoadMore}
              disabled={isLoading}
              variant="hijauSawah"
              wrapperClassName="text-center mt-10"
            />
          )}
        </div>
      </section>
    </main>
  );
}

export default function SearchClient() {
  return (
    <Suspense
      fallback={
        <div className="pt-32 flex items-center justify-center min-h-[70vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <SearchPageInner />
    </Suspense>
  );
}
