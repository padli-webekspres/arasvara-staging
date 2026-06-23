"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  Eye,
  Users,
  Activity,
  Calendar,
  RefreshCw,
  LayoutList,
  Tag,
  GitFork,
  Search,
  Filter,
} from "lucide-react";
import {
  useAudienceTrafficTrend,
  TrafficTrendDataPoint,
} from "@/hooks/useAudienceTrafficTrend";
import {
  useAudienceDistribution,
  CategoryDistributionItem,
} from "@/hooks/useAudienceDistribution";
import { useAudienceEngagement, ArticleEngagementReport } from "@/hooks/useAudienceEngagement";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ListTable, ListTableColumn } from "@/components/table/ListTable";
import { useTheme } from "next-themes";

// Impor Chart.js dan react-chartjs-2
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line, Doughnut } from "react-chartjs-2";

// Daftarkan komponen inti Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
);

/**
 * Helper untuk menghitung tanggal awal (startDate) berdasarkan tipe rentang waktu yang dipilih
 */
function getDateRange(rangeType: string) {
  const end = new Date();
  const start = new Date();
  if (rangeType === "7d") {
    start.setDate(end.getDate() - 7);
  } else if (rangeType === "30d") {
    start.setDate(end.getDate() - 30);
  } else if (rangeType === "90d") {
    start.setDate(end.getDate() - 90);
  } else if (rangeType === "this_year") {
    start.setMonth(0, 1); // 1 Januari tahun ini
    start.setHours(0, 0, 0, 0);
  }
  return {
    startDate: start.toISOString().split("T")[0],
    endDate: end.toISOString().split("T")[0],
  };
}

/**
 * Format string tanggal MongoDB menjadi label tampilan yang bersih dan ringkas di X-Axis
 */
