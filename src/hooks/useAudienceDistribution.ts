"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/axios";

// ─── Type Definitions ────────────────────────────────────────────────────────

export interface FormatDistributionItem {
  format: string;       // "STANDARD" | "GALLERY"
  views: number;
  percentage: number;
}

export interface CategoryDistributionItem {
  categoryId: string;
  categoryName: string;
  views: number;
  percentage: number;
}

export interface CrossCorrelationItem {
  format: string;
  categoryName: string;
  views: number;
}

export interface DistributionData {
  formatDistribution: FormatDistributionItem[];
  categoryDistribution: CategoryDistributionItem[];
  crossCorrelation: CrossCorrelationItem[];
}

interface DistributionApiResponse {
  success: boolean;
  data: DistributionData;
}

interface UseAudienceDistributionParams {
  startDate?: string;
  endDate?: string;
  enabled?: boolean;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useAudienceDistribution Hook
 *
 * Custom hook untuk mengambil data distribusi audiens (format, kategori, cross-correlation)
 * dalam satu panggilan API ke endpoint /api/analytics/audience/distribution.
 */
export function useAudienceDistribution({
  startDate,
  endDate,
  enabled = true,
}: UseAudienceDistributionParams = {}) {
  return useQuery({
    queryKey: ["audienceDistribution", startDate, endDate],
    queryFn: async () => {
      const response = await api.get<DistributionApiResponse>(
        "/analytics/audience/distribution",
        {
          params: { startDate, endDate },
        }
      );
      return response.data;
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5 menit cache (data distribusi tidak se-volatile tren)
    gcTime: 10 * 60 * 1000,   // 10 menit garbage collection
    retry: 1,
  });
}
