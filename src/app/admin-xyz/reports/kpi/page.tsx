"use client";

import { useEffect, useState } from "react";
import { RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ListTable, ListTableColumn } from "@/components/table/ListTable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ROLES } from "@/lib/auth-client";
import {
  KPIEditorResponse,
  KPIWriterTeamResponse,
} from "@/types/reports/kpiUser";
import { useKPIReport } from "@/hooks/useKPIReport";
import { toast } from "sonner";

const MONTHS = [
  { value: "01", label: "Januari" },
  { value: "02", label: "Februari" },
  { value: "03", label: "Maret" },
  { value: "04", label: "April" },
  { value: "05", label: "Mei" },
  { value: "06", label: "Juni" },
  { value: "07", label: "Juli" },
  { value: "08", label: "Agustus" },
  { value: "09", label: "September" },
  { value: "10", label: "Oktober" },
  { value: "11", label: "November" },
  { value: "12", label: "Desember" },
];

function getYearOptions(): string[] {
  const currentYear = new Date().getFullYear();
  return Array.from({ length: 7 }, (_, i) => String(currentYear - 3 + i));
}

// Helper untuk menentukan warna progress bar dinamis berdasarkan tingkat pencapaian target (%)
const getProgressColorClass = (rate: number) => {
  if (rate >= 90) return "[&>div]:bg-hijauSawah";
  if (rate >= 50) return "[&>div]:bg-terakota";
  return "[&>div]:bg-destructive";
};

