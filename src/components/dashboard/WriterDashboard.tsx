"use client";

import React, { useMemo } from "react";
import {
  BookOpen,
  Send,
  RefreshCw,
  Award,
  AlertTriangle,
  Flame,
  ArrowRight,
  TrendingUp,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { useWriterDashboard } from "@/hooks/useDashboardAnalytics";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
);

export default function WriterDashboard() {
  const {
    data: statsResponse,
    isLoading,
    error,
    refetch,
  } = useWriterDashboard();
  const stats = statsResponse?.data;

  // 1. Grafik Tren Pageviews Harian (7 Hari Terakhir)
  const chartData = useMemo(() => {
    if (!stats?.pageviewTrend) {
      return { labels: [], datasets: [] };
    }
    return {
      labels: stats.pageviewTrend.map((row) => row.date),
      datasets: [
        {
          label: "Pageviews Artikel Saya",
          data: stats.pageviewTrend.map((row) => row.views),
          borderColor: "#c16b4c", // Terakota
          backgroundColor: "rgba(193, 107, 76, 0.04)",
          fill: true,
          tension: 0.35,
          borderWidth: 2.5,
          pointBackgroundColor: "#c16b4c",
          pointHoverRadius: 6,
        },
      ],
    };
  }, [stats]);

  const chartOptions = useMemo(() => {
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
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { family: "Rubik", size: 10 } },
        },
        y: {
          grid: { color: "rgba(0,0,0,0.04)" },
          ticks: { font: { family: "Rubik", size: 10 } },
        },
      },
    };
  }, []);

  // 2. Loading Skeletons state
  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Row 1 Skeletons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-32 bg-muted/65 animate-pulse rounded-lg border border-border"
            ></div>
          ))}
        </div>

        {/* Row 2 Skeletons */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="h-[340px] bg-muted/65 animate-pulse rounded-lg border border-border"></div>
            <div className="h-[280px] bg-muted/65 animate-pulse rounded-lg border border-border"></div>
          </div>
          <div className="h-[646px] bg-muted/65 animate-pulse rounded-lg border border-border"></div>
        </div>
      </div>
    );
  }

  // 3. Error Boundary State
  if (error || !stats) {
    return (
      <div className="flex flex-col items-center justify-center h-[350px] border border-dashed rounded-lg p-6 space-y-4 text-center">
        <div className="p-3 bg-destructive/10 text-destructive rounded-full">
          <ShieldAlert className="h-8 w-8 text-terakota" />
        </div>
        <h3 className="text-sm font-bold">Gagal Memuat Dashboard Penulis</h3>
        <p className="text-xs text-muted-foreground max-w-sm">
          {error instanceof Error
            ? error.message
            : "Terjadi kesalahan autentikasi atau hak akses ditolak untuk peran Content Writer."}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          className="gap-2 text-xs"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Coba Lagi
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Row 1: My Monthly Achievement Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card 1: Artikel Terbit (Target) */}
        <Card className="hover:shadow-md transition-all duration-300 border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Terbit Bulan Ini
            </span>
            <div className="p-2 bg-hijauSawah/10 text-hijauSawah rounded-full">
              <BookOpen className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold tracking-tight text-foreground">
              {stats.publishedThisMonth}{" "}
              <span className="text-sm font-medium text-muted-foreground">
                / {stats.publishedTarget}
              </span>
            </div>
            <div className="space-y-1.5 mt-2">
              <div className="w-full bg-muted-foreground/15 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-hijauSawah h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${stats.progressPercent}%` }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground text-right font-medium">
                {stats.progressPercent}% Target Tercapai
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Draf Diajukan */}
        <Card className="hover:shadow-md transition-all duration-300 border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Draf Diajukan
            </span>
            <div className="p-2 bg-foreground/5 text-foreground rounded-full">
              <Send className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold tracking-tight text-foreground">
              {stats.submittedDrafts}{" "}
              <span className="text-sm font-medium text-muted-foreground">
                Naskah
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Menunggu keputusan suntingan editor
            </p>
          </CardContent>
        </Card>

        {/* Card 3: Tingkat Revisi Penulis */}
        <Card className="hover:shadow-md transition-all duration-300 border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Tingkat Revisi Pribadi
            </span>
            <div className="p-2 bg-foreground/5 text-foreground rounded-full">
              <RefreshCw className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold tracking-tight text-foreground">
              {stats.revisionRate}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.revisionRate <= 15
                ? "Bagus! Di bawah batas maksimal 15%"
                : "Perhatian! Di atas batas toleransi 15%"}
            </p>
          </CardContent>
        </Card>

        {/* Card 4: Total Pembaca Bulanan */}
        <Card className="hover:shadow-md transition-all duration-300 border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Total Pembaca Saya
            </span>
            <div className="p-2 bg-terakota/10 text-terakota rounded-full">
              <Award className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold tracking-tight text-terakota animate-pulse">
              {stats.viewsThisMonth.toLocaleString("id-ID")}{" "}
              <span className="text-xs text-muted-foreground">views</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Kontribusi traffic bulan berjalan (Total:{" "}
              {stats.totalViews.toLocaleString("id-ID")})
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Pageview Trend & Feedback Inbox */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Kolom Kiri & Tengah: Traffic Line Chart (2/3 width) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Grafik Pageview Tren */}
          <Card className="border border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-terakota" />
                  Personal Pageview Trend
                </CardTitle>
                <CardDescription className="text-xs">
                  Grafik performa pembaca harian dari seluruh artikel karya
                  tulis Anda (7 hari terakhir).
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="min-w-0 h-[220px] sm:h-[280px] relative">
                {stats.pageviewTrend.length === 0 ||
                stats.pageviewTrend.every((r) => r.views === 0) ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center space-y-2 bg-background/50">
                    <TrendingUp className="h-7 w-7 text-muted-foreground/35" />
                    <p className="text-xs font-bold text-foreground">
                      Belum Ada Trafik Pembaca
                    </p>
                    <p className="text-[10px] text-muted-foreground max-w-[240px]">
                      Kunjungan pembaca dalam 7 hari terakhir pada artikel Anda
                      akan digambarkan di sini.
                    </p>
                  </div>
                ) : (
                  <Line data={chartData} options={chartOptions} />
                )}
              </div>
            </CardContent>
          </Card>

          {/* Inbox Masukan Revisi Editor */}
          <Card className="border border-border">
            <CardHeader>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-terakota animate-bounce" />
                Rejection & Revision Feedback Inbox
              </CardTitle>
              <CardDescription className="text-xs">
                Draf artikel Anda yang dikembalikan oleh editor beserta alasan
                catatan perbaikannya.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 border-t border-border">
              {stats.revisionInbox.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center min-h-[160px]">
                  <Award className="h-7 w-7 text-hijauSawah mb-2" />
                  <p className="text-xs font-bold text-foreground">
                    Semua Draf Bersih!
                  </p>
                  <p className="text-[10px] text-muted-foreground max-w-[280px] mt-1">
                    Hebat! Tidak ada draf tulisan Anda yang sedang dikembalikan
                    oleh editor untuk direvisi saat ini.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {stats.revisionInbox.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 space-y-3 hover:bg-muted/15 transition-all"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <h4 className="font-bold text-foreground text-sm leading-snug line-clamp-1">
                            {item.title}
                          </h4>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                            <span className="font-semibold text-foreground/70">
                              {item.editor}
                            </span>
                            <span>•</span>
                            <span>{item.date}</span>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs font-semibold shrink-0 border-terakota/35 hover:bg-terakota/5 hover:text-terakota"
                        >
                          Perbaiki Draf{" "}
                          <ArrowRight className="h-3.5 w-3.5 ml-1" />
                        </Button>
                      </div>
                      <div className="p-3 rounded bg-terakota/5 border border-terakota/10 text-xs text-muted-foreground leading-relaxed italic">
                        " {item.reason} "
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Kolom Kanan: Top Performing Stories */}
        <div className="">
          <Card className="border border-border flex flex-col h-full">
            <CardHeader className="pb-3 border-b border-border mb-0">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Flame className="h-4 w-4 text-terakota" />
                My Top Performing Stories
              </CardTitle>
              <CardDescription className="text-xs mb-0">
                Karya terbaik Anda bulan ini berdasarkan kuantitas views
                pembaca.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 flex-1 flex flex-col mt-0">
              {stats.topStories.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center min-h-[260px] flex-1">
                  <BookOpen className="h-8 w-8 text-muted-foreground/35 mb-2.5" />
                  <p className="text-xs font-bold text-foreground">
                    Belum Ada Artikel Terbit
                  </p>
                  <p className="text-[10px] text-muted-foreground max-w-[200px] mt-1">
                    Daftar tulisan Anda yang telah dipublikasikan akan diurutkan
                    dari views tertinggi di sini.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {stats.topStories.map((story, index) => (
                    <div
                      key={story.id}
                      className="p-4 flex items-center gap-3 hover:bg-muted/10 transition-all first:pt-0 last:pb-0"
                    >
                      <span className="text-2xl font-black text-muted-foreground/30 w-6 shrink-0 text-center">
                        {index + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-foreground text-xs leading-snug line-clamp-2 hover:text-terakota cursor-pointer transition-colors">
                          {story.title}
                        </h4>
                        <div className="flex items-center gap-3 mt-1.5 text-[9px] text-muted-foreground font-medium">
                          <span>CTR: {story.ctr}</span>
                          <span>•</span>
                          <span>{story.shares} Shares</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-extrabold text-foreground text-xs">
                          {story.views.toLocaleString()}
                        </p>
                        <p className="text-[9px] text-muted-foreground">
                          views
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
