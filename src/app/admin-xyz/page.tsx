"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Plus,
  Sparkles,
  Shield,
  Award,
  Clock,
  Send,
  DollarSign,
  ChevronRight,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { adminPanelHref } from "@/lib/admin-panel-path";
import api from "@/lib/axios";

// Import 5 sub-dashboard views
import AdminDashboard from "@/components/dashboard/AdminDashboard";
import EditorInChiefDashboard from "@/components/dashboard/EditorInChiefDashboard";
import EditorDashboard from "@/components/dashboard/EditorDashboard";
import WriterDashboard from "@/components/dashboard/WriterDashboard";
import AEDashboard from "@/components/dashboard/AEDashboard";

// Definisi Label & Deskripsi Peran (Role) untuk mempermudah debugging
const ROLE_METADATA: Record<
  string,
  { label: string; description: string; icon: any; color: string }
> = {
  admin: {
    label: "Super Admin",
    description:
      "Kestabilan platform, audit trail sistem, pembersihan berkas media, & log firewall.",
    icon: Shield,
    color: "text-foreground bg-foreground/5 border-foreground/15",
  },
  "editor-in-chief": {
    label: "Pemimpin Redaksi",
    description:
      "Performa makro traffic pembaca situs, target korporat, & sorotan beranda unggulan.",
    icon: Award,
    color: "text-terakota bg-terakota/10 border-terakota/20",
  },
  editor: {
    label: "Editor Redaksi",
    description:
      "Pengawasan gatekeeping, review naskah mengantre, & rasio kepatuhan target SLA.",
    icon: Clock,
    color: "text-hijauSawah bg-hijauSawah/10 border-hijauSawah/20",
  },
  writer: {
    label: "Content Writer",
    description:
      "Produktivitas penulisan artikel bulanan, grafik harian personal, & kotak saran revisi.",
    icon: Send,
    color: "text-terakota bg-terakota/10 border-terakota/20",
  },
  "account-executive": {
    label: "Account Executive",
    description:
      "Kampanye iklan spanduk komersial, target konversi CTR, & slot inventaris kerja sama.",
    icon: DollarSign,
    color: "text-foreground bg-foreground/5 border-foreground/15",
  },
};