// Kolom untuk KPI Penulis
const writerColumns: ListTableColumn<KPIWriterTeamResponse>[] = [
  {
    key: "name",
    header: "Anggota Tim",
    render: (row) => {
      let avatarSrc: string | undefined = undefined;
      if (typeof row.user.avatar === "string") {
        avatarSrc = row.user.avatar;
      } else if (
        row.user.avatar &&
        typeof row.user.avatar === "object" &&
        "url" in row.user.avatar
      ) {
        avatarSrc = row.user.avatar.url;
      }
      return (
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarImage src={avatarSrc} />
            <AvatarFallback>
              {row.user.name?.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="font-medium line-clamp-1">{row.user.name}</p>
            <p className="text-sm text-muted-foreground line-clamp-1 capitalize">
              {row.user.role.toLowerCase()}
            </p>
          </div>
        </div>
      );
    },
  },
  {
    key: "productivity",
    header: "Dipublikasi",
    render: (row) => {
      return (
        <div className="space-y-1.5 w-full min-w-0 max-w-50">
          <div className="flex justify-between text-sm">
            <span>{row.articlePublishedThisMonth} terbit</span>
            <span className="text-muted-foreground">
              Target: {row.monthlyTargetArticles || "-"}
            </span>
          </div>
          <Progress
            value={row.targetAchievementRate ?? 0}
            className={`h-2 ${getProgressColorClass(row.targetAchievementRate ?? 0)}`}
          />
          <p className="text-xs text-muted-foreground text-right">
            {(row.targetAchievementRate ?? 0).toFixed(1)}% tercapai
          </p>
        </div>
      );
    },
  },
  {
    key: "pageviews",
    header: "Tayangan",
    className: "hidden md:table-cell",
    render: (row) => (
      <>
        <span className="font-medium">{row.pageViewsThisMonth}</span>
        <span className="text-xs text-muted-foreground ml-2">Tayangan</span>
      </>
    ),
  },
  {
    key: "revisionRate",
    header: "Revision Rate",
    className: "hidden md:table-cell",
    render: (row) => (
      <div className="flex flex-col">
        <span
          className={`font-medium ${row.monthlyRevisionRate > 15 ? "text-destructive" : ""}`}
        >
          {(row.monthlyRevisionRate ?? 0).toFixed(1)}%
        </span>
        <span className="text-xs text-muted-foreground">
          {row.rejectedCount} kali revisi dari {row.submittedCount} submit
        </span>
      </div>
    ),
  },
];

const editorColumns: ListTableColumn<KPIEditorResponse>[] = [
  {
    key: "name",
    header: "Editor",
    render: (row) => {
      let avatarSrc: string | undefined = undefined;
      if (typeof row.user.avatar === "string") {
        avatarSrc = row.user.avatar;
      } else if (
        row.user.avatar &&
        typeof row.user.avatar === "object" &&
        "url" in row.user.avatar
      ) {
        avatarSrc = row.user.avatar.url;
      }
      return (
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarImage src={avatarSrc} />
            <AvatarFallback>
              {row.user.name?.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="font-medium line-clamp-1">{row.user.name}</p>
            <p className="text-sm text-muted-foreground line-clamp-1 capitalize">
              {row.user.role.toLowerCase()}
            </p>
          </div>
        </div>
      );
    },
  },
  {
    key: "productivity",
    header: "Artikel Diproses",
    render: (row) => {
      return (
        <div className="space-y-1.5 w-full min-w-0 max-w-50">
          <div className="flex justify-between text-sm">
            <span>{row.articlesProcessedThisMonth} diproses</span>
            <span className="text-muted-foreground">
              Target: {row.monthlyTargetProcess || "-"}
            </span>
          </div>
          <Progress
            value={row.targetAchievementRate ?? 0}
            className={`h-2 ${getProgressColorClass(row.targetAchievementRate ?? 0)}`}
          />
          <p className="text-xs text-muted-foreground text-right">
            {(row.targetAchievementRate ?? 0).toFixed(1)}% tercapai
          </p>
        </div>
      );
    },
  },
  {
    key: "quality_control",
    header: "Strictness Rate",
    className: "hidden md:table-cell",
    render: (row) => (
      <div className="flex flex-col">
        <span className="font-medium">{row.editorStrictnessRate}%</span>
        <span className="text-xs text-muted-foreground">
          {row.articlesRevisionCountThisMonth} revisi dari{" "}
          {row.totalDraftsReviewedThisMonth} draf
        </span>
      </div>
    ),
  },
  {
    key: "efficiency_sla",
    header: "Performa SLA (Kecepatan)",
    className: "hidden md:table-cell",
    render: (row) => {
      const hasProcessed = row.articlesProcessedThisMonth > 0;
      const isOverSla =
        hasProcessed && row.avgProcessingTimeMinutes > row.targetSlaMinutes;
      const slaColorClass = !hasProcessed
        ? "text-muted-foreground"
        : isOverSla
          ? "text-destructive"
          : "text-green-600";

      return (
        <div className="flex flex-col space-y-1">
          <div className="flex items-baseline gap-2">
            <span className={`font-medium ${slaColorClass}`}>
              {hasProcessed ? `${row.avgProcessingTimeMinutes} mnt` : "-"}
            </span>
            <span className="text-xs text-muted-foreground">
              / target {row.targetSlaMinutes} mnt
            </span>
          </div>
          <div className="text-xs text-muted-foreground">
            Selesai Cepat:{" "}
            <span className="font-medium text-foreground">
              {hasProcessed ? `${row.slaComplianceRate}%` : "-"}
            </span>
          </div>
        </div>
      );
    },
  },
];

export default function KPIPage() {
  const currentDate = new Date();
  const currentMonth = String(currentDate.getMonth() + 1).padStart(2, "0");
  const currentYearStr = String(currentDate.getFullYear());

  const yearOptions = getYearOptions();

  const [activeTab, setActiveTab] = useState("WRITER_TEAM");
  const [month, setMonth] = useState(currentMonth);
  const [year, setYear] = useState(currentYearStr);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce effect untuk search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Map activeTab ke fetch type yang sesuai
  const getFetchType = (): "writer_team" | "editor" => {
    switch (activeTab) {
      case "WRITER_TEAM":
        return "writer_team";
      case ROLES.EDITOR:
        return "editor";
      default:
        return "writer_team";
    }
  };

  const period = `${year}-${month}`;
  const fetchType = getFetchType();

  // Fetch KPI data menggunakan React Query (dengan caching 3 menit)
  const {
    data = [],
    isLoading: loading,
    error,
  } = useKPIReport({
    type: fetchType,
    period,
    search: debouncedSearch,
  });

  // Tampilkan error toast jika ada error
  useEffect(() => {
    if (error) {
      const errorMessage =
        error.response?.data?.error || "Gagal memuat data KPI";
      toast.error(errorMessage);
    }
  }, [error]);

  const handlePeriodChange = (m: string, y: string) => {
    setMonth(m);
    setYear(y);
  };

  const handleReset = () => {
    setMonth(currentMonth);
    setYear(currentYearStr);
    setSearchInput("");
  };

  return (
    <div className="min-w-0 max-w-full space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Laporan KPI{" "}
            <span className="text-muted-foreground text-xl font-medium ml-2">
              (Tim Redaksi)
            </span>
          </h1>
          <p className="text-muted-foreground mt-1">
            Evaluasi kinerja tim redaksi per periode bulan dan tahun terpusat.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 items-center bg-card p-4 rounded-xl border border-border shadow-sm">
        <div className="relative w-full md:flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cari nama staff..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9 bg-background"
          />
        </div>

        {/* Month Dropdown */}
        <Select
          value={month}
          onValueChange={(val) => handlePeriodChange(val, year)}
        >
          <SelectTrigger className="w-full md:w-40 bg-background">
            <SelectValue placeholder="Bulan" />
          </SelectTrigger>
          <SelectContent>
            {MONTHS.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Year Dropdown */}
        <Select
          value={year}
          onValueChange={(val) => handlePeriodChange(month, val)}
        >
          <SelectTrigger className="w-full md:w-32 bg-background">
            <SelectValue placeholder="Tahun" />
          </SelectTrigger>
          <SelectContent>
            {yearOptions.map((y) => (
              <SelectItem key={y} value={y}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="ghost"
          onClick={handleReset}
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Reset Periode
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="h-12 w-full justify-start overflow-x-auto whitespace-nowrap bg-transparent gap-2 px-0">
          <TabsTrigger
            value="WRITER_TEAM"
            className="px-6 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md shadow-sm border border-border/50 bg-card"
          >
            Tim Penulis
          </TabsTrigger>
          <TabsTrigger
            value={ROLES.EDITOR}
            className="px-6 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md shadow-sm border border-border/50 bg-card"
          >
            Editor
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="WRITER_TEAM" className="m-0 space-y-4">
            <div className="bg-card rounded-xl border border-border overflow-x-auto shadow-sm min-w-0">
              <ListTable
                columns={writerColumns}
                data={data as KPIWriterTeamResponse[]}
                loading={loading}
                emptyText="Tidak ada data KPI untuk Tim Penulis pada periode ini."
                rowKey={(row) => row.userId}
              />
            </div>
          </TabsContent>

          <TabsContent value={ROLES.EDITOR} className="m-0">
            <div className="bg-card rounded-xl border border-border overflow-x-auto shadow-sm min-w-0">
              <ListTable
                columns={editorColumns}
                data={data as KPIEditorResponse[]}
                loading={loading}
                emptyText="Tidak ada data KPI untuk Editor pada periode ini."
                rowKey={(row) => row.userId}
              />
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
