"use client";

import React, { useState, useRef, useMemo, useCallback } from "react";
import {
  Handshake,
  MousePointerClick,
  Megaphone,
  CalendarPlus,
  Loader2,
  TrendingUp,
  AlertTriangle,
  ImageIcon,
  LayoutGrid,
  Newspaper,
  BarChart3,
  PieChart,
} from "lucide-react";
import { Line, Bar, Pie } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  type ChartOptions,
  type ChartEvent,
  type ActiveElement,
} from "chart.js";
import { Button } from "@/components/ui/button";
import type {
  AEClicksTrendDay,
  AEArticleCategoryClicks,
  AEPlatformClicks,
  AERunningAdItem,
} from "@/types/analytics/aeDashboard";
import { useAEDashboard } from "@/hooks/useDashboardAnalytics";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverDescription,
} from "@/components/ui/popover";
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
);

/** Palet kategori — selaras dengan halaman analytics audience. */
const AE_CATEGORY_CHART_COLORS = [
  "#5c954e",
  "#c16b4c",
  "#dcae61",
  "#5fa1aa",
  "#bb6b7e",
  "#8b5cf6",
  "#3b82f6",
];

const AE_PLATFORM_BERANDA_COLOR = "#5c954e";
const AE_PLATFORM_ARTIKEL_COLOR = "#c16b4c";

