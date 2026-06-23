import { useQuery } from "@tanstack/react-query";
import { fetcher } from "@/lib/fetcher";
import { SponsorItem } from "@/types/sponsor";

/**
 * Custom hook to fetch sponsors from API
 * Returns: { data, isLoading, error }
 */
export function useSponsors() {
  return useQuery<SponsorItem[]>({
    queryKey: ["sponsors"],
    queryFn: async () => {
      const res = await fetcher<{ data: SponsorItem[] }>("/sponsor");
      return res.data;
    },
    staleTime: 1000 * 60 * 10, // 10 menit cache
    retry: 1,
  });
}
