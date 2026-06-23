"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/axios";
import { EngagementResult, ArticleEngagementReport } from "@/services/analytics/audienceAnalyticsService";

export type { ArticleEngagementReport, EngagementResult };

interface EngagementApiResponse {
  success: boolean;
  data: EngagementResult;
}

interface UseAudienceEngagementParams {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: string;
  format?: string;
  enabled?: boolean;
}

export function useAudienceEngagement({
  page = 1,
  limit = 10,
  search = "",
  categoryId = "",
  format = "",
  enabled = true,
}: UseAudienceEngagementParams = {}) {
  return useQuery({
    queryKey: ["audienceEngagement", page, limit, search, categoryId, format],
    queryFn: async () => {
      const response = await api.get<EngagementApiResponse>(
        "/analytics/audience/engagement",
        {
          params: { page, limit, search, categoryId, format },
        }
      );
      return response.data;
    },
    enabled,
    staleTime: 60 * 1000, // 1 menit cache, cukup sering update krn ada pencarian
  });
}
