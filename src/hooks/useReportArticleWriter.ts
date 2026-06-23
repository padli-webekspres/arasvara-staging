"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/axios";
import { ArticleWriterReport } from "@/types/reports/reportArticle";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * API Response Type
 * ─────────────────────────────────────────────────────────────────────────────
 */
interface ArticleWriterReportApiResponse {
	reports: ArticleWriterReport[];
	pagination: {
		page: number;
		limit: number;
		total: number;
		totalPages: number;
	};
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * useReportArticleWriter Hook
 *
 * Custom hook untuk fetch article writer report data menggunakan React Query.
 * Menyediakan intelligent caching untuk mengurangi API calls yang tidak perlu.
 *
 * @param page - Halaman pagination (default: 1)
 * @param searchQuery - Pencarian berdasarkan nama/email user (default: '')
 * @param enabled - Kontrol apakah query harus dijalankan (default: true)
 *
 * @returns {Object} Query result dengan data, isLoading, error, dan pagination metadata
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function useReportArticleWriter(
	page: number = 1,
	searchQuery: string = "",
	enabled: boolean = true,
) {
	return useQuery({
		queryKey: ["reportArticleWriter", page, searchQuery],
		queryFn: async () => {
			const response = await api.get<ArticleWriterReportApiResponse>(
				"/reports/article/writer",
				{
					params: {
						page,
						limit: 10,
						search: searchQuery,
					},
				},
			);
			return response.data;
		},
		enabled,
		staleTime: 3 * 60 * 1000, // 3 minutes
		gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
		retry: 1,
	});
}