function ClicksTrendDayPopover({ day }: { day: AEClicksTrendDay }) {
  return (
    <>
      <PopoverHeader className="pb-2 border-b border-border">
        <PopoverTitle className="text-sm font-bold">{day.date}</PopoverTitle>
        <PopoverDescription className="text-xs">
          Total{" "}
          <span className="font-bold text-foreground tabular-nums">
            {day.clicks.toLocaleString("id-ID")}
          </span>{" "}
          klik
        </PopoverDescription>
      </PopoverHeader>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-3 text-[11px]">
        <div className="rounded-md bg-muted/50 px-2.5 py-2">
          <p className="text-muted-foreground">Beranda</p>
          <p className="font-bold text-foreground tabular-nums">
            {day.homepageClicks.toLocaleString("id-ID")}
          </p>
        </div>
        <div className="rounded-md bg-muted/50 px-2.5 py-2">
          <p className="text-muted-foreground">Artikel</p>
          <p className="font-bold text-foreground tabular-nums">
            {day.articleClicks.toLocaleString("id-ID")}
          </p>
        </div>
      </div>
      <div className="pt-3 space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Kontributor teratas
        </p>
        <ul className="space-y-1">
          {day.topAds.map((ad) => (
            <li
              key={ad.name}
              className="flex items-center justify-between gap-2 text-xs"
            >
              <span className="text-foreground truncate">{ad.name}</span>
              <span className="font-bold text-terakota tabular-nums shrink-0">
                {ad.clicks.toLocaleString("id-ID")}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

function ArticleCategoryClicksPopover({
  category,
  totalArticleClicks,
}: {
  category: AEArticleCategoryClicks;
  totalArticleClicks: number;
}) {
  const share =
    totalArticleClicks > 0
      ? (category.clicks / totalArticleClicks) * 100
      : 0;

  return (
    <>
      <PopoverHeader className="pb-2 border-b border-border">
        <PopoverTitle className="text-sm font-bold">
          {category.categoryName}
        </PopoverTitle>
        <PopoverDescription className="text-xs">
          <span className="font-bold text-foreground tabular-nums">
            {category.clicks.toLocaleString("id-ID")}
          </span>{" "}
          klik ·{" "}
          <span className="font-semibold text-terakota tabular-nums">
            {share.toFixed(1)}%
          </span>{" "}
          dari total artikel
        </PopoverDescription>
      </PopoverHeader>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-3 text-[11px]">
        <div className="rounded-md bg-muted/50 px-2.5 py-2">
          <p className="text-muted-foreground">Iklan aktif</p>
          <p className="font-bold text-foreground tabular-nums">
            {category.activeAdsCount}
          </p>
        </div>
        <div className="rounded-md bg-muted/50 px-2.5 py-2">
          <p className="text-muted-foreground">Rata-rata / iklan</p>
          <p className="font-bold text-foreground tabular-nums">
            {category.activeAdsCount > 0
              ? Math.round(
                  category.clicks / category.activeAdsCount,
                ).toLocaleString("id-ID")
              : "—"}
          </p>
        </div>
      </div>
      <div className="pt-3 space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Iklan teratas di kategori
        </p>
        <ul className="space-y-1">
          {category.topAds.map((ad) => (
            <li
              key={ad.name}
              className="flex items-center justify-between gap-2 text-xs"
            >
              <span className="text-foreground truncate">{ad.name}</span>
              <span className="font-bold text-terakota tabular-nums shrink-0">
                {ad.clicks.toLocaleString("id-ID")}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

function PlatformClicksLegendRow({
  label,
  clicks,
  percentage,
  color,
}: {
  label: string;
  clicks: number;
  percentage: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3 py-1.5 text-xs">
      <span
        className="h-2.5 w-2.5 rounded-full shrink-0"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      <span className="flex-1 font-medium text-foreground truncate">{label}</span>
      <span className="font-bold text-foreground tabular-nums shrink-0">
        {clicks.toLocaleString("id-ID")}
      </span>
      <span className="text-muted-foreground tabular-nums shrink-0 w-12 text-right">
        {percentage.toFixed(1)}%
      </span>
    </div>
  );
}

function PlatformClicksPiePopover({
  platform,
  clicks,
  totalPlatformClicks,
  topAds,
}: {
  platform: "Beranda" | "Artikel";
  clicks: number;
  totalPlatformClicks: number;
  topAds: Array<{ name: string; clicks: number }>;
}) {
  const share =
    totalPlatformClicks > 0
      ? (clicks / totalPlatformClicks) * 100
      : 0;
  const accentColor =
    platform === "Beranda"
      ? AE_PLATFORM_BERANDA_COLOR
      : AE_PLATFORM_ARTIKEL_COLOR;

  return (
    <>
      <PopoverHeader className="pb-2 border-b border-border">
        <PopoverTitle className="text-sm font-bold flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full shrink-0"
            style={{ backgroundColor: accentColor }}
            aria-hidden
          />
          Klik Iklan {platform}
        </PopoverTitle>
        <PopoverDescription className="text-xs">
          <span className="font-bold text-foreground tabular-nums">
            {clicks.toLocaleString("id-ID")}
          </span>{" "}
          klik ·{" "}
          <span className="font-semibold tabular-nums" style={{ color: accentColor }}>
            {share.toFixed(1)}%
          </span>{" "}
          dari total platform
        </PopoverDescription>
      </PopoverHeader>
      <div className="pt-3 space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Kontributor teratas
        </p>
        <ul className="space-y-1">
          {topAds.map((ad) => (
            <li
              key={ad.name}
              className="flex items-center justify-between gap-2 text-xs"
            >
              <span className="text-foreground truncate">{ad.name}</span>
              <span className="font-bold tabular-nums shrink-0" style={{ color: accentColor }}>
                {ad.clicks.toLocaleString("id-ID")}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

function HomepageVsArticleClicksPieChart({
  platform,
  trendDays,
}: {
  platform: AEPlatformClicks;
  trendDays: number;
}) {
  const homepageClicks = platform.homepageClicks;
  const articleClicks = platform.articleClicks;
  const totalPlatformClicks = homepageClicks + articleClicks;

  const pieChartData = useMemo(
    () => ({
      labels: ["Beranda", "Artikel"],
      datasets: [
        {
          data: [homepageClicks, articleClicks],
          backgroundColor: [AE_PLATFORM_BERANDA_COLOR, AE_PLATFORM_ARTIKEL_COLOR],
          hoverBackgroundColor: ["#4a7c3f", "#a85a42"],
          borderWidth: 2,
          borderColor: "#ffffff",
          hoverOffset: 10,
        },
      ],
    }),
    [homepageClicks, articleClicks],
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState<{
    index: number;
    x: number;
    y: number;
  } | null>(null);

  const handleHover = useCallback(
    (_event: ChartEvent, elements: ActiveElement[], chart: ChartJS<"pie">) => {
      if (!elements.length) {
        setAnchor(null);
        return;
      }
      const index = elements[0].index;
      const arc = chart.getDatasetMeta(0).data[index];
      if (!arc || typeof arc.tooltipPosition !== "function") {
        setAnchor(null);
        return;
      }
      const { x, y } = arc.tooltipPosition(false);
      if (x == null || y == null) {
        setAnchor(null);
        return;
      }
      setAnchor({ index, x, y });
    },
    [],
  );

  const chartOptions = useMemo<ChartOptions<"pie">>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      onHover: handleHover,
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
      },
    }),
    [handleHover],
  );

  const platformLabels = ["Beranda", "Artikel"] as const;
  const platformClicksArr = [homepageClicks, articleClicks];
  const platformTopAds = [platform.topHomepageAds, platform.topArticleAds];
  const activePlatform =
    anchor != null ? platformLabels[anchor.index] : undefined;
  const activeClicks =
    anchor != null ? platformClicksArr[anchor.index] : undefined;
  const activeTopAds =
    anchor != null ? platformTopAds[anchor.index] : undefined;

  return (
    <div className="flex flex-col h-full">
      <div
        ref={containerRef}
        className="min-w-0 h-[220px] sm:h-[280px] relative shrink-0"
        onMouseLeave={() => setAnchor(null)}
      >
        <Pie data={pieChartData} options={chartOptions} />

        {anchor && activePlatform && activeClicks != null && activeTopAds && (
          <Popover open>
            <PopoverAnchor asChild>
              <span
                className="absolute block h-1 w-1 pointer-events-none"
                style={{ left: anchor.x, top: anchor.y }}
                aria-hidden
              />
            </PopoverAnchor>
            <PopoverContent
              side="top"
              align="center"
              sideOffset={12}
              className="w-72 p-0 pointer-events-none shadow-lg"
              onOpenAutoFocus={(e) => e.preventDefault()}
            >
              <div className="p-4">
                <PlatformClicksPiePopover
                  platform={activePlatform}
                  clicks={activeClicks}
                  totalPlatformClicks={totalPlatformClicks}
                  topAds={activeTopAds}
                />
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>

      <div className="space-y-0.5 border-t border-border pt-4 mt-2">
        <PlatformClicksLegendRow
          label="Beranda"
          clicks={homepageClicks}
          percentage={
            totalPlatformClicks > 0
              ? (homepageClicks / totalPlatformClicks) * 100
              : 0
          }
          color={AE_PLATFORM_BERANDA_COLOR}
        />
        <PlatformClicksLegendRow
          label="Artikel"
          clicks={articleClicks}
          percentage={
            totalPlatformClicks > 0
              ? (articleClicks / totalPlatformClicks) * 100
              : 0
          }
          color={AE_PLATFORM_ARTIKEL_COLOR}
        />
        <p className="text-[10px] text-muted-foreground pt-2">
          Periode: {trendDays} hari terakhir
          {totalPlatformClicks === 0 ? " (belum ada event klik tercatat)" : ""}
        </p>
      </div>
    </div>
  );
}

function ArticleCategoryClicksBarChart({
  categories,
}: {
  categories: AEArticleCategoryClicks[];
}) {
  const totalArticleClicks = useMemo(
    () => categories.reduce((sum, row) => sum + row.clicks, 0),
    [categories],
  );

  const barColors = useMemo(
    () =>
      categories.map(
        (_, i) => AE_CATEGORY_CHART_COLORS[i % AE_CATEGORY_CHART_COLORS.length],
      ),
    [categories],
  );

  const chartData = useMemo(
    () => ({
      labels: categories.map((row) => row.categoryName),
      datasets: [
        {
          label: "Klik Iklan Artikel",
          data: categories.map((row) => row.clicks),
          backgroundColor: barColors,
          borderRadius: 6,
          maxBarThickness: 48,
          borderWidth: 1.5,
          borderColor: "rgba(255, 255, 255, 0.85)",
          hoverBackgroundColor: barColors,
          hoverBorderWidth: 2,
          hoverBorderColor: "#ffffff",
        },
      ],
    }),
    [categories, barColors],
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState<{
    index: number;
    x: number;
    y: number;
  } | null>(null);

  const handleHover = useCallback(
    (_event: ChartEvent, elements: ActiveElement[], chart: ChartJS<"bar">) => {
      if (!elements.length) {
        setAnchor(null);
        return;
      }
      const index = elements[0].index;
      const bar = chart.getDatasetMeta(0).data[index];
      if (!bar || bar.x == null || bar.y == null) {
        setAnchor(null);
        return;
      }
      setAnchor({ index, x: bar.x, y: bar.y });
    },
    [],
  );

  const chartOptions = useMemo<ChartOptions<"bar">>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: true },
      onHover: handleHover,
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            font: { family: "Rubik", size: 9 },
            maxRotation: 45,
            minRotation: 0,
            autoSkip: false,
          },
        },
        y: {
          grid: { color: "rgba(0,0,0,0.04)" },
          ticks: {
            font: { family: "Rubik", size: 10 },
            callback: (value) =>
              typeof value === "number"
                ? value.toLocaleString("id-ID")
                : value,
          },
          beginAtZero: true,
        },
      },
    }),
    [handleHover],
  );

  const activeCategory =
    anchor != null ? categories[anchor.index] : undefined;

  if (categories.length === 0) {
    return (
      <p className="text-xs text-muted-foreground text-center py-16">
        Belum ada data klik iklan artikel per kategori.
      </p>
    );
  }

  return (
    <div
      ref={containerRef}
      className="min-w-0 h-[220px] sm:h-[280px] relative"
      onMouseLeave={() => setAnchor(null)}
    >
      <Bar data={chartData} options={chartOptions} />

      {anchor && activeCategory && (
        <Popover open>
          <PopoverAnchor asChild>
            <span
              className="absolute block h-1 w-1 pointer-events-none"
              style={{ left: anchor.x, top: anchor.y }}
              aria-hidden
            />
          </PopoverAnchor>
          <PopoverContent
            side="top"
            align="center"
            sideOffset={12}
            className="w-80 p-0 pointer-events-none shadow-lg"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <div className="p-4">
              <ArticleCategoryClicksPopover
                category={activeCategory}
                totalArticleClicks={totalArticleClicks}
              />
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

function ClicksTrendChart({ trend }: { trend: AEClicksTrendDay[] }) {
  const chartData = useMemo(
    () => ({
      labels: trend.map((row) => row.date),
      datasets: [
        {
          label: "Total Klik",
          data: trend.map((row) => row.clicks),
          borderColor: "#c16b4c",
          backgroundColor: "rgba(193, 107, 76, 0.06)",
          fill: true,
          tension: 0.35,
          borderWidth: 2.5,
          pointBackgroundColor: "#c16b4c",
          pointBorderColor: "#fff",
          pointBorderWidth: 1.5,
          pointRadius: 2,
          pointHoverRadius: 6,
          pointHoverBorderWidth: 2,
        },
      ],
    }),
    [trend],
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState<{
    index: number;
    x: number;
    y: number;
  } | null>(null);

  const handleHover = useCallback(
    (_event: ChartEvent, elements: ActiveElement[], chart: ChartJS<"line">) => {
      if (!elements.length) {
        setAnchor(null);
        return;
      }
      const index = elements[0].index;
      const point = chart.getDatasetMeta(0).data[index];
      if (!point || point.x == null || point.y == null) {
        setAnchor(null);
        return;
      }
      setAnchor({ index, x: point.x, y: point.y });
    },
    [],
  );

  const chartOptions = useMemo<ChartOptions<"line">>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      onHover: handleHover,
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            font: { family: "Rubik", size: 9 },
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 8,
          },
        },
        y: {
          grid: { color: "rgba(0,0,0,0.04)" },
          ticks: { font: { family: "Rubik", size: 10 } },
          beginAtZero: true,
        },
      },
    }),
    [handleHover],
  );

  const activeDay = anchor != null ? trend[anchor.index] : undefined;

  if (trend.length === 0) {
    return (
      <p className="text-xs text-muted-foreground text-center py-16">
        Belum ada data tren klik pada periode ini.
      </p>
    );
  }

  return (
    <div
      ref={containerRef}
      className="min-w-0 h-[220px] sm:h-[280px] relative"
      onMouseLeave={() => setAnchor(null)}
    >
      <Line data={chartData} options={chartOptions} />

      {anchor && activeDay && (
        <Popover open>
          <PopoverAnchor asChild>
            <span
              className="absolute block h-1 w-1 pointer-events-none"
              style={{ left: anchor.x, top: anchor.y }}
              aria-hidden
            />
          </PopoverAnchor>
          <PopoverContent
            side="top"
            align="center"
            sideOffset={12}
            className="w-80 p-0 pointer-events-none shadow-lg"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <div className="p-4">
              <ClicksTrendDayPopover day={activeDay} />
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

// ─── Helpers UI ───────────────────────────────────────────────────────────────

function formatCount(value: number | undefined): string {
  if (value === undefined) return "—";
  return value.toLocaleString("id-ID");
}

function BannerViewButton({
  name,
  bannerUrl,
  size = "sm",
}: {
  name: string;
  bannerUrl: string;
  size?: "sm" | "xs";
}) {
  const [open, setOpen] = useState(false);
  const hasBanner = Boolean(bannerUrl?.trim());

  return (
    <>
      <Button
        variant="outline"
        size={size === "xs" ? "sm" : "sm"}
        className={
          size === "xs"
            ? "h-7 text-[10px] px-2 shrink-0"
            : "h-8 text-xs shrink-0"
        }
        disabled={!hasBanner}
        onClick={() => setOpen(true)}
      >
        <ImageIcon className="h-3 w-3 mr-1" />
        Lihat banner
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-left">{name}</DialogTitle>
            <DialogDescription className="text-left">
              Pratinjau banner iklan
            </DialogDescription>
          </DialogHeader>
          <div className="relative w-full min-h-[160px] max-h-[70vh] rounded-md border border-border overflow-hidden bg-muted/30 flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={bannerUrl}
              alt={`Banner ${name}`}
              className="max-w-full max-h-[70vh] object-contain"
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function RunningAdsTable({ rows }: { rows: AERunningAdItem[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-xs text-muted-foreground text-center py-8">
        Tidak ada iklan berjalan.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs text-left border-collapse">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th className="p-3 font-semibold text-foreground">Nama Iklan</th>
            <th className="p-3 font-semibold text-foreground text-right w-24">
              Klik
            </th>
            <th className="p-3 font-semibold text-foreground w-28">
              Sisa Waktu
            </th>
            <th className="p-3 font-semibold text-foreground text-right w-28">
              Banner
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-muted/10 transition-colors">
              <td className="p-3 font-medium text-foreground leading-snug min-w-0 max-w-[10rem] sm:max-w-xs">
                <span className="block truncate">{row.name}</span>
              </td>
              <td className="p-3 text-right font-bold text-foreground tabular-nums">
                {row.clicks.toLocaleString("id-ID")}
              </td>
              <td className="p-3 text-muted-foreground whitespace-nowrap">
                {row.remaining}
              </td>
              <td className="p-3 text-right">
                <BannerViewButton
                  name={row.name}
                  bannerUrl={row.bannerUrl}
                  size="xs"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function AEDashboard() {
  const { data, isLoading, isError } = useAEDashboard();
  const stats = data?.stats;
  const trendDays = data?.trendDays ?? 30;
  const categoryCount = data?.articleClicksByCategory.length ?? 0;

  return (
    <div className="space-y-6">
      {/* Baris 1: KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="hover:shadow-md transition-all duration-300 border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Total Klik Iklan
            </span>
            <div className="p-2 bg-foreground/5 text-foreground rounded-full">
              <MousePointerClick className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
              {isLoading ? (
                <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
              ) : (
                formatCount(stats?.totalClicks)
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Akumulasi klik semua iklan beranda & artikel
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-all duration-300 border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Iklan Masuk 30 Hari
            </span>
            <div className="p-2 bg-terakota/10 text-terakota rounded-full">
              <CalendarPlus className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
              {isLoading ? (
                <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
              ) : (
                formatCount(stats?.adsAddedLast30Days)
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Kampanye baru didaftarkan dalam 30 hari terakhir
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-all duration-300 border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Jumlah Iklan Aktif
            </span>
            <div className="p-2 bg-hijauSawah/10 text-hijauSawah rounded-full">
              <Megaphone className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
              {isLoading ? (
                <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
              ) : (
                formatCount(stats?.activeAdsCount)
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Spanduk sedang tayang (dalam masa berlaku)
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-all duration-300 border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Jumlah Sponsor Aktif
            </span>
            <div className="p-2 bg-hijauSawah/10 text-hijauSawah rounded-full">
              <Handshake className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
              {isLoading ? (
                <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
              ) : (
                formatCount(stats?.activeSponsorsCount)
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Logo sponsor terdaftar di halaman sponsor
            </p>
          </CardContent>
        </Card>
      </div>

      {isError && (
        <p className="text-xs text-destructive">
          Gagal memuat statistik dashboard. Muat ulang halaman atau coba lagi
          nanti.
        </p>
      )}

      {/* Baris 2: Grafik klik (2/3) + Segera berakhir ≤3 hari (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="border border-border lg:col-span-2">
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-terakota" />
              Tren Klik Iklan
            </CardTitle>
            <CardDescription className="text-xs">
              {trendDays} hari terakhir — arahkan kursor ke titik grafik untuk
              detail klik per hari.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {isLoading ? (
              <div className="min-w-0 h-[220px] sm:h-[280px] flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <ClicksTrendChart trend={data?.clicksTrend ?? []} />
            )}
          </CardContent>
        </Card>

        <Card className="border border-border flex flex-col">
          <CardHeader className="pb-3 border-b border-border shrink-0">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-terakota" />
              Berakhir ≤ 3 Hari
            </CardTitle>
            <CardDescription className="text-xs">
              Iklan yang masa tayangnya tinggal tiga hari atau kurang.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-y-auto max-h-[340px] lg:max-h-none">
            {!isLoading && (data?.expiringSoon.length ?? 0) === 0 && (
              <p className="text-xs text-muted-foreground text-center py-8 px-4">
                Tidak ada iklan yang berakhir dalam 3 hari ke depan.
              </p>
            )}
            <ul className="divide-y divide-border">
              {(isLoading ? [] : data?.expiringSoon ?? []).map((item) => (
                <li
                  key={item.id}
                  className="p-4 space-y-2.5 hover:bg-muted/10 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-bold text-foreground leading-snug flex-1">
                      {item.name}
                    </p>
                    <span className="inline-flex shrink-0 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-orange-50 text-terakota border border-terakota/20 dark:bg-orange-950/30">
                      {item.remaining}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Selesai:{" "}
                    <span className="font-medium text-foreground/85">
                      {item.endsAt}
                    </span>
                  </p>
                  <BannerViewButton
                    name={item.name}
                    bannerUrl={item.bannerUrl}
                    size="xs"
                  />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Baris 3: Klik artikel per kategori (2/3) + Beranda vs Artikel (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="border border-border lg:col-span-2">
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-terakota" />
              Klik Iklan Artikel per Kategori
            </CardTitle>
            <CardDescription className="text-xs">
              Sebaran klik iklan single artikel per kategori slot (
              {categoryCount} kategori terdata). Arahkan kursor ke batang
              grafik untuk detail.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {isLoading ? (
              <div className="min-w-0 h-[220px] sm:h-[280px] flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <ArticleCategoryClicksBarChart
                categories={data?.articleClicksByCategory ?? []}
              />
            )}
          </CardContent>
        </Card>

        <Card className="border border-border flex flex-col">
          <CardHeader className="pb-3 border-b border-border shrink-0">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <PieChart className="h-4 w-4 text-hijauSawah" />
              Beranda vs Artikel
            </CardTitle>
            <CardDescription className="text-xs">
              Perbandingan klik iklan beranda dan single artikel ({trendDays}{" "}
              hari terakhir).
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 flex-1 flex flex-col justify-center">
            {isLoading || !data?.platformClicks ? (
              <div className="min-w-0 h-[220px] sm:h-[240px] flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <HomepageVsArticleClicksPieChart
                platform={data.platformClicks}
                trendDays={trendDays}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Baris 4: Iklan berjalan beranda & artikel (masing-masing 1/2) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border border-border">
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <LayoutGrid className="h-4 w-4 text-foreground" />
              Iklan Beranda Berjalan
            </CardTitle>
            <CardDescription className="text-xs">
              Slot homepage yang sedang aktif saat ini.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="py-12 flex justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <RunningAdsTable rows={data?.runningHomepage ?? []} />
            )}
          </CardContent>
        </Card>

        <Card className="border border-border">
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Newspaper className="h-4 w-4 text-foreground" />
              Iklan Single Article Berjalan
            </CardTitle>
            <CardDescription className="text-xs">
              Slot artikel yang sedang aktif saat ini.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="py-12 flex justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <RunningAdsTable rows={data?.runningArticle ?? []} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
