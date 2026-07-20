import { useQuery } from "@tanstack/react-query";
import { SectionVideoItem } from "@/types/articleSection";
import api from "@/lib/axios";
import { AxiosError } from "axios";

/** Platform yang didukung oleh route GET /api/articles/socmed/[platform] */
export type SocmedPlatform = "tiktok" | "instagram" | "youtube";

/**
 * Normalizes GET/POST socmed API bodies: route may return a bare array or `{ data: [] }`.
 */
export function parseSocmedVideoListResponse(payload: unknown): SectionVideoItem[] {
  if (Array.isArray(payload)) return payload;
  if (
    payload &&
    typeof payload === "object" &&
    "data" in payload &&
    Array.isArray((payload as { data: unknown }).data)
  ) {
    return (payload as { data: SectionVideoItem[] }).data;
  }
  return [];
}

/**
 * Fetcher generik untuk mengambil data video dari platform sosial media tertentu menggunakan Axios.
 */
async function fetchSocmedVideos(platform: SocmedPlatform): Promise<SectionVideoItem[]> {
  try {
    // baseURL di axios.ts sudah /api, jadi path cukup /articles/socmed/...
    const { data } = await api.get(`/articles/socmed/${platform}`);
    return parseSocmedVideoListResponse(data);
  } catch (error) {
    if (error instanceof AxiosError) {
      const errorBody = error.response?.data;
      const platformName = platform.charAt(0).toUpperCase() + platform.slice(1);
      throw new Error(
        errorBody?.error ?? `Gagal mengambil data video ${platformName}`
      );
    }
    throw error;
  }
}

/**
 * Hook generik untuk mengambil daftar video dari database berdasarkan platform.
 * Menggunakan React Query untuk caching (5 menit) dan state management.
 */
export function useSocmedVideos(platform: SocmedPlatform) {
  return useQuery<SectionVideoItem[], Error>({
    queryKey: ["socmed-videos", platform],
    queryFn: () => fetchSocmedVideos(platform),
    staleTime: 1000 * 60 * 5, // 5 menit
    retry: 2,
  });
}

/**
 * Hook untuk mengambil video TikTok + Instagram, terbaru dulu (createdAt).
 */
async function fetchCombinedSocmedVideos(): Promise<SectionVideoItem[]> {
  try {
    const { data } = await api.get("/articles/socmed/combined", {
      params: { sort: "createdAt" },
    });
    return parseSocmedVideoListResponse(data);
  } catch (error) {
    if (error instanceof AxiosError) {
      const errorBody = error.response?.data;
      throw new Error(
        errorBody?.error ?? "Gagal mengambil data video socmed",
      );
    }
    throw error;
  }
}

export function useCombinedSocmedVideos() {
  return useQuery<SectionVideoItem[], Error>({
    queryKey: ["socmed-videos", "combined", "createdAt"],
    queryFn: fetchCombinedSocmedVideos,
    staleTime: 1000 * 60 * 5,
    retry: 2,
  });
}

/**
 * Hook khusus untuk mengambil daftar video YouTube.
 */
export function useYoutubeVideos() {
  return useSocmedVideos("youtube");
}