function formatDisplayDate(
  dateStr: string,
  interval: "daily" | "weekly" | "monthly",
): string {
  if (interval === "daily") {
    const parts = dateStr.split("-");
    if (parts.length < 3) return dateStr;
    const day = parseInt(parts[2], 10);
    const monthIndex = parseInt(parts[1], 10) - 1;
    const months = [
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
    return `${day} ${months[monthIndex]}`;
  } else if (interval === "weekly") {
    const parts = dateStr.split("-");
    return parts[1] || dateStr; // e.g. "W21"
  } else if (interval === "monthly") {
    const parts = dateStr.split("-");
    if (parts.length < 2) return dateStr;
    const yearShort = parts[0].slice(2);
    const monthIndex = parseInt(parts[1], 10) - 1;
    const months = [
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
    return `${months[monthIndex]} '${yearShort}`;
  }
  return dateStr;
}

// Konstanta Label Format
const FORMAT_LABEL: Record<string, string> = {
  STANDARD: "Standard",
  GALLERY: "Galeri",
};

// Palet warna kategori populer (5 warna premium yang harmonis dengan terakota dan hijau sawah)
const warnaKategori = [
  "#5c954e", // Hijau Sawah (Utama)
  "#c16b4c", // Terakota (Utama)
  "#dcae61", // Warm Gold
  "#5fa1aa", // Slate Teal
  "#bb6b7e", // Dusty Rose
  "#8b5cf6", // Violet (fallback)
  "#3b82f6", // Blue (fallback)
];

// ─── Komponen Legend Row untuk Format ──────────────────────────────────────

interface FormatLegendRowProps {
  label: string;
  views: number;
  percentage: number;
  color: string;
}

function FormatLegendRow({
  label,
  views,
  percentage,
  color,
}: FormatLegendRowProps) {
  return (
    <div className="flex items-center gap-3 py-1 text-xs">
      {/* Warna Bullet */}
      <span
        className="w-2.5 h-2.5 rounded-full shrink-0 transition-transform duration-300 hover:scale-125"
        style={{ backgroundColor: color }}
      />
      {/* Label Format */}
      <span className="font-medium flex-1 text-foreground/90">{label}</span>
      {/* Views & Persentase */}
      <span className="text-muted-foreground shrink-0 text-right font-medium">
        {views.toLocaleString("id-ID")} ({percentage}%)
      </span>
    </div>
  );
}

// ─── Komponen Legend Row untuk Kategori ────────────────────────────────────

interface CategoryLegendRowProps {
  item: CategoryDistributionItem;
  rank: number;
  color: string;
}

function CategoryLegendRow({ item, rank, color }: CategoryLegendRowProps) {
  return (
    <div className="flex items-center gap-3 py-1 text-xs hover:bg-muted/35 rounded-sm px-1.5 transition-colors">
      {/* Warna Bullet */}
      <span
        className="w-2.5 h-2.5 rounded-full shrink-0 transition-transform duration-300 hover:scale-125"
        style={{ backgroundColor: color }}
      />
      {/* Peringkat */}
      <span className="font-bold text-muted-foreground w-4 shrink-0">
        {rank}
      </span>
      {/* Nama Kategori */}
      <span className="font-medium truncate flex-1 text-foreground/90 pr-2">
        {item.categoryName}
      </span>
      {/* Views & Persentase */}
      <span className="text-muted-foreground shrink-0 text-right font-medium">
        {item.views.toLocaleString("id-ID")} ({item.percentage}%)
      </span>
    </div>
  );
}

// ─── Halaman Utama ────────────────────────────────────────────────────────────

export default function AudienceAnalyticsPage() {
  const [mounted, setMounted] = useState(false);
  const [range, setRange] = useState("30d");
  const [interval, setInterval] = useState<"daily" | "weekly" | "monthly">(
    "daily",
  );

  // State untuk Engagement Tabel
  const [engagementSearchInput, setEngagementSearchInput] = useState("");
  const [engagementSearch, setEngagementSearch] = useState("");
  const [engagementFormat, setEngagementFormat] = useState("ALL");
  const [engagementPage, setEngagementPage] = useState(1);

  // Debounce untuk Search Engagement
  useEffect(() => {
    const timer = setTimeout(() => {
      setEngagementSearch(engagementSearchInput);
      setEngagementPage(1); // Reset page setiap kali keyword berubah
    }, 500);
    return () => clearTimeout(timer);
  }, [engagementSearchInput]);

  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  // Mount check untuk menghindari Next.js SSR hidrasi error saat memuat Chart.js
  useEffect(() => {
    setMounted(true);
  }, []);

  // Hitung range tanggal berdasarkan pilihan dropdown
  const { startDate, endDate } = useMemo(() => getDateRange(range), [range]);

  // React Query Hook untuk fetch data tren
  const {
    data: apiResponse,
    isLoading,
    error,
    refetch,
  } = useAudienceTrafficTrend({
    startDate,
    endDate,
    interval,
    enabled: mounted,
  });

  // React Query Hook untuk fetch data distribusi
  const { data: distributionResponse, isLoading: isDistributionLoading } =
    useAudienceDistribution({
      startDate,
      endDate,
      enabled: mounted,
    });

  // React Query Hook untuk fetch data Engagement
  const { data: engagementResponse, isLoading: isEngagementLoading } =
    useAudienceEngagement({
      page: engagementPage,
      limit: 10,
      search: engagementSearch,
      format: engagementFormat === "ALL" ? "" : engagementFormat,
      enabled: mounted,
    });

  const trendData = apiResponse?.data || [];
  const distribution = distributionResponse?.data ?? null;
  const engagementData = engagementResponse?.data?.data || [];
  const engagementTotalPages = engagementResponse?.data?.totalPages || 1;

  // Hitung total metrik ringkasan untuk Summary Cards
  const summaryMetrics = useMemo(() => {
    if (trendData.length === 0)
      return { totalViews: 0, totalVisitors: 0, avgEngagement: 0 };

    let totalViews = 0;
    let totalVisitors = 0;

    trendData.forEach((point) => {
      totalViews += point.views;
      totalVisitors += point.uniqueVisitors;
    });

    const avgEngagement =
      totalVisitors > 0
        ? parseFloat((totalViews / totalVisitors).toFixed(1))
        : 0;

    return { totalViews, totalVisitors, avgEngagement };
  }, [trendData]);

  // Definisikan Kolom untuk Tabel Engagement
  const engagementColumns: ListTableColumn<ArticleEngagementReport>[] = useMemo(
    () => [
      {
        key: "title",
        header: "Judul Artikel",
        className: "min-w-0",
        render: (row) => (
          <div className="flex flex-col min-w-0">
            <span className="font-semibold text-foreground/90 truncate max-w-[12rem] md:max-w-xs lg:max-w-md">
              {row.title}
            </span>
            <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
              <span>{row.authorName}</span>
              <span className="w-1 h-1 rounded-full bg-muted-foreground/40" />
              <span>{row.categoryName}</span>
            </div>
          </div>
        ),
      },
      {
        key: "format",
        header: "Format",
        className: "hidden md:table-cell",
        render: (row) => (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold text-white ${
              row.format === "GALLERY" ? "bg-terakota" : "bg-hijauSawah"
            }`}
          >
            {FORMAT_LABEL[row.format] ?? row.format}
          </span>
        ),
      },
      {
        key: "totalViews",
        header: <div className="text-right">LTV (Total Views)</div>,
        className: "text-right hidden lg:table-cell",
        render: (row) => (
          <span className="font-medium">{row.totalViews.toLocaleString("id-ID")}</span>
        ),
      },
      {
        key: "viewsLast30Days",
        header: <div className="text-right">Views (30d)</div>,
        className: "text-right hidden lg:table-cell",
        render: (row) => (
          <span className="font-medium text-indigo-500">
            {row.viewsLast30Days.toLocaleString("id-ID")}
          </span>
        ),
      },
    ],
    []
  );

  // ─── Chart.js Dinamis Kustomisasi Tema (Indah & Presisi) ─────────────────────

  const chartThemeColors = useMemo(() => {
    const textColor = isDark ? "#a3a3a3" : "#52525b"; // zinc-400 vs zinc-600
    const gridColor = isDark
      ? "rgba(255, 255, 255, 0.08)"
      : "rgba(0, 0, 0, 0.06)";
    const tooltipBg = isDark ? "#202020" : "#ffffff";
    const tooltipBorder = isDark
      ? "rgba(255, 255, 255, 0.12)"
      : "rgba(0, 0, 0, 0.08)";
    const tooltipTitleColor = isDark ? "#ffffff" : "#18181b";
    const tooltipBodyColor = isDark ? "#d4d4d8" : "#27272a";

    return {
      textColor,
      gridColor,
      tooltipBg,
      tooltipBorder,
      tooltipTitleColor,
      tooltipBodyColor,
    };
  }, [isDark]);

  // ─── 1. Data & Opsi Grafik Garis (Line Chart) ──────────────────────────────────

  const lineChartData = useMemo(() => {
    const labels = trendData.map((d) => formatDisplayDate(d.date, interval));

    return {
      labels,
      datasets: [
        {
          label: "Total Tayangan",
          data: trendData.map((d) => d.views),
          borderColor: "#c16b4c", // Terakota
          backgroundColor: "rgba(193, 107, 76, 0.06)", // Soft terakota gradient fill
          fill: true,
          tension: 0.35, // Kurva halus bergelombang (bezier)
          borderWidth: 2,
          pointBackgroundColor: "#c16b4c",
          pointBorderColor: isDark ? "#202020" : "#ffffff",
          pointBorderWidth: 1,
          pointHoverRadius: 6,
          pointHoverBackgroundColor: "#c16b4c",
          pointHoverBorderColor: "#ffffff",
          pointHoverBorderWidth: 2,
        },
        {
          label: "Pengunjung Unik",
          data: trendData.map((d) => d.uniqueVisitors),
          borderColor: "#5c954e", // Hijau Sawah
          backgroundColor: "rgba(92, 149, 78, 0.06)", // Soft hijau sawah gradient fill
          fill: true,
          tension: 0.35,
          borderWidth: 2,
          pointBackgroundColor: "#5c954e",
          pointBorderColor: isDark ? "#202020" : "#ffffff",
          pointBorderWidth: 1,
          pointHoverRadius: 6,
          pointHoverBackgroundColor: "#5c954e",
          pointHoverBorderColor: "#ffffff",
          pointHoverBorderWidth: 2,
        },
      ],
    };
  }, [trendData, interval, isDark]);

  const lineOptions = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index" as const,
        intersect: false,
      },
      plugins: {
        legend: {
          display: false, // Disembunyikan karena sudah ada HTML legend kustom di atas card
        },
        tooltip: {
          backgroundColor: chartThemeColors.tooltipBg,
          titleColor: chartThemeColors.tooltipTitleColor,
          bodyColor: chartThemeColors.tooltipBodyColor,
          borderColor: chartThemeColors.tooltipBorder,
          borderWidth: 1,
          padding: 12,
          cornerRadius: 8,
          titleFont: {
            family: "Rubik",
            weight: "bold" as const,
          },
          bodyFont: {
            family: "Rubik",
          },
          callbacks: {
            label: function (context: any) {
              const value = context.raw as number;
              return ` ${context.dataset.label}: ${value.toLocaleString("id-ID")}`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: {
            display: false,
          },
          ticks: {
            color: chartThemeColors.textColor,
            font: {
              family: "Rubik",
              size: 11,
            },
          },
        },
        y: {
          grid: {
            color: chartThemeColors.gridColor,
          },
          ticks: {
            color: chartThemeColors.textColor,
            font: {
              family: "Rubik",
              size: 11,
            },
            callback: function (value: any) {
              return value.toLocaleString("id-ID");
            },
          },
        },
      },
      animation: {
        duration: 1200,
        easing: "easeOutQuart" as const,
      },
    };
  }, [chartThemeColors]);

  // ─── 2. Data & Opsi Doughnut Chart: Format Artikel ─────────────────────────

  const formatChartData = useMemo(() => {
    if (!distribution || distribution.formatDistribution.length === 0)
      return null;

    const labels = distribution.formatDistribution.map(
      (item) => FORMAT_LABEL[item.format] ?? item.format,
    );
    const data = distribution.formatDistribution.map((item) => item.views);
    const backgroundColor = distribution.formatDistribution.map((item) =>
      item.format === "STANDARD" ? "#5c954e" : "#c16b4c",
    );

    return {
      labels,
      datasets: [
        {
          data,
          backgroundColor,
          borderWidth: 1.5,
          borderColor: isDark ? "#202020" : "#ffffff",
          hoverOffset: 6,
        },
      ],
    };
  }, [distribution, isDark]);

  // ─── 3. Data & Opsi Doughnut Chart: Kategori Populer ────────────────────────

  const categoryChartData = useMemo(() => {
    if (!distribution || distribution.categoryDistribution.length === 0)
      return null;

    const labels = distribution.categoryDistribution.map(
      (item) => item.categoryName,
    );
    const data = distribution.categoryDistribution.map((item) => item.views);
    const backgroundColor = distribution.categoryDistribution.map(
      (_, index) => warnaKategori[index % warnaKategori.length],
    );

    return {
      labels,
      datasets: [
        {
          data,
          backgroundColor,
          borderWidth: 1.5,
          borderColor: isDark ? "#202020" : "#ffffff",
          hoverOffset: 6,
        },
      ],
    };
  }, [distribution, isDark]);

  // Opsi Bersama untuk Doughnut Charts
  const doughnutOptions = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false, // Sembunyikan default, pakai Legend Row HTML kustom untuk layout yang super-fluid
        },
        tooltip: {
          backgroundColor: chartThemeColors.tooltipBg,
          titleColor: chartThemeColors.tooltipTitleColor,
          bodyColor: chartThemeColors.tooltipBodyColor,
          borderColor: chartThemeColors.tooltipBorder,
          borderWidth: 1,
          padding: 10,
          cornerRadius: 8,
          titleFont: {
            family: "Rubik",
            weight: "bold" as const,
          },
          bodyFont: {
            family: "Rubik",
          },
          callbacks: {
            label: function (context: any) {
              const value = context.raw as number;
              return ` ${context.label}: ${value.toLocaleString("id-ID")} views`;
            },
          },
        },
      },
      cutout: "70%", // Ring donat cincin modern (sleek & space-efficient)
      animation: {
        animateScale: true,
        animateRotate: true,
        duration: 1000,
        easing: "easeOutCirc" as const,
      },
    };
  }, [chartThemeColors]);

  // Loading Skeleton Effect
  if (isLoading || !mounted) {
    return (
      <div className="space-y-6 animate-pulse p-4">
        <div className="flex justify-between items-center gap-4">
          <div className="space-y-2 w-1/3">
            <div className="h-8 bg-muted rounded"></div>
            <div className="h-4 bg-muted rounded w-2/3"></div>
          </div>
          <div className="h-10 bg-muted rounded w-24"></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-28 bg-muted rounded-lg border"></div>
          <div className="h-28 bg-muted rounded-lg border"></div>
          <div className="h-28 bg-muted rounded-lg border"></div>
        </div>

        <div className="h-[450px] bg-muted rounded-lg border"></div>
      </div>
    );
  }

  // Error Handling
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[500px] border border-dashed rounded-lg p-6 space-y-4 text-center">
        <div className="p-3 bg-destructive/10 text-destructive rounded-full">
          <RefreshCw className="h-8 w-8 animate-spin" />
        </div>
        <h3 className="text-lg font-semibold">Gagal Memuat Analitik</h3>
        <p className="text-muted-foreground max-w-sm">
          {error instanceof Error
            ? error.message
            : "Terjadi kesalahan saat memuat data tayangan audiens."}
        </p>
        <Button variant="outline" onClick={() => refetch()} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Coba Lagi
        </Button>
      </div>
    );
  }

  return (
    <div className="min-w-0 max-w-full space-y-4 sm:space-y-6">
      {/* Header Halaman */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Audience Analytics & Traffic
          </h1>
          <p className="text-sm text-muted-foreground">
            Analisis mendalam mengenai tren kunjungan situs, tayangan artikel,
            dan pengunjung unik.
          </p>
        </div>

        {/* Dropdown Filters (shadcn Select) */}
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* Filter Rentang Tanggal */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1 shrink-0">
              <Calendar className="h-3 w-3" /> Rentang:
            </span>
            <Select value={range} onValueChange={setRange}>
              <SelectTrigger className="w-full sm:w-[150px] h-9">
                <SelectValue placeholder="Pilih Rentang" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">7 Hari Terakhir</SelectItem>
                <SelectItem value="30d">30 Hari Terakhir</SelectItem>
                <SelectItem value="90d">90 Hari Terakhir</SelectItem>
                <SelectItem value="this_year">Tahun Ini</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Filter Interval Agregasi */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1 shrink-0">
              <Activity className="h-3 w-3" /> Tampilan:
            </span>
            <Select
              value={interval}
              onValueChange={(val) =>
                setInterval(val as "daily" | "weekly" | "monthly")
              }
            >
              <SelectTrigger className="w-full sm:w-[120px] h-9">
                <SelectValue placeholder="Pilih Tampilan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Harian</SelectItem>
                <SelectItem value="weekly">Mingguan</SelectItem>
                <SelectItem value="monthly">Bulanan</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* KPI Ringkasan Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card Total Tayangan */}
        <div className="bg-card text-card-foreground border border-border rounded-lg shadow-xs p-6 flex items-center justify-between transition-all hover:shadow-sm">
          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Total Tayangan
            </span>
            <h2 className="text-3xl font-bold tracking-tight">
              {summaryMetrics.totalViews.toLocaleString("id-ID")}
            </h2>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <span className="text-green-500 font-medium">Views</span> dari
              seluruh konten
            </p>
          </div>
          <div className="p-3.5 bg-primary/10 text-primary rounded-full">
            <Eye className="h-5 w-5" />
          </div>
        </div>

        {/* Card Pengunjung Unik */}
        <div className="bg-card text-card-foreground border border-border rounded-lg shadow-xs p-6 flex items-center justify-between transition-all hover:shadow-sm">
          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Pengunjung Unik
            </span>
            <h2 className="text-3xl font-bold tracking-tight">
              {summaryMetrics.totalVisitors.toLocaleString("id-ID")}
            </h2>
            <p className="text-xs text-muted-foreground">
              Unique visitors terdeteksi
            </p>
          </div>
          <div className="p-3.5 bg-indigo-500/10 text-indigo-500 rounded-full">
            <Users className="h-5 w-5" />
          </div>
        </div>

        {/* Card Rasio Kunjungan */}
        <div className="bg-card text-card-foreground border border-border rounded-lg shadow-xs p-6 flex items-center justify-between transition-all hover:shadow-sm">
          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Rasio Kunjungan
            </span>
            <h2 className="text-3xl font-bold tracking-tight">
              {summaryMetrics.avgEngagement}x
            </h2>
            <p className="text-xs text-muted-foreground">
              Rata-rata tayangan per pengunjung
            </p>
          </div>
          <div className="p-3.5 bg-emerald-500/10 text-emerald-500 rounded-full">
            <Activity className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Card Utama Line Chart */}
      <div className="bg-card text-card-foreground border border-border rounded-lg shadow-sm p-6 space-y-4 transition-all">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold tracking-tight">
              Tren Tayangan & Pengunjung Unik
            </h3>
            <p className="text-xs text-muted-foreground">
              Grafik garis pembanding antara total klik tayang (views) dengan
              jumlah pengunjung unik.
            </p>
          </div>

          {/* Legend Indikator Custom */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 text-xs font-medium">
            <div className="flex items-center gap-1.5 cursor-default hover:opacity-85 transition-opacity">
              <span className="h-3 w-3 rounded-full bg-[#c16b4c] inline-block"></span>
              <span>Total Tayangan</span>
            </div>
            <div className="flex items-center gap-1.5 cursor-default hover:opacity-85 transition-opacity">
              <span className="h-3 w-3 rounded-full bg-[#5c954e] inline-block"></span>
              <span>Pengunjung Unik</span>
            </div>
          </div>
        </div>

        {/* Line Chart Box (Chart.js) */}
        <div className="w-full min-w-0 h-[220px] sm:h-[280px] relative mt-4">
          {trendData.length > 0 ? (
            <Line data={lineChartData} options={lineOptions} />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground space-y-2 border border-dashed rounded-lg">
              <RefreshCw className="h-5 w-5 text-muted-foreground/60 animate-spin" />
              <span className="text-sm">
                Tidak ada data traffic pada rentang yang dipilih.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ─── Distribution Cards (Format, Kategori, Korelasi) ─────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Format Distribution (DOUGHNUT CHART) */}
        <div className="bg-card text-card-foreground border border-border rounded-lg shadow-xs p-6 space-y-4 transition-all hover:shadow-sm flex flex-col justify-between min-h-[360px]">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h3 className="text-sm font-semibold tracking-tight">
                Format Artikel
              </h3>
              <p className="text-xs text-muted-foreground">
                Distribusi views: Standard vs Galeri
              </p>
            </div>
            <div className="p-2.5 bg-primary/10 text-primary rounded-full shrink-0">
              <LayoutList className="h-4 w-4" />
            </div>
          </div>

          {/* Body */}
          {isDistributionLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center space-y-3 animate-pulse py-10">
              <div className="h-28 bg-muted rounded-full w-28" />
              <div className="h-4 bg-muted rounded w-2/3" />
            </div>
          ) : !distribution || distribution.formatDistribution.length === 0 ? (
            <div className="flex-1 flex items-center justify-center py-10">
              <p className="text-xs text-muted-foreground text-center">
                Tidak ada data pada rentang ini.
              </p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col justify-center space-y-4 pt-2">
              {/* Container Donut Chart */}
              <div className="w-full h-[150px] relative">
                {formatChartData && (
                  <Doughnut data={formatChartData} options={doughnutOptions} />
                )}
              </div>

              {/* Custom Legend Row */}
              <div className="space-y-1.5 border-t border-border/60 pt-3">
                {distribution.formatDistribution.map((item) => {
                  const color =
                    item.format === "STANDARD" ? "#5c954e" : "#c16b4c";
                  return (
                    <FormatLegendRow
                      key={item.format}
                      label={FORMAT_LABEL[item.format] ?? item.format}
                      views={item.views}
                      percentage={item.percentage}
                      color={color}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Card 2: Category Distribution (DOUGHNUT CHART) */}
        <div className="bg-card text-card-foreground border border-border rounded-lg shadow-xs p-6 space-y-4 transition-all hover:shadow-sm flex flex-col justify-between min-h-[360px]">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h3 className="text-sm font-semibold tracking-tight">
                Kategori Populer
              </h3>
              <p className="text-xs text-muted-foreground">
                Top kategori berdasarkan jumlah views
              </p>
            </div>
            <div className="p-2.5 bg-emerald-500/10 text-emerald-500 rounded-full shrink-0">
              <Tag className="h-4 w-4" />
            </div>
          </div>

          {/* Body */}
          {isDistributionLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center space-y-3 animate-pulse py-10">
              <div className="h-28 bg-muted rounded-full w-28" />
              <div className="h-4 bg-muted rounded w-2/3" />
            </div>
          ) : !distribution ||
            distribution.categoryDistribution.length === 0 ? (
            <div className="flex-1 flex items-center justify-center py-10">
              <p className="text-xs text-muted-foreground text-center">
                Tidak ada data pada rentang ini.
              </p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col justify-center space-y-4 pt-2">
              {/* Container Donut Chart */}
              <div className="w-full h-[150px] relative">
                {categoryChartData && (
                  <Doughnut
                    data={categoryChartData}
                    options={doughnutOptions}
                  />
                )}
              </div>

              {/* Custom Legend Row */}
              <div className="space-y-1 border-t border-border/60 pt-3 max-h-[120px] overflow-y-auto custom-scrollbar pr-1">
                {distribution.categoryDistribution.map((item, index) => {
                  const color = warnaKategori[index % warnaKategori.length];
                  return (
                    <CategoryLegendRow
                      key={item.categoryId}
                      item={item}
                      rank={index + 1}
                      color={color}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Card 3: Cross-Correlation (Format × Kategori) - TETAP TABEL */}
        <div className="bg-card text-card-foreground border border-border rounded-lg shadow-xs p-6 space-y-4 transition-all hover:shadow-sm flex flex-col justify-between min-h-[360px]">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h3 className="text-sm font-semibold tracking-tight">
                Korelasi Silang
              </h3>
              <p className="text-xs text-muted-foreground">
                Format vs kategori (top 5 kategori)
              </p>
            </div>
            <div className="p-2.5 bg-indigo-500/10 text-indigo-500 rounded-full shrink-0">
              <GitFork className="h-4 w-4" />
            </div>
          </div>

          {/* Body */}
          {isDistributionLoading ? (
            <div className="flex-1 flex flex-col justify-center space-y-2 animate-pulse py-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-6 bg-muted rounded" />
              ))}
            </div>
          ) : !distribution || distribution.crossCorrelation.length === 0 ? (
            <div className="flex-1 flex items-center justify-center py-10">
              <p className="text-xs text-muted-foreground text-center">
                Tidak ada data pada rentang ini.
              </p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col justify-center pt-2">
              <div className="overflow-x-auto max-h-[280px] overflow-y-auto custom-scrollbar pr-1">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left font-semibold text-muted-foreground pb-2 pr-2">
                        Format
                      </th>
                      <th className="text-left font-semibold text-muted-foreground pb-2 pr-2">
                        Kategori
                      </th>
                      <th className="text-right font-semibold text-muted-foreground pb-2">
                        Views
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {distribution.crossCorrelation.map((row, index) => (
                      <tr
                        key={`${row.format}-${row.categoryName}-${index}`}
                        className="hover:bg-muted/40 transition-colors"
                      >
                        <td className="py-2 pr-2">
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold text-white transition-opacity hover:opacity-85 ${
                              row.format === "GALLERY"
                                ? "bg-terakota"
                                : "bg-hijauSawah"
                            }`}
                          >
                            {FORMAT_LABEL[row.format] ?? row.format}
                          </span>
                        </td>
                        <td className="py-2 pr-2 text-foreground/80 truncate max-w-[100px] font-medium">
                          {row.categoryName}
                        </td>
                        <td className="py-2 text-right font-semibold text-foreground/90">
                          {row.views.toLocaleString("id-ID")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Card 4: Engagement per Artikel (Lebar Penuh) */}
        <div className="lg:col-span-3 bg-card text-card-foreground border border-border rounded-lg shadow-xs p-6 flex flex-col min-h-[400px]">
          {/* Header & Filter Controls */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div className="space-y-0.5">
              <h3 className="text-lg font-bold tracking-tight">
                Engagement per Artikel
              </h3>
              <p className="text-sm text-muted-foreground">
                Perbandingan tayangan 30 hari terakhir terhadap total tayangan (Lifetime Views)
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 min-w-0 sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cari judul artikel..."
                  value={engagementSearchInput}
                  onChange={(e) => setEngagementSearchInput(e.target.value)}
                  className="pl-9 bg-background shadow-sm w-full"
                />
              </div>
              <Select
                value={engagementFormat}
                onValueChange={(val) => {
                  setEngagementFormat(val);
                  setEngagementPage(1);
                }}
              >
                <SelectTrigger className="w-full sm:w-[140px] bg-background shadow-sm">
                  <div className="flex items-center gap-2">
                    <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                    <SelectValue placeholder="Format" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Semua Format</SelectItem>
                  <SelectItem value="STANDARD">Standard</SelectItem>
                  <SelectItem value="GALLERY">Galeri</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Table Container */}
          <div className="flex-1 bg-background border border-border rounded-md overflow-x-auto min-w-0">
            <ListTable
              columns={engagementColumns}
              data={engagementData}
              loading={isEngagementLoading}
              compact
              emptyText={
                engagementSearch
                  ? "Artikel tidak ditemukan."
                  : "Belum ada artikel yang dipublikasikan."
              }
              rowKey={(row) => row.articleId}
            />
          </div>

          {/* Pagination Controls */}
          {engagementTotalPages > 1 && (
            <div className="flex flex-col sm:flex-row flex-wrap items-center justify-between gap-3 pt-4 mt-4 border-t border-border">
              <span className="text-xs text-muted-foreground">
                Halaman {engagementPage} dari {engagementTotalPages}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEngagementPage((p) => Math.max(1, p - 1))}
                  disabled={engagementPage === 1 || isEngagementLoading}
                >
                  Sebelumnya
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEngagementPage((p) => Math.min(engagementTotalPages, p + 1))}
                  disabled={engagementPage === engagementTotalPages || isEngagementLoading}
                >
                  Selanjutnya
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
