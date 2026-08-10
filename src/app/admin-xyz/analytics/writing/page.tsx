"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Eye, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "next-themes";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Bar } from "react-chartjs-2";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { ListTable, ListTableColumn } from "@/components/table/ListTable";
import UserAvatar from "@/components/users/AvatarUser";
import {
  MetricCard,
  AlertRail,
  ChartState,
  formatVsPrevPeriod,
} from "@/components/admin/analytics/MetricPrimitives";
import {
  useWritingSummary,
  useWritingAuthors,
  useWritingArticles,
} from "@/hooks/useWritingAnalytics";
import { useIsLgUp } from "@/hooks/useIsLgUp";
import type {
  WritingAuthorRow,
  WritingArticleRow,
} from "@/services/analytics/writingAnalyticsService";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
);

const RANGE_OPTIONS = [
  { value: "7d", label: "7 hari" },
  { value: "30d", label: "30 hari" },
  { value: "90d", label: "90 hari" },
];

const ATTRIBUTION_OPTIONS = [
  { value: "consumption", label: "Berdasarkan waktu baca" },
  { value: "publish_cohort", label: "Berdasarkan waktu terbit" },
];

const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

function formatDisplayDate(dateStr: string): string {
  const parts = dateStr.split("-");
  if (parts.length < 3) return dateStr;
  const day = parseInt(parts[2], 10);
  const monthIndex = parseInt(parts[1], 10) - 1;
  return `${day} ${MONTHS_SHORT[monthIndex] ?? parts[1]}`;
}

function formatNumber(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("id-ID").format(value);
}

function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value == null || Number.isNaN(value)) return "n/a";
  return `${value.toFixed(digits)}%`;
}

function referrerLabel(cls: string): string {
  const map: Record<string, string> = {
    search: "Search",
    social: "Sosial",
    direct: "Direct",
    other: "Lainnya",
    admin: "Admin",
  };
  return map[cls] || cls;
}

