"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/axios";

// ─── Interfaces ────────────────────────────────────────────────────────────

export interface WorkflowSummaryData {
  draft: number;
  pendingReview: number;
  scheduled: number;
  avgSlaMinutes: number;
  complianceRate: number;
}

export interface ThroughputResponPoint {
  date: string;
  submitted: number;
  published: number;
  avgSla: number;
}

export interface QueueCalendarItem {
  id: string;
  title: string;
  author: string;
  category: string;
  format: string;
  submittedAt?: string;
  scheduledAt?: string;
  waitTimeMinutes?: number;
}

export interface QueueCalendarData {
  pendingQueue: QueueCalendarItem[];
  scheduledCalendar: QueueCalendarItem[];
}

interface WorkflowSummaryResponse {
  success: boolean;
  data: WorkflowSummaryData;
}

interface ThroughputResponResponse {
  success: boolean;
  data: ThroughputResponPoint[];
}

interface QueueCalendarResponse {
  success: boolean;
  data: QueueCalendarData;
}

// ─── Custom Hooks ──────────────────────────────────────────────────────────

/**
 * useWorkflowSummary
 * Mengambil ringkasan metrik draf, pending review, scheduled, dan SLA rata-rata.
 */
export function useWorkflowSummary({
  startDate,
  endDate,
  enabled = true,
}: {
  startDate?: string;
  endDate?: string;
  enabled?: boolean;
} = {}) {
  return useQuery({
    queryKey: ["workflowSummary", startDate, endDate],
    queryFn: async () => {
      const response = await api.get<WorkflowSummaryResponse>(
        "/analytics/workflow/summary",
        {
          params: { startDate, endDate },
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

/**
 * useThroughputRespon
 * Mengambil data tren throughput produksi redaksi dan grafik tren respon (SLA) harian.
 */
export function useThroughputRespon({
  startDate,
  endDate,
  enabled = true,
}: {
  startDate?: string;
  endDate?: string;
  enabled?: boolean;
} = {}) {
  return useQuery({
    queryKey: ["workflowThroughputRespon", startDate, endDate],
    queryFn: async () => {
      const response = await api.get<ThroughputResponResponse>(
        "/analytics/workflow/throughput-respon",
        {
          params: { startDate, endDate },
        }
      );
      return response.data;
    },
    enabled,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
  });
}

/**
 * useQueueCalendar
 * Mengambil daftar antrean review naskah terlama dan kalender tayang otomatis 24 jam ke depan.
 */
export function useQueueCalendar({
  enabled = true,
}: {
  enabled?: boolean;
} = {}) {
  return useQuery({
    queryKey: ["workflowQueueCalendar"],
    queryFn: async () => {
      const response = await api.get<QueueCalendarResponse>(
        "/analytics/workflow/queue-calendar"
      );
      return response.data;
    },
    enabled,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
  });
}
