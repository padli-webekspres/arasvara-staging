import { useQuery } from "@tanstack/react-query";
import api from "@/lib/axios";
import { AxiosError } from "axios";
import type { ArticleListPage, GalleryArticle } from "@/types/article";

export interface UsePhotographyArticlesOptions {
  /** Jumlah artikel per halaman (default 12) */
  limit?: number;
  page?: number;
}

/**
 * Fetcher: mengambil artikel berformat GALLERY dari GET /api/articles.
 * Hanya artikel terbit (PUBLISHED) agar cocok untuk homepage publik.
 */
async function fetchGalleryArticles(
  options: UsePhotographyArticlesOptions = {},
): Promise<GalleryArticle[]> {
  const limit = options.limit ?? 12;
  const page = options.page ?? 1;
  try {
    const { data } = await api.get<ArticleListPage>("/articles", {
      params: {
        limit,
        page,
        format: "GALLERY",
        status: "PUBLISHED",
      },
    });
    const list = data.articles ?? [];
    return list.filter((a): a is GalleryArticle => a.format === "GALLERY");
  } catch (error) {
    if (error instanceof AxiosError) {
      const errorBody = error.response?.data as { error?: string } | undefined;
      throw new Error(errorBody?.error ?? "Gagal memuat galeri fotografi");
    }
    throw error;
  }
}

/**
 * React Query untuk daftar artikel fotografi / galeri (format GALLERY).
 */
export function usePhotographyArticles(options?: UsePhotographyArticlesOptions) {
  const limit = options?.limit ?? 12;
  const page = options?.page ?? 1;

  return useQuery<GalleryArticle[], Error>({
    queryKey: ["photography-gallery-articles", limit, page],
    queryFn: () => fetchGalleryArticles({ limit, page }),
    staleTime: 1000 * 60 * 5,
    retry: 2,
  });
}
