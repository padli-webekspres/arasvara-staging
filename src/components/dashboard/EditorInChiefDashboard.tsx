"use client";

import React, { useMemo } from "react";
import {
  TrendingUp,
  Eye,
  Award,
  BookOpen,
  PieChart,
  Home,
  Sparkles,
  Users,
  Clock,
  Youtube,
  Instagram,
  Music,
  ShieldAlert,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Doughnut, Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { useChiefDashboard } from "@/hooks/useDashboardAnalytics";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

export default function EditorInChiefDashboard() {
  const { data: statsResponse, isLoading, error, refetch } = useChiefDashboard();

  const stats = statsResponse?.data;

  // 1. Memoized Doughnut data & options
  const doughnutData = useMemo(() => {
    if (!stats?.channels) return { labels: [], datasets: [] };
    return {
      labels: stats.channels.map((c) => c.name),
      datasets: [
        {
          data: stats.channels.map((c) => c.views),
          backgroundColor: stats.channels.map((c) => c.color),
          borderWidth: 1.5,
          borderColor: "rgba(255, 255, 255, 0.4)",
          hoverOffset: 6,
        },
      ],
    };
  }, [stats?.channels]);

  const doughnutOptions = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          padding: 10,
          cornerRadius: 6,
          titleFont: { family: "Rubik", weight: "bold" as const },
          bodyFont: { family: "Rubik" },
          callbacks: {
            label: function (context: any) {
              const val = context.raw as number;
              return ` ${context.label}: ${val.toLocaleString("id-ID")} Views`;
            },
          },
        },
      },
      cutout: "68%",
    };
  }, []);

  const productionLineData = useMemo(() => {
    const rows = stats?.productionLast14d ?? [];
    return {
      labels: rows.map((r) => r.date),
      datasets: [
        {
          label: "Artikel terbit",
          data: rows.map((r) => r.count),
          borderColor: "#10B981",
          backgroundColor: "rgba(16, 185, 129, 0.12)",
          fill: true,
          tension: 0.35,
          pointRadius: 3,
          pointBackgroundColor: "#10B981",
        },
      ],
    };
  }, [stats?.productionLast14d]);

  const productionLineOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx: { raw?: unknown }) =>
              ` ${Number(ctx.raw ?? 0).toLocaleString("id-ID")} artikel`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { size: 10 } },
        },
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0,
            font: { size: 10 },
          },
          grid: { color: "rgba(148, 163, 184, 0.2)" },
        },
      },
    }),
    [],
  );

  const unpublishedDoughnutData = useMemo(() => {
    const rows = stats?.unpublishedByStatus ?? [];
    return {
      labels: rows.map((r) => r.label),
      datasets: [
        {
          data: rows.map((r) => r.count),
          backgroundColor: rows.map((r) => r.color),
          borderWidth: 1.5,
          borderColor: "rgba(255, 255, 255, 0.4)",
          hoverOffset: 6,
        },
      ],
    };
  }, [stats?.unpublishedByStatus]);

  const unpublishedDoughnutOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context: { label?: string; raw?: unknown }) =>
              ` ${context.label}: ${Number(context.raw ?? 0).toLocaleString("id-ID")} naskah`,
          },
        },
      },
      cutout: "68%",
    }),
    [],
  );

  // Pemetaan Ikon Beranda secara dinamis berdasarkan kontainer/slot
  const homepageSections = useMemo(() => {
    if (!stats?.homepageSections) return [];
    
    const iconConfig: Record<string, { icon: any; iconColor: string }> = {
      "Artikel Populer": { icon: TrendingUp, iconColor: "text-terakota bg-terakota/10" },
      "Pilihan Editor": { icon: Award, iconColor: "text-hijauSawah bg-hijauSawah/10" },
      "Headline Utama": { icon: Sparkles, iconColor: "text-amber-500 bg-amber-500/10" },
      "TikTok Section": { icon: Music, iconColor: "text-foreground bg-foreground/5" },
      "Instagram Section": { icon: Instagram, iconColor: "text-pink-500 bg-pink-500/10" },
      "YouTube Section": { icon: Youtube, iconColor: "text-red-600 bg-red-500/10" },
    };

    return stats.homepageSections.map((sec) => {
      const config = iconConfig[sec.name] || { icon: Home, iconColor: "text-foreground bg-foreground/5" };
      return {
        ...sec,
        icon: config.icon,
        iconColor: config.iconColor,
      };
    });
  }, [stats?.homepageSections]);

  // Loading Skeletons state
  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        {/* Skeletons KPI Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-muted rounded-lg border border-border"></div>
          ))}
        </div>
        {/* Skeletons Trending & Doughnut Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-[380px] bg-muted rounded-lg border border-border"></div>
          <div className="h-[380px] bg-muted rounded-lg border border-border"></div>
        </div>
        {/* Skeletons Row 3: Sorotan Beranda & scheduled articles */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-[280px] bg-muted rounded-lg border border-border"></div>
          <div className="h-[280px] bg-muted rounded-lg border border-border"></div>
        </div>
        {/* Skeletons Leaderboards Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="h-[280px] bg-muted rounded-lg border border-border"></div>
          <div className="h-[280px] bg-muted rounded-lg border border-border"></div>
        </div>
      </div>
    );
  }

  // Error boundary response
  if (error || !stats) {
    return (
      <div className="flex flex-col items-center justify-center h-[350px] border border-dashed rounded-lg p-6 space-y-4 text-center">
        <div className="p-3 bg-destructive/10 text-destructive rounded-full">
          <ShieldAlert className="h-8 w-8 text-terakota" />
        </div>
        <h3 className="text-sm font-bold">Gagal Memuat Analitik Pemimpin Redaksi</h3>
        <p className="text-xs text-muted-foreground max-w-sm">
          {error instanceof Error
            ? error.message
            : "Terjadi masalah koneksi atau hak akses ditolak untuk role Pemimpin Redaksi."}
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2 text-xs">
          <RefreshCw className="h-3.5 w-3.5" />
          Coba Lagi
        </Button>
      </div>
    );
  }

  // Persentase pencapaian pageviews bulanan
  const achievementRate = stats.targetPembacaBulanIni > 0 
    ? parseFloat(((stats.pembacaBulanIni / stats.targetPembacaBulanIni) * 100).toFixed(1)) 
    : 100;

  return (
    <div className="space-y-6">
      {/* Row 1: Macro Performance KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* KPI 1: Pembaca Bulan Ini */}
        <Card className="hover:shadow-md transition-all duration-300 border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Pembaca Bulan Ini
            </span>
            <div className="p-2 bg-foreground/5 text-foreground rounded-full">
              <Eye className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold tracking-tight text-foreground">
              {stats.pembacaBulanIni.toLocaleString("id-ID")}
            </div>
            <div className="space-y-1.5 mt-2">
              <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                <span>Target: {stats.targetPembacaBulanIni.toLocaleString("id-ID")}</span>
                <span className="font-semibold text-foreground">{achievementRate}%</span>
              </div>
              <div className="w-full bg-muted-foreground/15 h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-hijauSawah h-1.5 rounded-full transition-all duration-500" 
                  style={{ width: `${Math.min(achievementRate, 100)}%` }} 
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPI 2: Artikel Rilis Hari Ini */}
        <Card className="hover:shadow-md transition-all duration-300 border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Artikel Rilis Hari Ini
            </span>
            <div className="p-2 bg-hijauSawah/10 text-hijauSawah rounded-full">
              <BookOpen className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold tracking-tight text-foreground">
              {stats.artikelRilisHariIni} <span className="text-sm font-medium text-muted-foreground">Naskah</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Dipublikasikan secara instan & terjadwal
            </p>
          </CardContent>
        </Card>

        {/* KPI 3: Pembaca Hari Ini */}
        <Card className="hover:shadow-md transition-all duration-300 border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Pembaca Hari Ini
            </span>
            <div className="p-2 bg-foreground/5 text-foreground rounded-full">
              <Users className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold tracking-tight text-foreground">
              {stats.pembacaHariIni.toLocaleString("id-ID")} <span className="text-sm font-medium text-muted-foreground">Pembaca</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Total kunjungan aktif hari ini
            </p>
          </CardContent>
        </Card>

        {/* KPI 4: Produksi Artikel (Bulan Ini) */}
        <Card className="hover:shadow-md transition-all duration-300 border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Produksi Artikel (Bulan Ini)
            </span>
            <div className="p-2 bg-terakota/10 text-terakota rounded-full">
              <Award className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold tracking-tight text-terakota">
              {stats.produksiArtikelBulanIni} <span className="text-sm font-medium text-muted-foreground">Terbit</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Memenuhi target standard mutu SEO
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Row 1b: Produksi 14 hari + komposisi non-publish */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-hijauSawah" />
              Produksi Artikel (14 hari)
            </CardTitle>
            <CardDescription className="text-xs">
              Jumlah artikel berstatus PUBLISHED per hari (Asia/Jakarta).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="min-w-0 h-[220px] sm:h-[260px] relative">
              {(stats.productionLast14d ?? []).every((r) => r.count === 0) ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center space-y-2">
                  <TrendingUp className="h-7 w-7 text-muted-foreground/35" />
                  <p className="text-xs font-bold text-foreground">
                    Belum ada publikasi
                  </p>
                  <p className="text-[10px] text-muted-foreground max-w-[240px]">
                    Artikel yang terbit dalam 14 hari terakhir akan muncul di
                    sini.
                  </p>
                </div>
              ) : (
                <Line data={productionLineData} options={productionLineOptions} />
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <PieChart className="h-4 w-4 text-amber-500" />
              Pipeline Non-Publish
            </CardTitle>
            <CardDescription className="text-xs">
              Draft, pending, scheduled, dan rejected (tanpa taken down).
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            {(stats.unpublishedByStatus ?? []).length === 0 ? (
              <div className="h-[220px] flex flex-col items-center justify-center text-center space-y-2">
                <PieChart className="h-7 w-7 text-muted-foreground/35" />
                <p className="text-xs font-bold text-foreground">
                  Pipeline kosong
                </p>
                <p className="text-[10px] text-muted-foreground max-w-[200px]">
                  Tidak ada naskah non-publish aktif saat ini.
                </p>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="relative h-[180px] w-[180px] shrink-0">
                  <Doughnut
                    data={unpublishedDoughnutData}
                    options={unpublishedDoughnutOptions}
                  />
                </div>
                <div className="flex-1 w-full space-y-2">
                  {(stats.unpublishedByStatus ?? []).map((row) => (
                    <div
                      key={row.status}
                      className="flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: row.color }}
                        />
                        <span className="font-medium text-foreground truncate">
                          {row.label}
                        </span>
                      </div>
                      <span className="font-bold text-foreground shrink-0">
                        {row.count.toLocaleString("id-ID")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Real-time Popular Stories & Doughnut Traffic Share */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Widget 1: Real-time Trending & Popular Articles */}
        <Card className="lg:col-span-2 border border-border flex flex-col h-full">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-terakota" />
                Real-time Trending Stories
              </CardTitle>
              <CardDescription className="text-xs">
                Naskah terbit dengan lonjakan pageviews tertinggi 24 jam terakhir.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex-1 p-0">
            <div className="divide-y divide-border">
              {stats.trendingArticles.map((article, idx) => (
                <div key={article.id} className="p-4 hover:bg-muted/15 transition-all flex items-center gap-4">
                  <span className="text-2xl font-black text-muted-foreground/30 w-8 shrink-0 text-center">
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0 space-y-1">
                    <h4 className="font-bold text-foreground text-sm leading-snug line-clamp-1 hover:text-terakota transition-colors cursor-pointer">
                      {article.title}
                    </h4>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span className="font-medium text-foreground/75">{article.author}</span>
                      <span>•</span>
                      <span>{article.category}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-extrabold text-foreground text-sm">
                      {article.views.toLocaleString()}
                    </p>
                    <span className="text-[10px] text-hijauSawah font-bold">{article.trendingRate}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Widget 2: Monthly Channel Traffic Share (Doughnut) */}
        <Card className="border border-border flex flex-col h-full">
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <PieChart className="h-4 w-4 text-foreground" />
              Monthly Channel Traffic Share
            </CardTitle>
            <CardDescription className="text-xs">
              Distribusi perolehan pageviews bulanan berdasarkan rubrikasi kanal berita.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-center space-y-6">
            {/* Doughnut Chart Canvas wrapper */}
            <div className="min-w-0 h-[160px] sm:h-[180px] w-full relative">
              <Doughnut data={doughnutData} options={doughnutOptions} />
            </div>

            {/* Custom legends list below the chart */}
            <div className="grid grid-cols-1 gap-3 pt-2 text-xs">
              {stats.channels.map((chan) => (
                <div key={chan.name} className="flex items-center justify-between p-2 rounded bg-muted/20 border border-border/10">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: chan.color }}
                    />
                    <span className="font-medium text-foreground/80 truncate">{chan.name}</span>
                  </div>
                  <span className="font-bold text-foreground text-right shrink-0 ml-2">
                    {chan.share}%
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Sorotan Beranda Monitor & Artikel Terjadwal (2/3 : 1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Kiri: Sorotan Beranda Monitor (2/3 width) */}
        <Card className="lg:col-span-2 border border-border flex flex-col h-full">
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Home className="h-4 w-4 text-terakota" />
              Sorotan Beranda Monitor
            </CardTitle>
            <CardDescription className="text-xs">
              Pemantauan performa sebaran jumlah artikel aktif dan total views per kontainer/slot beranda dalam 30 hari terakhir.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 flex-1 flex flex-col justify-center">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border">
              {homepageSections.map((sect, idx) => {
                const SectIcon = sect.icon;
                return (
                  <div
                    key={sect.name}
                    className={`p-5 flex items-center justify-between hover:bg-muted/10 transition-all ${
                      idx >= 3 ? "lg:border-t lg:border-border" : ""
                    } ${idx % 2 === 1 ? "sm:border-l sm:border-border" : ""}`}
                  >
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                        {sect.name}
                      </p>
                      <h4 className="text-base font-extrabold text-foreground">
                        {sect.articleCount} <span className="text-[11px] font-normal text-muted-foreground">Aktif</span>
                      </h4>
                      <p className="text-[11px] text-muted-foreground">
                        Views: <span className="font-semibold text-foreground/80">{sect.totalViews30d.toLocaleString()}</span> (30d)
                      </p>
                    </div>
                    <div className={`p-3 rounded-full shrink-0 ${sect.iconColor}`}>
                      <SectIcon className="h-5 w-5" />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Kanan: Artikel Terjadwal (1/3 width) */}
        <Card className="border border-border flex flex-col h-full">
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Clock className="h-4 w-4 text-hijauSawah" />
              Artikel Terjadwal
            </CardTitle>
            <CardDescription className="text-xs">
              5 Artikel terdekat yang dijadwalkan terbit otomatis dalam waktu dekat.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 p-0">
            <div className="divide-y divide-border">
              {stats.scheduledArticles.length > 0 ? (
                stats.scheduledArticles.map((article) => {
                  const scheduleDate = new Date(article.publishedAt);
                  const formattedTime = scheduleDate.toLocaleString("id-ID", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit"
                  });

                  return (
                    <div key={article.id} className="p-3.5 hover:bg-muted/15 transition-all flex flex-col gap-1.5">
                      <h4 className="font-bold text-foreground text-xs leading-snug line-clamp-1 hover:text-hijauSawah transition-colors cursor-pointer">
                        {article.title}
                      </h4>
                      <div className="flex items-center justify-between text-[9px] text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded bg-muted-foreground/10 text-foreground/80 font-medium">
                            {article.channel}
                          </span>
                          <span>•</span>
                          <span className="font-medium text-foreground/70">{article.author}</span>
                        </div>
                        <span className="font-bold text-hijauSawah bg-hijauSawah/10 px-1.5 py-0.5 rounded">
                          {formattedTime}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  Tidak ada artikel terjadwal rilis dalam waktu dekat.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 4: Performa Author | Editor (views) | Top Artikel — 14 hari, 1:1:1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {/* Panel 1: Performa Author */}
        <Card className="border border-border min-w-0">
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Users className="h-4 w-4 text-hijauSawah shrink-0" />
              Performa Author
            </CardTitle>
            <CardDescription className="text-xs">
              Top 5 penulis berdasarkan views 14 hari terakhir (artikel terbit, rerata, dan perubahan vs 14 hari sebelumnya).
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse min-w-[320px]">
                <thead>
                  <tr className="border-b border-border bg-muted/40 font-bold text-foreground">
                    <th className="p-3 w-10 text-center">#</th>
                    <th className="p-3">Nama</th>
                    <th className="p-3 text-center whitespace-nowrap">Artikel</th>
                    <th className="p-3 text-right whitespace-nowrap">Views</th>
                    <th className="p-3 text-right whitespace-nowrap">Rerata</th>
                    <th className="p-3 text-right whitespace-nowrap">%Δ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(stats.authorPerformance14d ?? []).length > 0 ? (
                    stats.authorPerformance14d.map((author) => (
                      <tr
                        key={`author-${author.rank}-${author.name}`}
                        className="hover:bg-muted/15 transition-all"
                      >
                        <td className="p-3 text-center font-extrabold text-muted-foreground">
                          {author.rank}
                        </td>
                        <td className="p-3 font-bold text-foreground max-w-[8rem] truncate">
                          {author.name}
                        </td>
                        <td className="p-3 text-center font-semibold text-foreground">
                          {author.articles}
                        </td>
                        <td className="p-3 text-right font-extrabold text-terakota">
                          {author.views.toLocaleString()}
                        </td>
                        <td className="p-3 text-right font-semibold text-foreground">
                          {author.avgViews.toLocaleString()}
                        </td>
                        <td
                          className={`p-3 text-right font-extrabold ${
                            author.deltaPct == null
                              ? "text-muted-foreground"
                              : author.deltaPct >= 0
                                ? "text-hijauSawah"
                                : "text-terakota"
                          }`}
                        >
                          {author.deltaPct == null
                            ? "—"
                            : `${author.deltaPct >= 0 ? "+" : ""}${author.deltaPct}%`}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={6}
                        className="p-8 text-center text-xs text-muted-foreground"
                      >
                        Belum ada data performa author 14 hari.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Panel 2: Performa Editor (views) */}
        <Card className="border border-border min-w-0">
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Clock className="h-4 w-4 text-terakota shrink-0" />
              Performa Editor
            </CardTitle>
            <CardDescription className="text-xs">
              Top 5 editor berdasarkan views 14 hari pada naskah yang mereka sunting, plus jumlah naskah dan SLA.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse min-w-[300px]">
                <thead>
                  <tr className="border-b border-border bg-muted/40 font-bold text-foreground">
                    <th className="p-3 w-10 text-center">#</th>
                    <th className="p-3">Nama</th>
                    <th className="p-3 text-right whitespace-nowrap">Views</th>
                    <th className="p-3 text-center whitespace-nowrap">Naskah</th>
                    <th className="p-3 text-right whitespace-nowrap">SLA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(stats.editorPerformance14d ?? []).length > 0 ? (
                    stats.editorPerformance14d.map((editor) => (
                      <tr
                        key={`editor-${editor.rank}-${editor.name}`}
                        className="hover:bg-muted/15 transition-all"
                      >
                        <td className="p-3 text-center font-extrabold text-muted-foreground">
                          {editor.rank}
                        </td>
                        <td className="p-3 font-bold text-foreground max-w-[8rem] truncate">
                          {editor.name}
                        </td>
                        <td className="p-3 text-right font-extrabold text-terakota">
                          {editor.views.toLocaleString()}
                        </td>
                        <td className="p-3 text-center font-semibold text-foreground">
                          {editor.articles}
                        </td>
                        <td className="p-3 text-right font-extrabold text-hijauSawah">
                          {editor.sla}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={5}
                        className="p-8 text-center text-xs text-muted-foreground"
                      >
                        Belum ada data performa editor 14 hari.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Panel 3: Top Artikel */}
        <Card className="border border-border min-w-0 md:col-span-2 xl:col-span-1">
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Eye className="h-4 w-4 text-hijauSawah shrink-0" />
              Top Artikel
            </CardTitle>
            <CardDescription className="text-xs">
              5 artikel dengan views tertinggi dalam 14 hari terakhir.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse min-w-[280px]">
                <thead>
                  <tr className="border-b border-border bg-muted/40 font-bold text-foreground">
                    <th className="p-3 w-10 text-center">#</th>
                    <th className="p-3">Judul</th>
                    <th className="p-3 whitespace-nowrap">Author</th>
                    <th className="p-3 text-right whitespace-nowrap">Views</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(stats.topArticles14d ?? []).length > 0 ? (
                    stats.topArticles14d.map((article) => (
                      <tr
                        key={`article-${article.rank}-${article.id}`}
                        className="hover:bg-muted/15 transition-all"
                      >
                        <td className="p-3 text-center font-extrabold text-muted-foreground align-top">
                          {article.rank}
                        </td>
                        <td className="p-3 font-bold text-foreground">
                          <span className="line-clamp-2 leading-snug">
                            {article.title}
                          </span>
                        </td>
                        <td className="p-3 text-muted-foreground max-w-[6rem] truncate align-top">
                          {article.author}
                        </td>
                        <td className="p-3 text-right font-extrabold text-terakota align-top whitespace-nowrap">
                          {article.views.toLocaleString()}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={4}
                        className="p-8 text-center text-xs text-muted-foreground"
                      >
                        Belum ada data top artikel 14 hari.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
