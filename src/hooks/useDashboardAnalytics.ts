"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/axios";
import type {
  AEDashboardApiResponse,
  AEDashboardData,
  AEDashboardStats,
} from "@/types/analytics/aeDashboard";

export type { AEDashboardData, AEDashboardStats };

// ─── Interfaces ────────────────────────────────────────────────────────────

export interface AdminDashboardData {
  stafOnline: number;
  dailyAuditCount: number;
  totalMedia: number;
  pendingReviewCount: number;
  scheduledCount: number;
  pushFunnel: {
    successRate: number;
    successCount: number;
    failedCount: number;
  };
  roleDistribution?: Array<{
    role: string;
    label: string;
    count: number;
    percentage: number;
    color: string;
  }>;
  recentLogs: Array<{
    id: string;
    action: string;
    target: string;
    user: string;
    time: string;
    createdAt: string;
    detail: string;
  }>;
  topCategories14d?: Array<{
    categoryId: string;
    name: string;
    views: number;
    articleCount: number;
  }>;
  topAuthors14d?: Array<{
    authorId: string;
    name: string;
    views: number;
    articleCount: number;
  }>;
  upcomingScheduled?: Array<{
    id: string;
    title: string;
    scheduledAt: string;
    authorName: string;
  }>;
}

interface AdminDashboardResponse {
  success: boolean;
  data: AdminDashboardData;
}

export interface ChiefDashboardData {
  pembacaBulanIni: number;
  targetPembacaBulanIni: number;
  artikelRilisHariIni: number;
  pembacaHariIni: number;
  produksiArtikelBulanIni: number;
  trendingArticles: Array<{
    id: string;
    title: string;
    author: string;
    category: string;
    views: number;
    trendingRate: string;
  }>;
  channels: Array<{
    name: string;
    share: number;
    views: number;
    color: string;
  }>;
  homepageSections: Array<{
    name: string;
    articleCount: number;
    totalViews30d: number;
  }>;
  authorPerformance14d: Array<{
    rank: number;
    name: string;
    articles: number;
    views: number;
    avgViews: number;
    deltaPct: number | null;
  }>;
  editorPerformance14d: Array<{
    rank: number;
    name: string;
    views: number;
    articles: number;
    sla: string;
  }>;
  topArticles14d: Array<{
    rank: number;
    id: string;
    title: string;
    author: string;
    views: number;
  }>;
  scheduledArticles: Array<{
    id: string;
    title: string;
    publishedAt: string;
    channel: string;
    author: string;
  }>;
  productionLast14d?: Array<{
    date: string;
    count: number;
  }>;
  unpublishedByStatus?: Array<{
    status: string;
    label: string;
    count: number;
    color: string;
  }>;
}

interface ChiefDashboardResponse {
  success: boolean;
  data: ChiefDashboardData;
}

export interface EditorDashboardData {
  avgSlaMinutes: number;
  slaComplianceRate: number;
  monthlyReviewCount: number;
  monthlyReviewTarget: number;
  rejectionRate: number;
  pendingQueue: Array<{
    id: string;
    title: string;
    author: string;
    category: string;
    waitTime: string;
    submittedTime: string;
    statusColor: string;
  }>;
  calendarBacklog: Array<{
    id: string;
    title: string;
    author: string;
    category: string;
    scheduledTime: string;
    format: string;
  }>;
  editedChannels: Array<{
    name: string;
    pct: number;
    count: number;
    color: string;
  }>;
}

interface EditorDashboardResponse {
  success: boolean;
  data: EditorDashboardData;
}

// ─── Custom Hooks ──────────────────────────────────────────────────────────

/**
 * useAdminDashboard
 * Mengambil data analitik dan performa sistem khusus Super Admin dari MongoDB.
 * Dikonfigurasi dengan optimal caching untuk efisiensi resource.
 */
export function useAdminDashboard({
  enabled = true,
}: {
  enabled?: boolean;
} = {}) {
  return useQuery({
    queryKey: ["adminDashboardStats"],
    queryFn: async () => {
      const response = await api.get<AdminDashboardResponse>(
        "/analytics/dashboard/admin"
      );
      return response.data;
    },
    enabled,
    staleTime: 1.5 * 60 * 1000, // 1.5 menit cache segar
    gcTime: 5 * 60 * 1000,      // 5 menit garbage collection
    retry: 1,
  });
}

