"use client";

import { useQuery } from "@tanstack/react-query";
import { AxiosError } from "axios";
import api from "@/lib/axios";
import {
  KPIWriterTeamResponse,
  KPIEditorResponse,
  KPISummaryResponse,
  KPIChannelResponse,
} from "@/types/reports/kpiUser";

type KPIReportError = { error?: string; message?: string };

interface UseKPIReportOptions {
  type: "writer_team" | "editor";
  period: string;
  search?: string;
  enabled?: boolean;
}

export function useKPIReport({
  type,
  period,
  search,
  enabled = true,
}: UseKPIReportOptions) {
  return useQuery<
    Array<KPIWriterTeamResponse | KPIEditorResponse>,
    AxiosError<KPIReportError>
  >({
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

      return res.data as Array<KPIWriterTeamResponse | KPIEditorResponse>;
    },
    staleTime: 1000 * 60 * 3,
    gcTime: 1000 * 60 * 10,
    retry: 1,
    enabled,
  });
}

export function useKPISummary(period: string, enabled = true) {
  return useQuery<KPISummaryResponse, AxiosError<KPIReportError>>({
    queryKey: ["kpi", "summary", period],
    queryFn: async () => {
      const res = await api.get("/reports/kpi", {
        params: { type: "summary", period },
        validateStatus: (s) => s < 500,
      });
      if (res.status >= 400) {
        const errorMessage = res.data?.error || "Gagal memuat ringkasan KPI";
        const error = new AxiosError<KPIReportError>(errorMessage);
        error.response = res;
        throw error;
      }
      return (res.data?.data ?? res.data) as KPISummaryResponse;
    },
    staleTime: 1000 * 60 * 3,
    retry: 1,
    enabled,
  });
}

export function useKPIChannel(
  period: string,
  attribution: "consumption" | "publish_cohort" = "consumption",
  enabled = true,
) {
  return useQuery<KPIChannelResponse, AxiosError<KPIReportError>>({
    queryKey: ["kpi", "channel", period, attribution],
    queryFn: async () => {
      const res = await api.get("/reports/kpi", {
        params: { type: "channel", period, attribution },
        validateStatus: (s) => s < 500,
      });
      if (res.status >= 400) {
        const errorMessage = res.data?.error || "Gagal memuat KPI kanal";
        const error = new AxiosError<KPIReportError>(errorMessage);
        error.response = res;
        throw error;
      }
      return (res.data?.data ?? res.data) as KPIChannelResponse;
    },
    staleTime: 1000 * 60 * 3,
    retry: 1,
    enabled,
  });
}
