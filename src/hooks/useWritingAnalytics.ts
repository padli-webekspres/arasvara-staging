"use client";

import { useQuery } from "@tanstack/react-query";
import { AxiosError } from "axios";
import api from "@/lib/axios";
import type {
  WritingSummary,
  WritingAuthorRow,
  WritingArticleRow,
} from "@/services/analytics/writingAnalyticsService";

type ApiError = { error?: string };

async function fetchJson<T>(url: string, params: Record<string, unknown>): Promise<T> {
  const res = await api.get(url, {
    params,
    validateStatus: (s) => s < 500,
  });
  if (res.status >= 400) {
    const message = res.data?.error || "Gagal memuat data";
    const error = new AxiosError<ApiError>(message);
    error.response = res;
    throw error;
  }
  return (res.data?.data ?? res.data) as T;
}

export function useWritingSummary(params: {
  range: string;
  attribution: string;
  categoryId?: string;
  search?: string;
  enabled?: boolean;
}) {
  return useQuery<WritingSummary, AxiosError<ApiError>>({
    queryKey: [
      "writing-summary",
      params.range,
      params.attribution,
      params.categoryId || "",
      params.search || "",
    ],
    queryFn: () =>
      fetchJson<WritingSummary>("/analytics/writing/summary", {
        range: params.range,
        attribution: params.attribution,
        ...(params.categoryId ? { categoryId: params.categoryId } : {}),
        ...(params.search && params.search.length >= 2
          ? { search: params.search }
          : {}),
      }),
    staleTime: 1000 * 60 * 3,
    retry: 1,
    enabled: params.enabled ?? true,
  });
}

export function useWritingAuthors(params: {
  range: string;
  attribution: string;
  categoryId?: string;
  search?: string;
  page?: number;
  limit?: number;
  sort?: string;
  enabled?: boolean;
}) {
  return useQuery<
    { rows: WritingAuthorRow[]; total: number; page: number; limit: number },
    AxiosError<ApiError>
  >({
    queryKey: [
      "writing-authors",
      params.range,
      params.attribution,
      params.categoryId || "",
      params.search || "",
      params.page || 1,
      params.limit || 20,
      params.sort || "pageviews",
    ],
    queryFn: () =>
      fetchJson("/analytics/writing/authors", {
        range: params.range,
        attribution: params.attribution,
        page: params.page || 1,
        limit: params.limit || 20,
        sort: params.sort || "pageviews",
        ...(params.categoryId ? { categoryId: params.categoryId } : {}),
        ...(params.search && params.search.length >= 2
          ? { search: params.search }
          : {}),
      }),
    staleTime: 1000 * 60 * 3,
    retry: 1,
    enabled: params.enabled ?? true,
  });
}

export function useWritingArticles(params: {
  range: string;
  attribution: string;
  categoryId?: string;
  search?: string;
  page?: number;
  limit?: number;
  sort?: string;
  enabled?: boolean;
}) {
  return useQuery<
    { rows: WritingArticleRow[]; total: number; page: number; limit: number },
    AxiosError<ApiError>
  >({
    queryKey: [
      "writing-articles",
      params.range,
      params.attribution,
      params.categoryId || "",
      params.search || "",
      params.page || 1,
      params.limit || 20,
      params.sort || "views",
    ],
    queryFn: () =>
      fetchJson("/analytics/writing/articles", {
        range: params.range,
        attribution: params.attribution,
        page: params.page || 1,
        limit: params.limit || 20,
        sort: params.sort || "views",
        ...(params.categoryId ? { categoryId: params.categoryId } : {}),
        ...(params.search && params.search.length >= 2
          ? { search: params.search }
          : {}),
      }),
    staleTime: 1000 * 60 * 3,
    retry: 1,
    enabled: params.enabled ?? true,
  });
}
