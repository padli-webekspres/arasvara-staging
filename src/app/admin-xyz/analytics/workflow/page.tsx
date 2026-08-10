"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  Clock,
  FileText,
  Calendar,
  AlertCircle,
  CheckCircle,
  TrendingUp,
  Search,
  RefreshCw,
  Sparkles,
} from "lucide-react";
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

import {
  useWorkflowSummary,
  useThroughputRespon,
  useQueueCalendar,
  QueueCalendarItem,
} from "@/hooks/useWorkflowAnalytics";

// Impor Chart.js dan react-chartjs-2
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
import { Bar, Line } from "react-chartjs-2";

// Daftarkan komponen inti Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// Helper untuk menghitung tanggal awal (startDate) berdasarkan tipe rentang waktu yang dipilih
function getDateRange(rangeType: string) {
  const end = new Date();
  const start = new Date();
  if (rangeType === "7d") {
    start.setDate(end.getDate() - 7);
  } else if (rangeType === "30d") {
    start.setDate(end.getDate() - 30);
  }
  return {
    startDate: start.toISOString().split("T")[0],
    endDate: end.toISOString().split("T")[0],
  };
}

// Format string tanggal YYYY-MM-DD menjadi format ringkas e.g. "24 Mei"
function formatDisplayDate(dateStr: string): string {
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
}

const FORMAT_LABEL: Record<string, string> = {
  STANDARD: "Standard",
  GALLERY: "Galeri",
};

// ─── Main Component ────────────────────────────────────────────────────────

