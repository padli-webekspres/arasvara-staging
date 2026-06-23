"use client";

import React, { useMemo, useState } from "react";
import {
  Users,
  ShieldAlert,
  Database,
  Clock,
  Calendar,
  Activity,
  RefreshCw,
  Award,
  Send,
  DollarSign,
  Shield,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { useAdminDashboard } from "@/hooks/useDashboardAnalytics";

// Impor Chart.js dan react-chartjs-2 untuk Pie Chart
import { Pie } from "react-chartjs-2";
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

// Impor 4 Sub-Dashboard Lainnya untuk Tabs Super Admin
import EditorInChiefDashboard from "./EditorInChiefDashboard";
import EditorDashboard from "./EditorDashboard";
import WriterDashboard from "./WriterDashboard";
import AEDashboard from "./AEDashboard";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

export default function AdminDashboard() {
  // React Query Hook untuk integrasi backend Super Admin
  const { data: statsResponse, isLoading, error, refetch } = useAdminDashboard();
  
  const stats = statsResponse?.data;

  // State untuk Tabs Super Admin
  const [activeTab, setActiveTab] = useState<"monitor" | "chief" | "editor" | "writer" | "ae">("monitor");

  // Konfigurasi Memoized Pie Chart untuk Pembagian Role
  const pieData = useMemo(() => {
    if (!stats?.roleDistribution) return { labels: [], datasets: [] };
    return {
      labels: stats.roleDistribution.map((item) => item.label),
      datasets: [
        {
          data: stats.roleDistribution.map((item) => item.count),
          backgroundColor: stats.roleDistribution.map((item) => item.color),
          borderWidth: 1.5,
          borderColor: "rgba(255, 255, 255, 0.4)",
          hoverOffset: 6,
        },
      ],
    };
  }, [stats]);

  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false, // Legenda kustom yang lebih cantik dengan HTML
      },
      tooltip: {
        backgroundColor: "rgba(15, 23, 42, 0.9)", // Slate 900
        titleColor: "#ffffff",
        bodyColor: "#ffffff",
        borderColor: "rgba(255, 255, 255, 0.1)",
        borderWidth: 1,
        padding: 10,
        boxPadding: 6,
        usePointStyle: true,
        callbacks: {
          label: function (context: any) {
            const count = context.raw || 0;
            const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
            const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : 0;
            return ` ${context.label}: ${count} Pengguna (${percentage}%)`;
          },
        },
      },
    },
  };

  // Loading Skeletons state
  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-28 bg-muted rounded-lg border border-border"></div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-[350px] bg-muted rounded-lg border border-border"></div>
          <div className="h-[350px] bg-muted rounded-lg border border-border"></div>
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
        <h3 className="text-sm font-bold">Gagal Memuat Analitik Super Admin</h3>
        <p className="text-xs text-muted-foreground max-w-sm">
          {error instanceof Error
            ? error.message
            : "Terjadi masalah koneksi atau hak akses ditolak untuk role administrator."}
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2 text-xs">
          <RefreshCw className="h-3.5 w-3.5" />
          Coba Lagi
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ─── Premium Dashboard Tabs untuk Super Admin ────────────────────────── */}
      <div className="flex flex-wrap gap-2 p-1.5 bg-muted border border-border rounded-xl w-full sm:w-max">
        <button
          onClick={() => setActiveTab("monitor")}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all duration-300 ${
            activeTab === "monitor"
              ? "bg-background text-foreground shadow-sm border border-border/60"
              : "text-muted-foreground hover:text-foreground hover:bg-background/25"
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          System Monitor
        </button>
        <button
          onClick={() => setActiveTab("chief")}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all duration-300 ${
            activeTab === "chief"
              ? "bg-background text-foreground shadow-sm border border-border/60"
              : "text-muted-foreground hover:text-foreground hover:bg-background/25"
          }`}
        >
          <Award className="w-3.5 h-3.5 text-amber-500" />
          Pemred Board
        </button>
        <button
          onClick={() => setActiveTab("editor")}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all duration-300 ${
            activeTab === "editor"
              ? "bg-background text-foreground shadow-sm border border-border/60"
              : "text-muted-foreground hover:text-foreground hover:bg-background/25"
          }`}
        >
          <Clock className="w-3.5 h-3.5 text-emerald-500" />
          Editor Board
        </button>
        <button
          onClick={() => setActiveTab("writer")}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all duration-300 ${
            activeTab === "writer"
              ? "bg-background text-foreground shadow-sm border border-border/60"
              : "text-muted-foreground hover:text-foreground hover:bg-background/25"
          }`}
        >
          <Send className="w-3.5 h-3.5 text-terakota" />
          Writer Board
        </button>
        <button
          onClick={() => setActiveTab("ae")}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all duration-300 ${
            activeTab === "ae"
              ? "bg-background text-foreground shadow-sm border border-border/60"
              : "text-muted-foreground hover:text-foreground hover:bg-background/25"
          }`}
        >
          <DollarSign className="w-3.5 h-3.5 text-slate-500" />
          AE Board
        </button>
      </div>

      {/* ─── Konten Aktif Berdasarkan Tab Terpilih ──────────────────────────── */}
      <div className="transition-all duration-300">
        {activeTab === "monitor" && (
          <div className="space-y-6">
            {/* Row 1: KPI Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
              {/* Card 1: Staf Online */}
              <Card className="hover:shadow-md transition-all duration-300 border-border bg-card">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Staf Online
                  </span>
                  <div className="p-2 bg-foreground/5 text-foreground rounded-full">
                    <Users className="h-4 w-4" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-extrabold tracking-tight text-foreground">
                    {stats.stafOnline} <span className="text-sm font-medium text-muted-foreground">Aktif</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Aktif 5 menit terakhir
                  </p>
                </CardContent>
              </Card>

              {/* Card 2: Audit Log (24 Jam) */}
              <Card className="hover:shadow-md transition-all duration-300 border-border bg-card">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Audit Log (24j)
                  </span>
                  <div className="p-2 bg-foreground/5 text-foreground rounded-full">
                    <ShieldAlert className="h-4 w-4" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-extrabold tracking-tight text-foreground">
                    {stats.dailyAuditCount} <span className="text-xs text-muted-foreground">logs</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Aktivitas terekam hari ini
                  </p>
                </CardContent>
              </Card>

              {/* Card 3: Total Berkas Media */}
              <Card className="hover:shadow-md transition-all duration-300 border-border bg-card">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Total Media
                  </span>
                  <div className="p-2 bg-foreground/5 text-foreground rounded-full">
                    <Database className="h-4 w-4" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-extrabold tracking-tight text-foreground">
                    {stats.totalMedia.toLocaleString()} <span className="text-xs text-muted-foreground">files</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Berkas media terunggah
                  </p>
                </CardContent>
              </Card>

              {/* Card 4: Artikel Menunggu Submitted */}
              <Card className="hover:shadow-md transition-all duration-300 border-border bg-card">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Menunggu Submitted
                  </span>
                  <div className="p-2 bg-terakota/10 text-terakota rounded-full">
                    <Clock className="h-4 w-4" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-extrabold tracking-tight text-terakota">
                    {stats.pendingReviewCount} <span className="text-sm font-medium text-muted-foreground">Naskah</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Menunggu persetujuan editor
                  </p>
                </CardContent>
              </Card>

              {/* Card 5: Artikel Scheduled */}
              <Card className="hover:shadow-md transition-all duration-300 border-border bg-card">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Artikel Scheduled
                  </span>
                  <div className="p-2 bg-hijauSawah/10 text-hijauSawah rounded-full">
                    <Calendar className="h-4 w-4" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-extrabold tracking-tight text-hijauSawah">
                    {stats.scheduledCount} <span className="text-sm font-medium text-muted-foreground">Rilis</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Terjadwal rilis otomatis hari ini
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Row 2: Live Feed Audit Logs & Pie Chart Role Distribution */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Kolom Kiri: Live Audit Feed (2/3 width) */}
              <div className="lg:col-span-2 space-y-4">
                <Card className="border border-border">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-base font-bold flex items-center gap-2">
                        <Activity className="h-4 w-4 text-terakota" />
                        Recent Audit Trail Tracker
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Feed aktivitas administratif krusial terbaru di seluruh platform CMS (real-time).
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted py-1 px-2.5 rounded-md">
                      <span className="h-2 w-2 rounded-full bg-hijauSawah animate-ping" />
                      Live Monitoring
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y divide-border">
                      {stats.recentLogs.length > 0 ? (
                        stats.recentLogs.map((log) => {
                          let badgeColor = "text-foreground bg-foreground/5 border-foreground/10";
                          if (log.action === "DELETE" || log.action === "DEACTIVATE") {
                            badgeColor = "text-terakota bg-terakota/10 border-terakota/20";
                          } else if (log.action === "CREATE") {
                            badgeColor = "text-hijauSawah bg-hijauSawah/10 border-hijauSawah/20";
                          } else if (log.action === "SECURITY") {
                            badgeColor = "text-red-600 bg-red-500/10 border-red-500/20";
                          }

                          return (
                            <div key={log.id} className="p-4 hover:bg-muted/15 transition-all">
                              <div className="flex items-start justify-between gap-3">
                                <div className="space-y-1.5">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span
                                      className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase shrink-0 ${badgeColor}`}
                                    >
                                      {log.action}
                                    </span>
                                    <span className="font-semibold text-foreground text-sm">
                                      {log.target}
                                    </span>
                                    <span className="text-xs text-muted-foreground">• {log.user}</span>
                                  </div>
                                  <p className="text-xs text-muted-foreground leading-relaxed">
                                    {log.detail}
                                  </p>
                                </div>
                                <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">
                                  {log.time}
                                </span>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="p-8 text-center text-xs text-muted-foreground">
                          Belum ada aktivitas audit log tercatat hari ini.
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Kolom Kanan: Distribusi Pengguna Berdasarkan Role */}
              <div className="space-y-6">
                <Card className="border border-border flex flex-col h-full justify-between">
                  <CardHeader>
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <Users className="h-4 w-4 text-foreground" />
                      Komposisi Peran Pengguna
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Persentase jumlah staf terdaftar berdasarkan fungsi/role editorial.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6 flex-1 flex flex-col justify-center">
                    {/* Visual Pie Chart */}
                    <div className="relative h-44 w-full flex items-center justify-center">
                      {stats.roleDistribution && stats.roleDistribution.length > 0 ? (
                        <Pie data={pieData} options={pieOptions} />
                      ) : (
                        <div className="text-xs text-muted-foreground">Tidak ada data pengguna.</div>
                      )}
                    </div>

                    {/* Legenda Kustom Premium */}
                    <div className="space-y-2.5 pt-2 border-t border-border">
                      {stats.roleDistribution?.map((item) => (
                        <div key={item.role} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: item.color }}
                            />
                            <span className="font-semibold text-foreground/80">{item.label}</span>
                          </div>
                          <div className="flex items-center gap-2 font-bold text-foreground">
                            <span>{item.count} Staf</span>
                            <span className="text-[10px] text-muted-foreground font-normal">
                              ({item.percentage}%)
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        )}
        {activeTab === "chief" && <EditorInChiefDashboard />}
        {activeTab === "editor" && <EditorDashboard />}
        {activeTab === "writer" && <WriterDashboard />}
        {activeTab === "ae" && <AEDashboard />}
      </div>
    </div>
  );
}
