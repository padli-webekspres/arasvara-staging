import { useQuery } from "@tanstack/react-query";
import api from "@/lib/axios";

export interface RecommendedTag {
  name: string;
  slug: string;
  count: number;
}

const fetchRecommendedTags = async (): Promise<RecommendedTag[]> => {
  const res = await api.get<{ tags: RecommendedTag[] }>("/tags/recommendation", {
    params: { limit: 10 },
  });
  const json = res.data;
  return Array.isArray(json.tags) ? json.tags : [];
};

/**
 * Hook untuk mengambil daftar 10 rekomendasi tag terpopuler dari cache React Query.
 * staleTime diatur 15 menit agar performa sangat optimal dan tidak sering melakukan hit ke server.
 */
export function useRecommendedTags() {
  return useQuery({
    queryKey: ["tags", "recommendation"],
    queryFn: fetchRecommendedTags,
    staleTime: 1000 * 60 * 15, // 15 menit
  });
}