/**
 * useChiefDashboard
 * Mengambil data analitik dashboard Pemimpin Redaksi (Pemred) dari MongoDB.
 * Dikonfigurasi dengan optimal caching untuk efisiensi resource.
 */
export function useChiefDashboard({
  enabled = true,
}: {
  enabled?: boolean;
} = {}) {
  return useQuery({
    queryKey: ["chiefDashboardStats"],
    queryFn: async () => {
      const response = await api.get<ChiefDashboardResponse>(
        "/analytics/dashboard/editor-in-chief"
      );
      return response.data;
    },
    enabled,
    staleTime: 1.5 * 60 * 1000, // 1.5 menit cache segar
    gcTime: 5 * 60 * 1000,      // 5 menit garbage collection
    retry: 1,
  });
}

/**
 * useEditorDashboard
 * Mengambil data analitik dan performa kerja khusus peran Editor dari MongoDB.
 * Dikonfigurasi dengan optimal caching untuk efisiensi resource.
 */
export function useEditorDashboard({
  enabled = true,
}: {
  enabled?: boolean;
} = {}) {
  return useQuery({
    queryKey: ["editorDashboardStats"],
    queryFn: async () => {
      const response = await api.get<EditorDashboardResponse>(
        "/analytics/dashboard/editor"
      );
      return response.data;
    },
    enabled,
    staleTime: 1.5 * 60 * 1000, // 1.5 menit cache segar
    gcTime: 5 * 60 * 1000,      // 5 menit garbage collection
    retry: 1,
  });
}

// ─── Writer Dashboard Hook & Interfaces ─────────────────────────────────────

export interface WriterDashboardData {
  publishedThisMonth: number;
  publishedTarget: number;
  progressPercent: number;
  submittedDrafts: number;
  revisionRate: number;
  totalViews: number;
  viewsThisMonth: number;
  pageviewTrend: Array<{
    date: string;
    views: number;
  }>;
  revisionInbox: Array<{
    id: string;
    title: string;
    editor: string;
    date: string;
    reason: string;
  }>;
  topStories: Array<{
    id: string;
    title: string;
    views: number;
    shares: number;
    ctr: string;
  }>;
}

interface WriterDashboardResponse {
  success: boolean;
  data: WriterDashboardData;
}

/**
 * useWriterDashboard
 * Mengambil data analitik dan performa menulis khusus peran Content Writer dari MongoDB.
 * Dikonfigurasi dengan optimal caching untuk efisiensi resource.
 */
export function useWriterDashboard({
  enabled = true,
}: {
  enabled?: boolean;
} = {}) {
  return useQuery({
    queryKey: ["writerDashboardStats"],
    queryFn: async () => {
      const response = await api.get<WriterDashboardResponse>(
        "/analytics/dashboard/writer"
      );
      return response.data;
    },
    enabled,
    staleTime: 1.5 * 60 * 1000, // 1.5 menit cache segar
    gcTime: 5 * 60 * 1000,      // 5 menit garbage collection
    retry: 1,
  });
}

// ─── Account Executive Dashboard ─────────────────────────────────────────────

/**
 * useAEDashboard
 * Data lengkap dashboard Account Executive (KPI, grafik, tabel).
 */
export function useAEDashboard({
  enabled = true,
  trendDays = 30,
}: {
  enabled?: boolean;
  trendDays?: number;
} = {}) {
  return useQuery({
    queryKey: ["aeDashboard", trendDays],
    queryFn: async () => {
      const response = await api.get<AEDashboardApiResponse>(
        `/analytics/dashboard/ae?days=${trendDays}`,
      );
      return response.data.data;
    },
    enabled,
    staleTime: 1.5 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

/** @deprecated Gunakan useAEDashboard — hanya KPI legacy. */
export function useAEDashboardStats({
  enabled = true,
}: {
  enabled?: boolean;
} = {}) {
  const query = useAEDashboard({ enabled });
  return {
    ...query,
    data: query.data
      ? { success: true as const, stats: query.data.stats }
      : undefined,
  };
}

