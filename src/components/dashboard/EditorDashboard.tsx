"use client";

import React, { useMemo } from "react";
import {
  Clock,
  CheckCircle,
  AlertCircle,
  Calendar,
  XCircle,
  ArrowRight,
  TrendingUp,
  PieChart,
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
import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { useEditorDashboard } from "@/hooks/useDashboardAnalytics";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

export default function EditorDashboard() {
  const { data: statsResponse, isLoading, error, refetch } = useEditorDashboard();

  const stats = statsResponse?.data;

  // 1. Memoized Doughnut data & options
  const doughnutData = useMemo(() => {
    if (!stats?.editedChannels) return { labels: [], datasets: [] };
    return {
      labels: stats.editedChannels.map((c) => c.name),
      datasets: [
        {
          data: stats.editedChannels.map((c) => c.count),
          backgroundColor: stats.editedChannels.map((c) => c.color),
          borderWidth: 1.5,
          borderColor: "rgba(255, 255, 255, 0.4)",
          hoverOffset: 6,
        },
      ],
    };
  }, [stats?.editedChannels]);

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
              return ` ${context.label}: ${val} Artikel`;
            },
          },
        },
      },
      cutout: "68%",
    };
  }, []);

  // Loading Skeletons state
  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        {/* KPI Cards Skeletons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-muted rounded-lg border border-border"></div>
          ))}
        </div>
        {/* Row 2 Grid Skeletons */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-[380px] bg-muted rounded-lg border border-border"></div>
          <div className="h-[380px] bg-muted rounded-lg border border-border animate-pulse space-y-6">
            <div className="h-[180px] bg-muted rounded-lg border border-border"></div>
            <div className="h-[180px] bg-muted rounded-lg border border-border"></div>
          </div>
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
        <h3 className="text-sm font-bold">Gagal Memuat Analitik Editor</h3>
        <p className="text-xs text-muted-foreground max-w-sm">
          {error instanceof Error
            ? error.message
            : "Terjadi masalah koneksi atau hak akses ditolak untuk role Editor."}
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2 text-xs">
          <RefreshCw className="h-3.5 w-3.5" />
          Coba Lagi
        </Button>
      </div>
    );
  }

  // Persentase target bulanan terselesaikan
  const reviewProgressRate = stats.monthlyReviewTarget > 0
    ? parseFloat(((stats.monthlyReviewCount / stats.monthlyReviewTarget) * 100).toFixed(1))
    : 100;

  return (
    <div className="space-y-6">
      {/* Row 1: Workload & SLA KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card 1: Rata-rata SLA */}
        <Card className="hover:shadow-md transition-all duration-300 border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Rata-rata Waktu Review
            </span>
            <div className="p-2 bg-hijauSawah/10 text-hijauSawah rounded-full">
              <Clock className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold tracking-tight text-hijauSawah">
              {stats.avgSlaMinutes} <span className="text-sm font-medium text-muted-foreground">m</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Target kepatuhan redaksi: &lt; 30 menit
            </p>
          </CardContent>
        </Card>

        {/* Card 2: Kepatuhan SLA */}
        <Card className="hover:shadow-md transition-all duration-300 border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              SLA Compliance Rate
            </span>
            <div className="p-2 bg-foreground/5 text-foreground rounded-full">
              <TrendingUp className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold tracking-tight text-foreground">
              {stats.slaComplianceRate}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Persentase review selesai tepat waktu
            </p>
          </CardContent>
        </Card>

        {/* Card 3: Target Review Bulanan (Progress bar) */}
        <Card className="hover:shadow-md transition-all duration-300 border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Target Review Bulanan
            </span>
            <div className="p-2 bg-foreground/5 text-foreground rounded-full">
              <CheckCircle className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold tracking-tight text-foreground">
              {stats.monthlyReviewCount} <span className="text-sm font-medium text-muted-foreground">/ {stats.monthlyReviewTarget}</span>
            </div>
            <div className="space-y-1.5 mt-2">
              <div className="w-full bg-muted-foreground/15 h-1 rounded-full overflow-hidden">
                <div 
                  className="bg-foreground h-1 rounded-full transition-all duration-500" 
                  style={{ width: `${Math.min(reviewProgressRate, 100)}%` }} 
                />
              </div>
              <p className="text-[10px] text-muted-foreground text-right font-medium">
                {reviewProgressRate}% Terselesaikan
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Strictness Rate */}
        <Card className="hover:shadow-md transition-all duration-300 border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Rejection / Revision Rate
            </span>
            <div className="p-2 bg-terakota/10 text-terakota rounded-full">
              <XCircle className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold tracking-tight text-terakota">
              {stats.rejectionRate}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Rasio draf dikembalikan untuk direvisi
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Urgent Pending Queue & Calendar Backlog */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Kolom Kiri & Tengah: Urgent Pending Review Queue (2/3 width) */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="border border-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-terakota" />
                  Urgent Pending Review Queue
                </CardTitle>
                <CardDescription className="text-xs">
                  Naskah masuk dari penulis yang mengantre untuk disunting dan disetujui terbit.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {stats.pendingQueue.length > 0 ? (
                  stats.pendingQueue.map((item) => (
                    <div key={item.id} className="p-4 hover:bg-muted/15 transition-all">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <h4 className="font-bold text-foreground text-sm leading-snug line-clamp-1 hover:text-terakota transition-colors cursor-pointer">
                            {item.title}
                          </h4>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                            <span className="font-medium text-foreground/75">{item.author}</span>
                            <span>•</span>
                            <span>{item.category}</span>
                            <span>•</span>
                            <span>Kirim: {item.submittedTime}</span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end shrink-0">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border uppercase shrink-0 ${item.statusColor}`}
                          >
                            Tunggu: {item.waitTime}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs font-semibold p-1 hover:text-terakota mt-1"
                          >
                            Sunting <ArrowRight className="h-3 w-3 ml-0.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-xs text-muted-foreground">
                    Tidak ada naskah yang mengantre di meja sunting saat ini.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Kolom Kanan: Backlog & Category Stats */}
        <div className="space-y-6">
          {/* Widget 1: Editorial Calendar Backlog */}
          <Card className="border border-border">
            <CardHeader>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Calendar className="h-4 w-4 text-foreground" />
                24-Hour Editorial Calendar
              </CardTitle>
              <CardDescription className="text-xs">
                Daftar naskah terjadwal yang rilis otomatis hari ini.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {stats.calendarBacklog.length > 0 ? (
                  stats.calendarBacklog.map((item) => (
                    <div key={item.id} className="p-4 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-bold text-foreground text-xs leading-snug line-clamp-1">
                          {item.title}
                        </h4>
                        <span className="text-[10px] text-muted-foreground font-semibold shrink-0">
                          {item.scheduledTime}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>{item.author} • {item.category}</span>
                        <span
                          className={`font-bold ${
                            item.format === "GALLERY" ? "text-terakota" : "text-hijauSawah"
                          }`}
                        >
                          {item.format}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-xs text-muted-foreground">
                    Tidak ada artikel terjadwal rilis hari ini.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Widget 2: Kategori yang Saya Sunting (Pie/Doughnut Chart) */}
          <Card className="border border-border">
            <CardHeader>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <PieChart className="h-4 w-4 text-terakota" />
                Kategori yang Saya Sunting
              </CardTitle>
              <CardDescription className="text-xs">
                Distribusi persentase topik rubrikasi artikel yang telah disunting dan diterbitkan oleh Anda.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Doughnut Wrapper */}
              <div className="h-[120px] sm:h-[150px] w-full relative min-w-0">
                {stats.editedChannels.length > 0 ? (
                  <Doughnut data={doughnutData} options={doughnutOptions} />
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-muted-foreground border border-dashed rounded-md">
                    Belum ada topik disunting
                  </div>
                )}
              </div>

              {/* Legends List */}
              <div className="space-y-2 pt-1 text-xs">
                {stats.editedChannels.length > 0 ? (
                  stats.editedChannels.map((chan) => (
                    <div key={chan.name} className="flex items-center justify-between p-1.5 rounded bg-muted/20 border border-border/10">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: chan.color }}
                        />
                        <span className="font-medium text-foreground/80 truncate">{chan.name}</span>
                      </div>
                      <span className="font-bold text-foreground shrink-0 ml-2">
                        {chan.count} Art ({chan.pct}%)
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-xs text-muted-foreground">
                    Belum ada data distribusi topik suntingan.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
