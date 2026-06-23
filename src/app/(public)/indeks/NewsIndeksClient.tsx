"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import api from "@/lib/axios";
import LoadMoreButton from "@/components/ui/LoadMoreButton";
import { Skeleton } from "@/components/ui/skeleton";
import { ArticleListResponse } from "@/types/article";
import SidebarIndeks from "@/components/sidebarPublic/SidebarIndeks";
import SecondaryNewsCard from "@/components/news/SecondaryNewsCard";

// ─── Skeleton Component ──────────────────────────────────────────────────────

/** Skeleton untuk artikel indeks berita */
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

// ─── Main Client Component ───────────────────────────────────────────────────

interface NewsIndeksClientProps {
  initialArticles: ArticleListResponse[];
  initialMeta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
  };
  activeCategory: string;
  activeDate: string;
}

export default function NewsIndeksClient({
  initialArticles,
  initialMeta,
  activeCategory,
  activeDate,
}: NewsIndeksClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ── Client-Side States ──
  const [articles, setArticles] =
    useState<ArticleListResponse[]>(initialArticles);
  const [currentPage, setCurrentPage] = useState(initialMeta.page);
  const [totalPages, setTotalPages] = useState(initialMeta.totalPages);
  const [total, setTotal] = useState(initialMeta.total);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Sync State ketika Server Component mengoper props baru (saat filter berubah) ──
  useEffect(() => {
    setArticles(initialArticles);
    setCurrentPage(initialMeta.page);
    setTotalPages(initialMeta.totalPages);
    setTotal(initialMeta.total);
    setError(null);
  }, [initialArticles, initialMeta, activeCategory, activeDate]);

  // ── Handler: Ganti Tanggal dari Sidebar ──
  const handleDateChange = useCallback(
    (date: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (date) {
        params.set("date", date);
      } else {
        params.delete("date");
      }
      // Hapus page parameter agar kembali ke halaman 1 saat filter tanggal berubah
      params.delete("page");
      router.push(`/indeks?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  // ── Handler: Load More Artikel (Client-Side Fetching halaman berikutnya) ──
  const handleLoadMore = useCallback(async () => {
    if (isLoading) return;
    setIsLoading(true);
    setError(null);

    try {
      const nextPage = currentPage + 1;
      const params = new URLSearchParams();
      if (activeCategory) params.set("category", activeCategory);
      if (activeDate) params.set("date", activeDate);
      params.set("page", String(nextPage));
      params.set("limit", "12");

      const response = await api.get<{
        success: boolean;
        error?: string;
        data: ArticleListResponse[];
        meta: { total: number; totalPages: number; page: number };
      }>(`/indeks?${params.toString()}`);
      const json = response.data;

      if (!json.success) {
        throw new Error(json.error || "Gagal mengambil data tambahan");
      }

      setTotal(json.meta.total);
      setTotalPages(json.meta.totalPages);
      setCurrentPage(json.meta.page);

      // Append artikel baru ke bawah list artikel yang sudah ada
      setArticles((prev) => [...prev, ...json.data]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Terjadi kesalahan";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [activeCategory, activeDate, currentPage, isLoading]);

  const hasMore = currentPage < totalPages;

  // ── Heading & Tanggal Dinamis ──
  const pageHeading = activeCategory
    ? `Indeks: ${activeCategory.charAt(0).toUpperCase() + activeCategory.slice(1)}`
    : "Indeks Berita";

  const dateLabel = activeDate
    ? new Date(`${activeDate}T00:00:00`).toLocaleDateString("id-ID", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <main className="pt-32">
      <section className="container mx-auto px-4 md:px-0 py-8 flex gap-6 min-h-[70vh] relative flex-col md:flex-row">
        {/* Sidebar Filter Indeks */}
        <SidebarIndeks
          className="w-full md:w-64 shrink-0 md:sticky md:top-40 h-fit bg-background z-10"
          onDateChange={handleDateChange}
        />

        {/* Divider Vertikal */}
        <div className="border-l border-muted h-auto hidden md:block" />

        {/* Area Konten */}
        <div className="flex-1 min-w-0">
          {/* Judul & Info Filter Aktif */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground">
              {pageHeading}
            </h1>
            {dateLabel && (
              <p className="text-sm text-muted-foreground mt-1">{dateLabel}</p>
            )}
            {total > 0 && (
              <p className="text-sm text-muted-foreground mt-1">
                {total} artikel ditemukan
              </p>
            )}
          </div>

          {/* Skeleton Loading (Saat memuat Load More halaman pertama kosong) */}
          {isLoading && articles.length === 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <NewsCardSkeleton key={i} />
              ))}
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="py-10 text-center text-destructive">
              <p className="font-semibold">Terjadi kesalahan</p>
              <p className="text-sm mt-1">{error}</p>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !error && articles.length === 0 && (
            <div className="py-20 text-center text-muted-foreground border border-dashed rounded-lg">
              <p className="text-lg font-medium">Tidak ada artikel ditemukan</p>
              <p className="text-sm mt-1">
                Coba pilih kategori lain atau ubah tanggal pencarian
              </p>
            </div>
          )}

          {/* Daftar Kartu Artikel */}
          {articles.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {articles.map((article) => (
                <div key={article._id ?? article.slug}>
                  <SecondaryNewsCard article={article} />
                </div>
              ))}
            </div>
          )}

          {/* Tombol Load More */}
          {hasMore && !error && (
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
