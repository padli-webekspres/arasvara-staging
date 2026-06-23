"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/axios";

export interface TrafficTrendDataPoint {
  date: string;
  views: number;
  uniqueVisitors: number;
}

interface TrafficTrendApiResponse {
  success: boolean;
  data: TrafficTrendDataPoint[];
}

interface UseAudienceTrafficTrendParams {
  startDate?: string;
  endDate?: string;
  interval?: "daily" | "weekly" | "monthly";
  enabled?: boolean;
}

/**
 * useAudienceTrafficTrend Hook
 * 
 * Custom hook untuk melakukan fetch data tren kunjungan artikel secara time-series.
 */
export function useAudienceTrafficTrend({
  startDate,
  endDate,
  interval = "daily",
  enabled = true,
}: UseAudienceTrafficTrendParams = {}) {
  return useQuery({
    queryKey: ["audienceTrafficTrend", startDate, endDate, interval],
    queryFn: async () => {
      const response = await api.get<TrafficTrendApiResponse>(
        "/analytics/audience/views",
        {
          params: {
            startDate,
            endDate,
            interval,
          },
        }
      );
      return response.data;
    },
    enabled,
    staleTime: 2 * 60 * 1000, // 2 menit cache
    gcTime: 5 * 60 * 1000,   // 5 menit garbage collection
    retry: 1,
  });
}