export default function EditorialWorkflowPage() {
  const [mounted, setMounted] = useState(false);
  const [range, setRange] = useState("7d");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Search filter states
  const [searchPending, setSearchPending] = useState("");
  const [searchScheduled, setSearchScheduled] = useState("");

  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  useEffect(() => {
    setMounted(true);
  }, []);

  // Hitung range tanggal berdasarkan pilihan dropdown
  const { startDate, endDate } = useMemo(() => getDateRange(range), [range]);

  // React Query Hooks untuk integrasi backend & caching optimal
  const {
    data: summaryResponse,
    isLoading: isSummaryLoading,
    error: summaryError,
    refetch: refetchSummary,
  } = useWorkflowSummary({
    startDate,
    endDate,
    enabled: mounted,
  });

  const {
    data: throughputResponse,
    isLoading: isThroughputLoading,
    error: throughputError,
    refetch: refetchThroughput,
  } = useThroughputRespon({
    startDate,
    endDate,
    enabled: mounted,
  });

  const {
    data: queueResponse,
    isLoading: isQueueLoading,
    error: queueError,
    refetch: refetchQueue,
  } = useQueueCalendar({
    enabled: mounted,
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([
      refetchSummary(),
      refetchThroughput(),
      refetchQueue(),
    ]);
    setIsRefreshing(false);
  };

  const summary = summaryResponse?.data;
  const throughputData = throughputResponse?.data || [];
  const pendingQueue = queueResponse?.data?.pendingQueue || [];
  const scheduledCalendar = queueResponse?.data?.scheduledCalendar || [];

  // Filter tabel pencarian naskah secara real-time
  const filteredPending = useMemo(() => {
    return pendingQueue.filter(
      (item) =>
        item.title.toLowerCase().includes(searchPending.toLowerCase()) ||
        item.author.toLowerCase().includes(searchPending.toLowerCase()) ||
        item.category.toLowerCase().includes(searchPending.toLowerCase())
    );
  }, [pendingQueue, searchPending]);

  const filteredScheduled = useMemo(() => {
    return scheduledCalendar.filter(
      (item) =>
        item.title.toLowerCase().includes(searchScheduled.toLowerCase()) ||
        item.author.toLowerCase().includes(searchScheduled.toLowerCase()) ||
        item.category.toLowerCase().includes(searchScheduled.toLowerCase())
    );
  }, [scheduledCalendar, searchScheduled]);

  // Kolom Tabel Pending Review
  const pendingColumns: ListTableColumn<QueueCalendarItem>[] = useMemo(
    () => [
      {
        key: "title",
        header: "Artikel Menunggu",
        className: "min-w-0",
        render: (row) => (
          <div className="flex flex-col pr-2">
            <span className="font-semibold text-foreground/90 line-clamp-2 leading-snug">
              {row.title}
            </span>
            <div className="flex items-center gap-2 mt-1.5 text-[11px] text-muted-foreground">
              <span className="font-medium text-foreground/70">
                {row.author}
              </span>
              <span className="w-1 h-1 rounded-full bg-muted-foreground/35" />
              <span>{row.category}</span>
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
        key: "waitTime",
        header: <div className="text-right">Waktu Tunggu</div>,
        className: "text-right min-w-0",
        render: (row) => {
          const waitTime = row.waitTimeMinutes || 0;
          let badgeColor = "text-hijauSawah bg-green-50 dark:bg-green-950/20";
          if (waitTime >= 120) {
            badgeColor = "text-red-600 bg-red-50 dark:bg-red-950/20";
          } else if (waitTime >= 60) {
            badgeColor = "text-terakota bg-orange-50 dark:bg-orange-950/20";
          }

          // Format ISO timestamp ke jam-menit lokal
          const dateLabel = row.submittedAt
            ? new Date(row.submittedAt).toLocaleTimeString("id-ID", {
                hour: "2-digit",
                minute: "2-digit",
              })
            : "-";

          return (
            <div className="flex flex-col items-end">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${badgeColor}`}
              >
                <Clock className="w-3.5 h-3.5 mr-1 shrink-0" />
                {waitTime >= 60
                  ? `${Math.floor(waitTime / 60)}j ${waitTime % 60}m`
                  : `${waitTime}m`}
              </span>
              <span className="text-[10px] text-muted-foreground mt-1">
                Kirim: {dateLabel}
              </span>
            </div>
          );
        },
      },
    ],
    []
  );

  // Kolom Tabel Scheduled
  const scheduledColumns: ListTableColumn<QueueCalendarItem>[] = useMemo(
    () => [
      {
        key: "title",
        header: "Artikel Terjadwal",
        className: "min-w-0",
        render: (row) => (
          <div className="flex flex-col pr-2">
            <span className="font-semibold text-foreground/90 line-clamp-2 leading-snug">
              {row.title}
            </span>
            <div className="flex items-center gap-2 mt-1.5 text-[11px] text-muted-foreground">
              <span className="font-medium text-foreground/70">
                {row.author}
              </span>
              <span className="w-1 h-1 rounded-full bg-muted-foreground/35" />
              <span>{row.category}</span>
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
        key: "scheduledTime",
        header: <div className="text-right">Jam Terbit</div>,
        className: "text-right min-w-0",
        render: (row) => {
          const timeLabel = row.scheduledAt
            ? new Date(row.scheduledAt).toLocaleTimeString("id-ID", {
                hour: "2-digit",
                minute: "2-digit",
              })
            : "-";

          return (
            <div className="flex flex-col items-end">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold text-foreground bg-foreground/5 dark:bg-white/10 border border-foreground/10">
                <Calendar className="w-3.5 h-3.5 mr-1 shrink-0" />
                {timeLabel}
              </span>
              <span className="text-[10px] text-muted-foreground mt-1">
                Hari ini
              </span>
            </div>
          );
        },
      },
    ],
    []
  );

  // ─── Chart.js Dinamis Kustomisasi Tema (Hitung Warna Selaras) ─────────────

  const chartThemeColors = useMemo(() => {
    const textColor = isDark ? "#a3a3a3" : "#52525b";
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

  // Data & Opsi Grafik Throughput (Bar Chart)
  const barChartData = useMemo(() => {
    return {
      labels: throughputData.map((d) => formatDisplayDate(d.date)),
      datasets: [
        {
          label: "Naskah Diajukan",
          data: throughputData.map((d) => d.submitted),
          backgroundColor: isDark ? "#3f3f46" : "#18181b", // Black/Charcoal (Foreground)
          borderRadius: 4,
          maxBarThickness: 16,
        },
        {
          label: "Naskah Terbit",
          data: throughputData.map((d) => d.published),
          backgroundColor: "#5c954e", // Hijau Sawah
          borderRadius: 4,
          maxBarThickness: 16,
        },
      ],
    };
  }, [throughputData, isDark]);

  const barOptions = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          backgroundColor: chartThemeColors.tooltipBg,
          titleColor: chartThemeColors.tooltipTitleColor,
          bodyColor: chartThemeColors.tooltipBodyColor,
          borderColor: chartThemeColors.tooltipBorder,
          borderWidth: 1,
          padding: 10,
          cornerRadius: 6,
          titleFont: { family: "Rubik", weight: "bold" as const },
          bodyFont: { family: "Rubik" },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: chartThemeColors.textColor,
            font: { family: "Rubik", size: 11 },
          },
        },
        y: {
          grid: { color: chartThemeColors.gridColor },
          ticks: {
            color: chartThemeColors.textColor,
            font: { family: "Rubik", size: 11 },
          },
        },
      },
    };
  }, [chartThemeColors]);

  // Data & Opsi Grafik Tren SLA (Line Chart)
  const lineChartData = useMemo(() => {
    return {
      labels: throughputData.map((d) => formatDisplayDate(d.date)),
      datasets: [
        {
          label: "Rata-rata SLA (Menit)",
          data: throughputData.map((d) => d.avgSla),
          borderColor: "#c16b4c", // Terakota
          backgroundColor: "rgba(193, 107, 76, 0.04)",
          fill: true,
          tension: 0.35,
          borderWidth: 2.5,
          pointBackgroundColor: "#c16b4c",
          pointBorderColor: isDark ? "#202020" : "#ffffff",
          pointBorderWidth: 1.5,
          pointHoverRadius: 6,
        },
      ],
    };
  }, [throughputData, isDark]);

  const lineOptions = useMemo(() => {
    return {
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
          padding: 10,
          cornerRadius: 6,
          titleFont: { family: "Rubik", weight: "bold" as const },
          bodyFont: { family: "Rubik" },
          callbacks: {
            label: function (context: any) {
              return ` SLA: ${context.raw} Menit`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: chartThemeColors.textColor,
            font: { family: "Rubik", size: 11 },
          },
        },
        y: {
          grid: { color: chartThemeColors.gridColor },
          ticks: {
            color: chartThemeColors.textColor,
            font: { family: "Rubik", size: 11 },
            callback: function (val: any) {
              return `${val}m`;
            },
          },
        },
      },
    };
  }, [chartThemeColors]);

  // Loading skeleton state
  const isLoading = isSummaryLoading || isThroughputLoading || isQueueLoading;
  const error = summaryError || throughputError || queueError;

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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="h-28 bg-muted rounded-lg border"></div>
          <div className="h-28 bg-muted rounded-lg border"></div>
          <div className="h-28 bg-muted rounded-lg border"></div>
          <div className="h-28 bg-muted rounded-lg border"></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-[300px] bg-muted rounded-lg border"></div>
          <div className="h-[300px] bg-muted rounded-lg border"></div>
        </div>
      </div>
    );
  }

  // Error boundary response
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[500px] border border-dashed rounded-lg p-6 space-y-4 text-center">
        <div className="p-3 bg-destructive/10 text-destructive rounded-full">
          <RefreshCw className="h-8 w-8 animate-spin" />
        </div>
        <h3 className="text-lg font-semibold">Gagal Memuat Analitik Redaksi</h3>
        <p className="text-muted-foreground max-w-sm">
          {error instanceof Error
            ? error.message
            : "Terjadi kesalahan saat memuat data workflow redaksi dari database."}
        </p>
        <Button variant="outline" onClick={handleRefresh} className="gap-2">
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
            Editorial Workflow & Production
          </h1>
          <p className="text-sm text-muted-foreground">
            Pantau kelancaran, efisiensi kerja editor, antrean review naskah,
            dan kepatuhan SLA redaksi.
          </p>
        </div>

        {/* Filters & Actions */}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className="h-9 gap-2 text-xs font-medium"
            disabled={isRefreshing}
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`}
            />
            Refresh Data
          </Button>

          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="w-[140px] h-9 text-xs">
              <SelectValue placeholder="Rentang Waktu" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">7 Hari Terakhir</SelectItem>
              <SelectItem value="30d">30 Hari Terakhir</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card 1: Artikel Draft (Hitang/Foreground) */}
        <div className="bg-card text-card-foreground border border-border rounded-lg shadow-xs p-5 flex items-center justify-between hover:shadow-sm transition-all duration-300">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Artikel Draft
            </span>
            <h2 className="text-3xl font-bold tracking-tight text-foreground">
              {summary?.draft || 0}
            </h2>
            <p className="text-xs text-muted-foreground">
              Sedang ditulis oleh penulis & staf
            </p>
          </div>
          <div className="p-3 bg-foreground/5 dark:bg-white/10 text-foreground rounded-full">
            <FileText className="h-5 w-5" />
          </div>
        </div>

        {/* Card 2: Pending Review (Terakota) */}
        <div className="bg-card text-card-foreground border border-border rounded-lg shadow-xs p-5 flex items-center justify-between hover:shadow-sm transition-all duration-300 relative overflow-hidden">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Pending Review
            </span>
            <div className="flex items-center gap-2">
              <h2 className="text-3xl font-bold tracking-tight text-terakota">
                {summary?.pendingReview || 0}
              </h2>
              {(summary?.pendingReview || 0) > 5 && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-orange-100 dark:bg-orange-950/45 text-terakota">
                  Butuh Tindakan
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Mengantre di meja penyuntingan
            </p>
          </div>
          <div className="p-3 bg-terakota/10 text-terakota rounded-full">
            <Clock className="h-5 w-5 animate-pulse" />
          </div>
        </div>

        {/* Card 3: Terjadwal Tayang (Neutral/Sleek Charcoal) */}
        <div className="bg-card text-card-foreground border border-border rounded-lg shadow-xs p-5 flex items-center justify-between hover:shadow-sm transition-all duration-300">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Terjadwal Tayang
            </span>
            <h2 className="text-3xl font-bold tracking-tight text-foreground/80 dark:text-white/80">
              {summary?.scheduled || 0}
            </h2>
            <p className="text-xs text-muted-foreground">
              Akan rilis otomatis hari ini
            </p>
          </div>
          <div className="p-3 bg-foreground/5 dark:bg-white/10 text-foreground/80 dark:text-white/85 rounded-full">
            <Calendar className="h-5 w-5" />
          </div>
        </div>

        {/* Card 4: Rata-rata SLA (Hijau Sawah) */}
        <div className="bg-card text-card-foreground border border-border rounded-lg shadow-xs p-5 flex items-center justify-between hover:shadow-sm transition-all duration-300">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Rata-rata SLA Review
            </span>
            <h2 className="text-3xl font-bold tracking-tight text-hijauSawah">
              {summary?.avgSlaMinutes ? `${summary.avgSlaMinutes}m` : "0m"}
            </h2>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5 text-hijauSawah shrink-0" />
              <span>{summary?.complianceRate || 100}% di bawah target {summary?.targetSlaMinutes ?? 120}m</span>
            </p>
          </div>
          <div className="p-3 bg-hijauSawah/10 text-hijauSawah rounded-full">
            <TrendingUp className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Throughput Produksi */}
        <div className="bg-card border border-border rounded-lg p-5 space-y-4 hover:shadow-sm transition-all">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
            <div className="space-y-0.5">
              <h3 className="text-base font-bold tracking-tight">
                Throughput Redaksi Harian
              </h3>
              <p className="text-xs text-muted-foreground">
                Perbandingan volume naskah diajukan penulis vs terbit harian.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 text-[11px] font-medium">
              <div className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-foreground dark:bg-white/80"></span>
                <span>Submitted</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-hijauSawah"></span>
                <span>Published</span>
              </div>
            </div>
          </div>
          <div className="min-w-0 h-[220px] sm:h-[280px] relative">
            {throughputData.length > 0 ? (
              <Bar data={barChartData} options={barOptions} />
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-xs">
                Tidak ada data throughput
              </div>
            )}
          </div>
        </div>

        {/* Chart 2: Kecepatan Respon Editor */}
        <div className="bg-card border border-border rounded-lg p-5 space-y-4 hover:shadow-sm transition-all">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
            <div className="space-y-0.5">
              <h3 className="text-base font-bold tracking-tight">
                Tren Respon Editor (SLA)
              </h3>
              <p className="text-xs text-muted-foreground">
                Rata-rata waktu tunggu naskah dari diajukan hingga terbit.
              </p>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-medium">
              <span className="h-2.5 w-2.5 rounded-full bg-terakota"></span>
              <span>Rata-rata Waktu Tunggu (Menit)</span>
            </div>
          </div>
          <div className="min-w-0 h-[220px] sm:h-[280px] relative">
            {throughputData.length > 0 ? (
              <Line data={lineChartData} options={lineOptions} />
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-xs">
                Tidak ada data SLA
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Grid Tabel Antrean Redaksi */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Kolom Kiri: Urgent Pending Review Queue */}
        <div className="bg-card border border-border rounded-lg p-5 space-y-4 hover:shadow-sm transition-all flex flex-col min-h-[480px]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2">
            <div className="space-y-0.5">
              <h3 className="text-base font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-terakota" />
                Antrean Review Naskah
              </h3>
              <p className="text-xs text-muted-foreground">
                Naskah status menunggu review editor diurutkan berdasarkan waktu
                tunggu terlama.
              </p>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/60" />
            <Input
              placeholder="Cari naskah antrean (judul, penulis, kategori)..."
              value={searchPending}
              onChange={(e) => setSearchPending(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>

          {/* ListTable */}
          <div className="flex-1 overflow-x-auto border border-border rounded-md mt-1 bg-muted/10">
            <ListTable
              columns={pendingColumns}
              data={filteredPending}
              emptyText="Tidak ada naskah dalam antrean review."
              rowKey={(row) => row.id}
            />
          </div>
        </div>

        {/* Kolom Kanan: Upcoming Scheduled Calendar */}
        <div className="bg-card border border-border rounded-lg p-5 space-y-4 hover:shadow-sm transition-all flex flex-col min-h-[480px]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2">
            <div className="space-y-0.5">
              <h3 className="text-base font-bold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-terakota" />
                Kalender Tayang Otomatis
              </h3>
              <p className="text-xs text-muted-foreground">
                Artikel terjadwal yang akan terbit otomatis hari ini.
              </p>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/60" />
            <Input
              placeholder="Cari artikel terjadwal..."
              value={searchScheduled}
              onChange={(e) => setSearchScheduled(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>

          {/* ListTable */}
          <div className="flex-1 overflow-x-auto border border-border rounded-md mt-1 bg-muted/10">
            <ListTable
              columns={scheduledColumns}
              data={filteredScheduled}
              emptyText="Tidak ada artikel terjadwal hari ini."
              rowKey={(row) => row.id}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