export default function WritingAnalyticsPage() {
  const [mounted, setMounted] = useState(false);
  const [range, setRange] = useState("30d");
  const [attribution, setAttribution] = useState("consumption");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedAuthor, setSelectedAuthor] = useState<WritingAuthorRow | null>(
    null,
  );
  const [drawerOpen, setDrawerOpen] = useState(false);

  const isLgUp = useIsLgUp();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  useEffect(() => {
    setMounted(true);
  }, []);

  const summaryQuery = useWritingSummary({
    range,
    attribution,
    enabled: mounted,
  });

  const authorsQuery = useWritingAuthors({
    range,
    attribution,
    page: 1,
    limit: 50,
    sort: "pageviews",
    enabled: mounted,
  });

  const articlesQuery = useWritingArticles({
    range,
    attribution,
    page: 1,
    limit: 50,
    sort: "views",
    enabled: mounted,
  });

  useEffect(() => {
    if (summaryQuery.error) {
      toast.error(
        summaryQuery.error.response?.data?.error ||
          summaryQuery.error.message ||
          "Gagal memuat ringkasan penulis",
      );
    }
  }, [summaryQuery.error]);

  useEffect(() => {
    if (authorsQuery.error) {
      toast.error(
        authorsQuery.error.response?.data?.error ||
          authorsQuery.error.message ||
          "Gagal memuat leaderboard penulis",
      );
    }
  }, [authorsQuery.error]);

  useEffect(() => {
    if (articlesQuery.error) {
      toast.error(
        articlesQuery.error.response?.data?.error ||
          articlesQuery.error.message ||
          "Gagal memuat engagement artikel",
      );
    }
  }, [articlesQuery.error]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        summaryQuery.refetch(),
        authorsQuery.refetch(),
        articlesQuery.refetch(),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  };

  const summary = summaryQuery.data;
  const authorRows = authorsQuery.data?.rows ?? [];
  const articleRows = articlesQuery.data?.rows ?? [];

  const chartThemeColors = useMemo(() => {
    const textColor = isDark ? "#a3a3a3" : "#52525b";
    const gridColor = isDark
      ? "rgba(255, 255, 255, 0.08)"
      : "rgba(0, 0, 0, 0.06)";
    const tooltipBg = isDark ? "#202020" : "#ffffff";
    const tooltipBorder = isDark
      ? "rgba(255, 255, 255, 0.12)"
      : "rgba(0, 0, 0, 0.08)";
    return {
      textColor,
      gridColor,
      tooltipBg,
      tooltipBorder,
      tooltipTitleColor: isDark ? "#ffffff" : "#18181b",
      tooltipBodyColor: isDark ? "#d4d4d8" : "#27272a",
    };
  }, [isDark]);

  const series = useMemo(() => summary?.series ?? [], [summary?.series]);
  const ranking = useMemo(() => summary?.ranking ?? [], [summary?.ranking]);
  const categoryShare = useMemo(
    () => summary?.categoryShare ?? [],
    [summary?.categoryShare],
  );
  const referrerMix = useMemo(
    () => summary?.referrerMix ?? [],
    [summary?.referrerMix],
  );

  const outputViewsChart = useMemo(() => {
    return {
      labels: series.map((p) => formatDisplayDate(p.date)),
      datasets: [
        {
          type: "bar" as const,
          label: "Terbit",
          data: series.map((p) => p.published),
          backgroundColor: "#5c954e", // Hijau Sawah
          borderRadius: 4,
          maxBarThickness: 14,
          yAxisID: "y",
          order: 2,
        },
        {
          type: "line" as const,
          label: "Tayangan",
          data: series.map((p) => p.pageviews),
          borderColor: "#c16b4c",
          backgroundColor: "rgba(193, 107, 76, 0.08)",
          borderWidth: 2,
          tension: 0.35,
          pointRadius: 0,
          pointHoverRadius: 4,
          yAxisID: "y1",
          order: 1,
        },
      ],
    };
  }, [series]);

  const outputViewsOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index" as const, intersect: false },
      plugins: {
        legend: {
          position: "bottom" as const,
          labels: {
            color: chartThemeColors.textColor,
            boxWidth: 10,
            font: { family: "Rubik", size: 11 },
          },
        },
        tooltip: {
          backgroundColor: chartThemeColors.tooltipBg,
          titleColor: chartThemeColors.tooltipTitleColor,
          bodyColor: chartThemeColors.tooltipBodyColor,
          borderColor: chartThemeColors.tooltipBorder,
          borderWidth: 1,
          padding: 10,
          cornerRadius: 6,
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: chartThemeColors.textColor,
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 8,
            font: { family: "Rubik", size: 10 },
          },
        },
        y: {
          position: "left" as const,
          grid: { color: chartThemeColors.gridColor },
          ticks: {
            color: chartThemeColors.textColor,
            font: { family: "Rubik", size: 10 },
          },
          title: {
            display: true,
            text: "Terbit",
            color: chartThemeColors.textColor,
            font: { family: "Rubik", size: 10 },
          },
        },
        y1: {
          position: "right" as const,
          grid: { drawOnChartArea: false },
          ticks: {
            color: chartThemeColors.textColor,
            font: { family: "Rubik", size: 10 },
          },
          title: {
            display: true,
            text: "Tayangan",
            color: chartThemeColors.textColor,
            font: { family: "Rubik", size: 10 },
          },
        },
      },
    }),
    [chartThemeColors],
  );

  const rankingChart = useMemo(() => {
    const top = ranking.slice(0, 10);
    return {
      labels: top.map((r) => r.name),
      datasets: [
        {
          label: "Tayangan",
          data: top.map((r) => r.pageviews),
          backgroundColor: "#c16b4c", // Terakota
          borderRadius: 4,
          maxBarThickness: 18,
        },
      ],
    };
  }, [ranking]);

  const rankingOptions = useMemo(
    () => ({
      indexAxis: "y" as const,
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: chartThemeColors.tooltipBg,
          titleColor: chartThemeColors.tooltipTitleColor,
          bodyColor: chartThemeColors.tooltipBodyColor,
          borderColor: chartThemeColors.tooltipBorder,
          borderWidth: 1,
        },
      },
      scales: {
        x: {
          grid: { color: chartThemeColors.gridColor },
          ticks: {
            color: chartThemeColors.textColor,
            font: { family: "Rubik", size: 10 },
          },
        },
        y: {
          grid: { display: false },
          ticks: {
            color: chartThemeColors.textColor,
            font: { family: "Rubik", size: 10 },
          },
        },
      },
    }),
    [chartThemeColors],
  );

  const categoryChart = useMemo(() => {
    const top = categoryShare.slice(0, 8);
    return {
      labels: top.map((c) => c.category || "Tanpa kategori"),
      datasets: [
        {
          label: "Tayangan",
          data: top.map((c) => c.pageviews),
          backgroundColor: "#c16b4c",
          borderRadius: 4,
          maxBarThickness: 16,
        },
      ],
    };
  }, [categoryShare]);

  const referrerChart = useMemo(() => {
    return {
      labels: referrerMix.map((r) => referrerLabel(r.class)),
      datasets: [
        {
          label: "Share",
          data: referrerMix.map((r) => r.share),
          backgroundColor: "#5c954e", // Hijau Sawah
          borderRadius: 4,
          maxBarThickness: 20,
        },
      ],
    };
  }, [referrerMix]);

  const simpleBarOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: chartThemeColors.tooltipBg,
          titleColor: chartThemeColors.tooltipTitleColor,
          bodyColor: chartThemeColors.tooltipBodyColor,
          borderColor: chartThemeColors.tooltipBorder,
          borderWidth: 1,
          callbacks: {
            label: (ctx: { raw?: unknown; dataset?: { label?: string } }) => {
              const raw = typeof ctx.raw === "number" ? ctx.raw : 0;
              const label = ctx.dataset?.label || "";
              if (label === "Share") return `${label}: ${raw.toFixed(1)}%`;
              return `${label}: ${formatNumber(raw)}`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: chartThemeColors.textColor,
            font: { family: "Rubik", size: 10 },
            maxRotation: 45,
            autoSkip: true,
            maxTicksLimit: 8,
          },
        },
        y: {
          grid: { color: chartThemeColors.gridColor },
          ticks: {
            color: chartThemeColors.textColor,
            font: { family: "Rubik", size: 10 },
          },
        },
      },
    }),
    [chartThemeColors],
  );

  const openAuthorDrawer = (row: WritingAuthorRow) => {
    setSelectedAuthor(row);
    setDrawerOpen(true);
  };

  const authorColumns: ListTableColumn<WritingAuthorRow>[] = useMemo(
    () => [
      {
        key: "name",
        header: "Penulis",
        render: (row) => (
          <div className="flex items-center gap-3 min-w-0">
            <UserAvatar
              avatar={row.user.avatar}
              name={row.user.name || row.user.email || "Penulis"}
              className="h-9 w-9 shrink-0"
            />
            <div className="min-w-0">
              <p className="font-medium line-clamp-1">{row.user.name}</p>
              <p className="text-xs text-muted-foreground line-clamp-1 capitalize">
                {(row.user.role || "").replace(/-/g, " ")}
              </p>
            </div>
          </div>
        ),
      },
      {
        key: "published",
        header: "Terbit",
        render: (row) => (
          <span className="font-medium">{formatNumber(row.published)}</span>
        ),
      },
      {
        key: "pageviews",
        header: "Tayangan",
        className: "hidden sm:table-cell",
        render: (row) => (
          <span className="font-medium">{formatNumber(row.pageviews)}</span>
        ),
      },
      {
        key: "viewsPerArticle",
        header: "Views/Artikel",
        className: "hidden md:table-cell",
        render: (row) => (
          <span>{formatNumber(Math.round(row.viewsPerArticle))}</span>
        ),
      },
      {
        key: "contributionShare",
        header: "Kontribusi",
        className: "hidden md:table-cell",
        render: (row) => <span>{formatPercent(row.contributionShare)}</span>,
      },
      {
        key: "revisionRate",
        header: "Revisi",
        className: "hidden lg:table-cell",
        render: (row) => (
          <div className="flex flex-col">
            <span
              className={
                row.revisionRate > 15 ? "font-medium text-destructive" : "font-medium"
              }
            >
              {formatPercent(row.revisionRate)}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {row.rejectedCount}/{row.submittedCount} submit
            </span>
          </div>
        ),
      },
      {
        key: "mom",
        header: "vs periode lalu",
        className: "hidden xl:table-cell",
        render: (row) => (
          <div className="flex flex-col text-sm">
            <span>Terbit {formatVsPrevPeriod(row.momPublished)}</span>
            <span className="text-muted-foreground">
              Views {formatVsPrevPeriod(row.momPageviews)}
            </span>
          </div>
        ),
      },
      {
        key: "actions",
        header: <span className="float-right">Aksi</span>,
        className: "text-right",
        render: (row) => (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Detail ${row.user.name}`}
              onClick={() => openAuthorDrawer(row)}
            >
              <Eye className="h-4 w-4" />
            </Button>
          </div>
        ),
      },
    ],
    [],
  );

  const articlePage = articlesQuery.data?.page ?? 1;
  const articleLimit = articlesQuery.data?.limit ?? 50;

  const articleColumns: ListTableColumn<WritingArticleRow>[] = useMemo(
    () => [
      {
        key: "rowNumber",
        header: "No.",
        className: "w-10 text-center",
        render: (_row, idx) => (
          <span className="text-sm text-muted-foreground tabular-nums">
            {(articlePage - 1) * articleLimit + idx + 1}
          </span>
        ),
      },
      {
        key: "title",
        header: "Judul",
        render: (row) => (
          <div className="min-w-0 max-w-[280px] sm:max-w-md">
            <p className="font-medium line-clamp-2 leading-snug">{row.title}</p>
          </div>
        ),
      },
      {
        key: "authorName",
        header: "Penulis",
        className: "hidden sm:table-cell",
        render: (row) => (
          <span className="text-sm line-clamp-1">{row.authorName || "—"}</span>
        ),
      },
      {
        key: "categoryName",
        header: "Kategori",
        className: "hidden md:table-cell",
        render: (row) => (
          <span className="text-sm">{row.categoryName || "—"}</span>
        ),
      },
      {
        key: "status",
        header: "Status",
        className: "hidden md:table-cell",
        render: (row) => (
          <span className="inline-flex rounded-md border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide">
            {row.status}
          </span>
        ),
      },
      {
        key: "views",
        header: "Views periode",
        render: (row) => (
          <span className="font-medium">{formatNumber(row.views)}</span>
        ),
      },
      {
        key: "lifetimeViews",
        header: "Lifetime",
        className: "hidden sm:table-cell",
        render: (row) => (
          <span className="text-muted-foreground">
            {formatNumber(row.lifetimeViews)}
          </span>
        ),
      },
    ],
    [articlePage, articleLimit],
  );

  const attributionHint =
    attribution === "publish_cohort"
      ? "Berdasarkan waktu terbit: views dihitung hanya untuk artikel yang terbit di rentang ini."
      : "Berdasarkan waktu baca: views di rentang waktu, terlepas kapan artikel terbit.";

  return (
    <div className="min-w-0 max-w-full space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1 min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">Kinerja Penulis</h1>
          <p className="text-sm text-muted-foreground">
            Cockpit performa output dan audience. Penulis = siapa pun yang punya
            authorId di rentang (role CMS hanya label).
          </p>
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Select value={range} onValueChange={setRange}>
              <SelectTrigger className="w-[140px] h-9 bg-background text-xs">
                <SelectValue placeholder="Rentang" />
              </SelectTrigger>
              <SelectContent>
                {RANGE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={attribution} onValueChange={setAttribution}>
              <SelectTrigger className="w-[200px] h-9 bg-background text-xs">
                <SelectValue placeholder="Atribusi" />
              </SelectTrigger>
              <SelectContent>
                {ATTRIBUTION_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={handleRefresh}
              disabled={isRefreshing}
              aria-label="Refresh data"
            >
              <RefreshCw
                className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground text-right max-w-md">
            {attributionHint}
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        <MetricCard
          label="Penulis aktif"
          value={
            summaryQuery.isLoading
              ? "…"
              : formatNumber(summary?.activeWriters)
          }
        />
        <MetricCard
          label="Artikel terbit"
          value={
            summaryQuery.isLoading ? "…" : formatNumber(summary?.published)
          }
          hint={`vs periode lalu ${formatVsPrevPeriod(summary?.mom.published)}`}
        />
        <MetricCard
          label="Tayangan"
          value={
            summaryQuery.isLoading ? "…" : formatNumber(summary?.pageviews)
          }
          hint={`vs periode lalu ${formatVsPrevPeriod(summary?.mom.pageviews)}`}
        />
        <MetricCard
          label="Views / artikel"
          value={
            summaryQuery.isLoading
              ? "…"
              : formatNumber(Math.round(summary?.viewsPerArticle ?? 0))
          }
        />
        <MetricCard
          label="Approx unik"
          value={
            summaryQuery.isLoading
              ? "…"
              : formatNumber(summary?.approxUniques)
          }
        />
      </div>

      {summary?.alerts ? <AlertRail alerts={summary.alerts} /> : null}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        <div className="bg-card border border-border rounded-xl p-3 sm:p-4 shadow-xs min-w-0">
          <h2 className="text-sm font-semibold mb-2">Output vs Tayangan</h2>
          <ChartState
            loading={summaryQuery.isLoading}
            error={
              summaryQuery.error
                ? summaryQuery.error.response?.data?.error ||
                  "Gagal memuat grafik"
                : null
            }
            empty={!series.length}
            emptyText="Belum ada tren di rentang ini"
            onRetry={() => summaryQuery.refetch()}
          >
            <div className="h-[220px] sm:h-[280px]">
              <Bar data={outputViewsChart as never} options={outputViewsOptions} />
            </div>
          </ChartState>
        </div>

        <div className="bg-card border border-border rounded-xl p-3 sm:p-4 shadow-xs min-w-0">
          <h2 className="text-sm font-semibold mb-2">Ranking penulis (top 10)</h2>
          <ChartState
            loading={summaryQuery.isLoading}
            error={
              summaryQuery.error
                ? summaryQuery.error.response?.data?.error ||
                  "Gagal memuat grafik"
                : null
            }
            empty={!ranking.length}
            emptyText="Belum ada ranking"
            onRetry={() => summaryQuery.refetch()}
          >
            <div className="h-[220px] sm:h-[280px]">
              <Bar data={rankingChart} options={rankingOptions} />
            </div>
          </ChartState>
        </div>

        <div className="bg-card border border-border rounded-xl p-3 sm:p-4 shadow-xs min-w-0">
          <h2 className="text-sm font-semibold mb-2">Porsi kategori</h2>
          <ChartState
            loading={summaryQuery.isLoading}
            error={
              summaryQuery.error
                ? summaryQuery.error.response?.data?.error ||
                  "Gagal memuat grafik"
                : null
            }
            empty={
              !categoryShare.some((c) => c.pageviews > 0 || c.published > 0)
            }
            emptyText="Belum ada sebaran kategori"
            onRetry={() => summaryQuery.refetch()}
          >
            <div className="h-[220px] sm:h-[280px]">
              <Bar data={categoryChart} options={simpleBarOptions} />
            </div>
          </ChartState>
        </div>

        <div className="bg-card border border-border rounded-xl p-3 sm:p-4 shadow-xs min-w-0">
          <h2 className="text-sm font-semibold mb-2">Referrer mix</h2>
          <ChartState
            loading={summaryQuery.isLoading}
            error={
              summaryQuery.error
                ? summaryQuery.error.response?.data?.error ||
                  "Gagal memuat grafik"
                : null
            }
            empty={!referrerMix.length}
            emptyText="Belum ada data referrer"
            onRetry={() => summaryQuery.refetch()}
          >
            <div className="h-[220px] sm:h-[280px]">
              <Bar data={referrerChart} options={simpleBarOptions} />
            </div>
          </ChartState>
        </div>
      </div>

      {/* Leaderboard */}
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Leaderboard penulis
          </h2>
          <p className="text-xs text-muted-foreground">
            Kontribusi output dan audience per penulis (tanpa ADMIN).
          </p>
        </div>
        <div className="bg-card rounded-xl border border-border overflow-x-auto shadow-xs min-w-0">
          <ListTable
            columns={authorColumns}
            data={authorRows}
            loading={authorsQuery.isLoading}
            emptyText="Tidak ada data penulis untuk filter ini."
            rowKey={(row) => row.userId}
            compact
          />
        </div>
      </section>

      {/* Articles engagement */}
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Engagement artikel
          </h2>
          <p className="text-xs text-muted-foreground">
            Views periode mengikuti mode atribusi yang dipilih.
          </p>
        </div>
        <div className="bg-card rounded-xl border border-border overflow-x-auto shadow-xs min-w-0">
          <ListTable
            columns={articleColumns}
            data={articleRows}
            loading={articlesQuery.isLoading}
            emptyText="Tidak ada artikel untuk filter ini."
            rowKey={(row) => row.articleId}
            compact
          />
        </div>
      </section>

      <Drawer
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open);
          if (!open) setSelectedAuthor(null);
        }}
        direction={isLgUp ? "right" : "bottom"}
      >
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader>
            <DrawerTitle>Detail penulis</DrawerTitle>
            <DrawerDescription>
              Ringkasan dasar performa pada filter aktif.
            </DrawerDescription>
          </DrawerHeader>
          {selectedAuthor ? (
            <div className="px-4 pb-6 space-y-4 overflow-y-auto">
              <div className="flex items-center gap-3">
                <UserAvatar
                  avatar={selectedAuthor.user.avatar}
                  name={selectedAuthor.user.name}
                  className="h-12 w-12 shrink-0"
                />
                <div className="min-w-0">
                  <p className="font-semibold line-clamp-1">
                    {selectedAuthor.user.name}
                  </p>
                  <p className="text-sm text-muted-foreground line-clamp-1">
                    {selectedAuthor.user.email}
                  </p>
                  <p className="text-xs text-muted-foreground capitalize mt-0.5">
                    {(selectedAuthor.user.role || "").replace(/-/g, " ")}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <MetricCard
                  label="Terbit"
                  value={formatNumber(selectedAuthor.published)}
                  hint={`vs periode lalu ${formatVsPrevPeriod(selectedAuthor.momPublished)}`}
                />
                <MetricCard
                  label="Tayangan"
                  value={formatNumber(selectedAuthor.pageviews)}
                  hint={`vs periode lalu ${formatVsPrevPeriod(selectedAuthor.momPageviews)}`}
                />
                <MetricCard
                  label="Views / artikel"
                  value={formatNumber(
                    Math.round(selectedAuthor.viewsPerArticle),
                  )}
                />
                <MetricCard
                  label="Kontribusi"
                  value={formatPercent(selectedAuthor.contributionShare)}
                />
                <MetricCard
                  label="Revision rate"
                  value={formatPercent(selectedAuthor.revisionRate)}
                  hint={`${selectedAuthor.rejectedCount} revisi / ${selectedAuthor.submittedCount} submit`}
                />
                <MetricCard
                  label="Kanal utama"
                  value={
                    <span className="text-lg sm:text-xl">
                      {selectedAuthor.categoryTop || "—"}
                    </span>
                  }
                />
              </div>
            </div>
          ) : null}
        </DrawerContent>
      </Drawer>
    </div>
  );
}
