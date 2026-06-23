import { useQuery } from "@tanstack/react-query";
import { AxiosError } from "axios";
import api from "@/lib/axios";
import {
	KPIWriterTeamResponse,
	KPIEditorResponse,
	KPIHeadOfResponse,
} from "@/types/reports/kpiUser";

// Union type untuk KPI response
type KPIResponse =
	| KPIWriterTeamResponse
	| KPIEditorResponse
	| KPIHeadOfResponse;

interface UseKPIReportOptions {
	type: "writer_team" | "editor" | "head_of";
	period: string; // Format: "YYYY-MM"
	search?: string;
	enabled?: boolean; // Optional: untuk disable query saat tertentu
}

interface KPIReportError {
	error?: string;
	message?: string;
}

/**
 * Custom hook untuk fetch KPI data dengan React Query caching.
 *
 * Fitur:
 * - Otomatis cache data per tab (query key berbeda untuk setiap kombinasi type/period/search)
 * - Stale time: 3 menit (tidak fetch ulang jika dalam 3 menit)
 * - Data akan digunakan kembali saat berpindah tab, tanpa refetch
 * - Setelah 3 menit, background refetch akan trigger otomatis
 *
 * @param options.type - KPI type: "writer_team", "editor", atau "head_of"
 * @param options.period - Periode KPI dalam format "YYYY-MM"
 * @param options.search - Search filter (nama staff), optional
 * @param options.enabled - Disable query saat tertentu, default true
 * @returns Query result: { data, isLoading, error, isError }
 */
export function useKPIReport({
	type,
	period,
	search,
	enabled = true,
}: UseKPIReportOptions) {
	return useQuery<KPIResponse[], AxiosError<KPIReportError>>({
		queryKey: ["kpi", type, period, search || ""],
		queryFn: async () => {
			const res = await api.get("/reports/kpi", {
				params: {
					type,
					period,
					...(search && search.trim().length >= 2 && { search }),
				},
				validateStatus: (s) => s < 500,
			});

			if (res.status >= 400) {
				const errorMessage = res.data?.error || "Gagal memuat data KPI";
				const error = new AxiosError<KPIReportError>(errorMessage);
				error.response = res;
				throw error;
			}

			return res.data as KPIResponse[];
		},
		staleTime: 1000 * 60 * 3, // 3 minutes (staletime sebelum background refetch)
		gcTime: 1000 * 60 * 10, // 10 minutes (cache lifetime)
		retry: 1,
		enabled,
	});
}