export default function UnifiedAdminDashboard() {
  const [mounted, setMounted] = useState(false);
  const [activeRole, setActiveRole] = useState<string>("admin");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    setMounted(true);

    // Ambil data profil pengguna yang login secara riil dari API
    api
      .get("/auth/me")
      .then((res) => {
        if (res.data?.loggedIn && res.data?.user) {
          const user = res.data.user;
          setCurrentUser(user);

          // Default tampilan role disesuaikan otomatis dengan role riil pengguna
          const resolvedRole = user.role?.toLowerCase();
          if (ROLE_METADATA[resolvedRole]) {
            setActiveRole(resolvedRole);
          }
        }
      })
      .catch((err) => {
        console.error("Gagal menarik data profil pengguna:", err);
      })
      .finally(() => {
        setAuthLoading(false);
      });
  }, []);

  if (!mounted || authLoading) {
    return (
      <div className="min-w-0 max-w-full space-y-4 sm:space-y-6 p-4 animate-pulse">
        <div className="h-10 bg-muted rounded w-1/4"></div>
        <div className="h-28 bg-muted rounded"></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="h-28 bg-muted rounded"></div>
          <div className="h-28 bg-muted rounded"></div>
          <div className="h-28 bg-muted rounded"></div>
          <div className="h-28 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  // Render Component Dashboard yang sesuai dengan role terpilih saat ini
  const renderDashboardContent = () => {
    // PROTEKSI: Hanya akun dengan role riil 'admin' yang bisa membaca Super Admin dashboard
    if (activeRole === "admin") {
      const realRole = currentUser?.role?.toLowerCase();
      if (realRole !== "admin") {
        return (
          <div className="flex flex-col items-center justify-center p-8 border border-dashed border-terakota/30 rounded-lg bg-card text-center min-h-[300px] space-y-4">
            <div className="p-3.5 bg-terakota/10 text-terakota rounded-full animate-pulse">
              <ShieldAlert className="h-8 w-8 text-terakota" />
            </div>
            <h3 className="font-bold text-sm text-foreground">
              Akses Ditolak: Hanya untuk Super Admin
            </h3>
            <p className="text-xs text-muted-foreground max-w-md leading-relaxed">
              Maaf, akun Anda ({currentUser?.name || "Pengguna"}) terdaftar
              dengan peran{" "}
              <span className="font-bold uppercase text-terakota">
                {currentUser?.role || "Staf"}
              </span>
              . Panel Super Admin berisi konfigurasi kerentanan sistem,
              monitoring server, dan logs audit sensitif yang hanya diizinkan
              untuk Administrator.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveRole(realRole || "writer")}
              className="text-xs border-terakota/25 hover:bg-terakota/5 hover:text-terakota"
            >
              Kembali ke Dashboard Peran Saya
            </Button>
          </div>
        );
      }
    }

    switch (activeRole) {
      case "admin":
        return <AdminDashboard />;
      case "editor-in-chief":
        return <EditorInChiefDashboard />;
      case "editor":
        return <EditorDashboard />;
      case "writer":
        return <WriterDashboard />;
      case "account-executive":
        return <AEDashboard />;
      default:
        return <AdminDashboard />;
    }
  };

  const currentRoleMeta = ROLE_METADATA[activeRole] || ROLE_METADATA.admin;
  const RoleIcon = currentRoleMeta.icon;

  return (
    <div className="min-w-0 max-w-full space-y-4 sm:space-y-6">
      {/* 1. Header & Dynamic Role Debugging Switcher */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between pb-3 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            Dashboard Utama
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-extrabold bg-hijauSawah/10 text-hijauSawah border border-hijauSawah/15 uppercase tracking-wider shrink-0">
              <Sparkles className="w-2.5 h-2.5 mr-1 shrink-0" />
              Dynamic UI
            </span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Selamat datang kembali di panel editorial Arasvara CMS. Halaman
            disajikan dinamis sesuai peran Anda.
          </p>
        </div>

        {/* Debugging Selector Tool */}
        <div className="flex flex-wrap items-center gap-2 bg-muted/40 p-1.5 border border-border rounded-md shrink-0 w-full sm:w-auto">
          <span className="text-[11px] font-semibold text-muted-foreground px-2 hidden sm:inline-block">
            Simulasi Peran:
          </span>
          <Select value={activeRole} onValueChange={setActiveRole}>
            <SelectTrigger className="w-full sm:w-[170px] h-8 text-xs font-semibold bg-background">
              <SelectValue placeholder="Pilih Role Dashboard" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Super Admin</SelectItem>
              <SelectItem value="editor-in-chief">Pemimpin Redaksi</SelectItem>
              <SelectItem value="editor">Editor Redaksi</SelectItem>
              <SelectItem value="writer">Content Writer</SelectItem>
              <SelectItem value="account-executive">
                Account Executive
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 2. Informasi Peran Aktif saat ini */}
      {/* <div className={`p-4 border rounded-lg flex flex-col sm:flex-row sm:items-center gap-3 transition-all duration-300 ${currentRoleMeta.color}`}>
        <div className="p-2.5 rounded-full bg-background border border-border shrink-0 self-start sm:self-auto">
          <RoleIcon className="w-5 h-5 text-foreground" />
        </div>
        <div className="space-y-0.5">
          <p className="text-xs font-extrabold text-foreground">
            Menampilkan Mode: {currentRoleMeta.label}
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {currentRoleMeta.description}
          </p>
        </div>
      </div> */}

      {/* 3. Render Dashboard Konten Utama Peran */}
      <div className="transition-all duration-300">
        {renderDashboardContent()}
      </div>

      {/* 4. Panel Cepat CMS Aksi Global */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
        <Link href={adminPanelHref("articles/new")} className="group">
          <div className="bg-card border border-border hover:border-terakota/40 rounded-lg p-5 flex items-center justify-between cursor-pointer transition-all duration-300 hover:shadow-xs">
            <div className="space-y-0.5">
              <h4 className="font-bold text-sm text-foreground group-hover:text-terakota transition-colors">
                Tulis Artikel Baru
              </h4>
              <p className="text-xs text-muted-foreground">
                Tulis draf naskah standard atau galeri baru.
              </p>
            </div>
            <Plus className="h-5 w-5 text-muted-foreground group-hover:text-terakota transition-colors shrink-0 ml-2" />
          </div>
        </Link>

        <Link href={adminPanelHref("configuration")} className="group">
          <div className="bg-card border border-border hover:border-hijauSawah/40 rounded-lg p-5 flex items-center justify-between cursor-pointer transition-all duration-300 hover:shadow-xs">
            <div className="space-y-0.5">
              <h4 className="font-bold text-sm text-foreground group-hover:text-hijauSawah transition-colors">
                Pengaturan Sistem
              </h4>
              <p className="text-xs text-muted-foreground">
                Atur platform, sponsor, sosmed, & profil portal.
              </p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-hijauSawah transition-colors shrink-0 ml-2" />
          </div>
        </Link>

        <Link href={adminPanelHref("analytics/workflow")} className="group">
          <div className="bg-card border border-border hover:border-foreground/30 rounded-lg p-5 flex items-center justify-between cursor-pointer transition-all duration-300 hover:shadow-xs">
            <div className="space-y-0.5">
              <h4 className="font-bold text-sm text-foreground group-hover:text-foreground/80 transition-colors">
                Laporan Workflow Redaksi
              </h4>
              <p className="text-xs text-muted-foreground">
                Tinjau SLA review, antrean, & throughput harian.
              </p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground/80 transition-colors shrink-0 ml-2" />
          </div>
        </Link>
      </div>
    </div>
  );
}
