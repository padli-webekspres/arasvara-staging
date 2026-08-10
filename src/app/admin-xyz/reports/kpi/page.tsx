"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, RefreshCw, RotateCcw, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ListTable, ListTableColumn } from "@/components/table/ListTable";
import UserAvatar from "@/components/users/AvatarUser";
import {
  MetricCard,
  AlertRail,
  TargetUnsetBadge,
  formatMom,
} from "@/components/admin/analytics/MetricPrimitives";
import {
  useKPIReport,
  useKPISummary,
  useKPIChannel,
} from "@/hooks/useKPIReport";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { ROLES } from "@/lib/auth-client";
import type { TargetDisplay } from "@/lib/analytics/metrics-core";
import {
  KPIChannelRow,
  KPIEditorResponse,
  KPIWriterTeamResponse,
} from "@/types/reports/kpiUser";

const FULL_ACCESS_ROLES = new Set([
  ROLES.ADMIN,
  ROLES.EDITOR_IN_CHIEF,
  ROLES.MANAGING_EDITOR,
]);

function isFullAccessRole(role?: string | null): boolean {
  return FULL_ACCESS_ROLES.has((role || "").toLowerCase().trim() as typeof ROLES.ADMIN);
}

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

function formatNumber(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("id-ID").format(value);
}

function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value == null || Number.isNaN(value)) return "n/a";
  return `${value.toFixed(digits)}%`;
}

function slaProgressTone(rate: number): string {
  if (rate >= 90) return "[&>div]:bg-hijauSawah";
  if (rate >= 50) return "[&>div]:bg-terakota";
  return "[&>div]:bg-destructive";
}

type ActiveTab = "writer_team" | "editor" | "channel";

function ChannelTargetCell({
  actual,
  target,
}: {
  actual: number;
  target: TargetDisplay;
}) {
  if (target.status === "unset") {
    return (
      <div className="flex flex-col gap-1">
        <span className="font-medium">{formatNumber(actual)}</span>
        <TargetUnsetBadge label="Target kanal belum diset" />
      </div>
    );
  }
  return (
    <div className="flex flex-col">
      <span className="font-medium">
        {formatNumber(actual)}{" "}
        <span className="text-muted-foreground font-normal">
          / {formatNumber(target.value)}
        </span>
      </span>
      <span className="text-[11px] text-muted-foreground">
        {formatPercent(target.achievementRate)}
      </span>
    </div>
  );
}

export default function KPIPage() {
  const currentDate = new Date();
  const currentMonth = String(currentDate.getMonth() + 1).padStart(2, "0");
  const currentYearStr = String(currentDate.getFullYear());
  const yearOptions = getYearOptions();

  const { data: currentUser } = useCurrentUser();
  const isFullAccess = isFullAccessRole(currentUser?.role);
  const isEditorOnly =
    (currentUser?.role || "").toLowerCase() === ROLES.EDITOR;

  const [activeTab, setActiveTab] = useState<ActiveTab>("writer_team");
  const [month, setMonth] = useState(currentMonth);
  const [year, setYear] = useState(currentYearStr);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [defaultTabApplied, setDefaultTabApplied] = useState(false);

  // Default tab once role is known: Editor → Editor tab; full roles → Penulis
  useEffect(() => {
    if (defaultTabApplied || currentUser == null) return;
    setActiveTab(isEditorOnly ? "editor" : "writer_team");
    setDefaultTabApplied(true);
  }, [currentUser, isEditorOnly, defaultTabApplied]);

  // Editors may use Penulis + Editor, but not channel
  useEffect(() => {
    if (isEditorOnly && activeTab === "channel") {
      setActiveTab("editor");
    }
  }, [isEditorOnly, activeTab]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const period = `${year}-${month}`;
  const peopleTabActive =
    activeTab === "writer_team" || activeTab === "editor";
  const fetchType: "writer_team" | "editor" =
    activeTab === "editor" ? "editor" : "writer_team";
  const companionType: "writer_team" | "editor" =
    activeTab === "editor" ? "writer_team" : "editor";

  const summaryQuery = useKPISummary(period, isFullAccess);
  const reportQuery = useKPIReport({
    type: fetchType,
    period,
    search: debouncedSearch,
    enabled: peopleTabActive,
  });
  const companionQuery = useKPIReport({
    type: companionType,
    period,
    enabled: isEditorOnly && peopleTabActive,
  });
  const channelQuery = useKPIChannel(
    period,
    "consumption",
    isFullAccess && activeTab === "channel",
  );

  useEffect(() => {
    if (summaryQuery.error) {
      toast.error(
        summaryQuery.error.response?.data?.error ||
          summaryQuery.error.message ||
          "Gagal memuat ringkasan KPI",
      );
    }
  }, [summaryQuery.error]);

  useEffect(() => {
    if (reportQuery.error) {
      toast.error(
        reportQuery.error.response?.data?.error ||
          reportQuery.error.message ||
          "Gagal memuat data KPI",
      );
    }
  }, [reportQuery.error]);

  useEffect(() => {
    if (channelQuery.error) {
      toast.error(
        channelQuery.error.response?.data?.error ||
          channelQuery.error.message ||
          "Gagal memuat KPI kanal",
      );
    }
  }, [channelQuery.error]);

  const handleReset = () => {
    const now = new Date();
    setMonth(String(now.getMonth() + 1).padStart(2, "0"));
    setYear(String(now.getFullYear()));
    setSearchInput("");
    setDebouncedSearch("");
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        isFullAccess ? summaryQuery.refetch() : Promise.resolve(null),
        peopleTabActive ? reportQuery.refetch() : Promise.resolve(null),
        isEditorOnly && peopleTabActive
          ? companionQuery.refetch()
          : Promise.resolve(null),
        isFullAccess && activeTab === "channel"
          ? channelQuery.refetch()
          : Promise.resolve(null),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  };

  const summary = summaryQuery.data;
  const reportRows = useMemo(
    () => reportQuery.data ?? [],
    [reportQuery.data],
  );
  const channelRows = useMemo(
    () => channelQuery.data?.rows ?? [],
    [channelQuery.data],
  );

  const writerSelfRow = useMemo(() => {
    if (!isEditorOnly) return null;
    if (activeTab === "writer_team") {
      return (reportRows[0] as KPIWriterTeamResponse | undefined) ?? null;
    }
    return (companionQuery.data?.[0] as KPIWriterTeamResponse | undefined) ?? null;
  }, [isEditorOnly, activeTab, reportRows, companionQuery.data]);

  const editorSelfRow = useMemo(() => {
    if (!isEditorOnly) return null;
    if (activeTab === "editor") {
      return (reportRows[0] as KPIEditorResponse | undefined) ?? null;
    }
    return (companionQuery.data?.[0] as KPIEditorResponse | undefined) ?? null;
  }, [isEditorOnly, activeTab, reportRows, companionQuery.data]);

  const activitySource = useMemo(() => {
    const first = reportRows[0] as
      | KPIWriterTeamResponse
      | KPIEditorResponse
      | undefined;
    return first?.dataFreshness?.activitySource;
  }, [reportRows]);

  const writerColumns: ListTableColumn<KPIWriterTeamResponse>[] = useMemo(
    () => [
      {
        key: "name",
        header: "Penulis",
        render: (row) => (
          <div className="flex items-center gap-3 min-w-0">
            <UserAvatar
              avatar={row.user.avatar}
              name={row.user.name || "User"}
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
          <span className="font-medium">
            {formatNumber(row.articlePublishedThisMonth)}
          </span>
        ),
      },
      {
        key: "pageviews",
        header: "Tayangan",
        className: "hidden sm:table-cell",
        render: (row) => (
          <span className="font-medium">
            {formatNumber(row.pageViewsThisMonth)}
          </span>
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
        key: "contribution",
        header: "Kontribusi",
        className: "hidden md:table-cell",
        render: (row) => <span>{formatPercent(row.contributionShare)}</span>,
      },
      {
        key: "revision",
        header: "Revision rate",
        className: "hidden lg:table-cell",
        render: (row) => (
          <div className="flex flex-col">
            <span
              className={
                row.monthlyRevisionRate > 15
                  ? "font-medium text-destructive"
                  : "font-medium"
              }
            >
              {formatPercent(row.monthlyRevisionRate)}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {row.rejectedCount} revisi / {row.submittedCount} submit
            </span>
          </div>
        ),
      },
      {
        key: "target",
        header: "Target individu",
        className: "hidden lg:table-cell",
        render: (row) =>
          row.individualTarget?.status === "set" ? (
            <span className="text-sm text-muted-foreground">
              {row.individualTarget.label}
            </span>
          ) : (
            <TargetUnsetBadge />
          ),
      },
      {
        key: "mom",
        header: "MoM",
        className: "hidden xl:table-cell",
        render: (row) => (
          <span className="text-sm">{formatMom(row.momPublished)}</span>
        ),
      },
    ],
    [],
  );

  const editorColumns: ListTableColumn<KPIEditorResponse>[] = useMemo(
    () => [
      {
        key: "name",
        header: "Editor",
        render: (row) => (
          <div className="flex items-center gap-3 min-w-0">
            <UserAvatar
              avatar={row.user.avatar}
              name={row.user.name || "User"}
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
        key: "processed",
        header: "Diproses",
        render: (row) => (
          <span className="font-medium">
            {formatNumber(row.articlesProcessedThisMonth)}
          </span>
        ),
      },
      {
        key: "target",
        header: "Target individu",
        className: "hidden sm:table-cell",
        render: (row) =>
          row.individualTarget?.status === "set" ? (
            <span className="text-sm text-muted-foreground">
              {row.individualTarget.label}
            </span>
          ) : (
            <TargetUnsetBadge />
          ),
      },
      {
        key: "strictness",
        header: "Strictness",
        className: "hidden md:table-cell",
        render: (row) => (
          <div className="flex flex-col">
            <span className="font-medium">
              {formatPercent(row.editorStrictnessRate)}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {row.articlesRevisionCountThisMonth} revisi /{" "}
              {row.totalDraftsReviewedThisMonth} draf
            </span>
          </div>
        ),
      },
      {
        key: "sla",
        header: "Avg menit / target SLA",
        className: "hidden lg:table-cell",
        render: (row) => {
          const hasProcessed = row.articlesProcessedThisMonth > 0;
          const overSla =
            hasProcessed &&
            row.avgProcessingTimeMinutes > row.targetSlaMinutes;
          return (
            <div className="flex flex-col">
              <span
                className={
                  !hasProcessed
                    ? "text-muted-foreground"
                    : overSla
                      ? "font-medium text-destructive"
                      : "font-medium text-hijauSawah"
                }
              >
                {hasProcessed
                  ? `${formatNumber(row.avgProcessingTimeMinutes)} mnt`
                  : "—"}
              </span>
              <span className="text-[11px] text-muted-foreground">
                / target {formatNumber(row.targetSlaMinutes)} mnt
              </span>
            </div>
          );
        },
      },
      {
        key: "slaCompliance",
        header: "SLA compliance",
        className: "hidden md:table-cell",
        render: (row) => {
          const hasProcessed = row.articlesProcessedThisMonth > 0;
          const rate = row.slaComplianceRate ?? 0;
          if (!hasProcessed) {
            return <span className="text-muted-foreground">—</span>;
          }
          return (
            <div className="space-y-1.5 w-full min-w-0 max-w-40">
              <div className="flex justify-between text-sm">
                <span className="font-medium">{formatPercent(rate)}</span>
              </div>
              <Progress
                value={Math.min(100, Math.max(0, rate))}
                className={`h-2 ${slaProgressTone(rate)}`}
              />
            </div>
          );
        },
      },
    ],
    [],
  );

  const channelColumns: ListTableColumn<KPIChannelRow>[] = useMemo(
    () => [
      {
        key: "kanal",
        header: "Kanal",
        render: (row) => (
          <div className="min-w-0">
            <p className="font-medium line-clamp-1">{row.categoryName}</p>
            {row.categorySlug ? (
              <p className="text-xs text-muted-foreground">{row.categorySlug}</p>
            ) : null}
          </div>
        ),
      },
      {
        key: "articles",
        header: "Artikel / target",
        render: (row) => (
          <ChannelTargetCell
            actual={row.articlesPublished}
            target={row.targets.articles}
          />
        ),
      },
      {
        key: "pageviews",
        header: "Tayangan / target",
        className: "hidden sm:table-cell",
        render: (row) => (
          <ChannelTargetCell
            actual={row.pageviews}
            target={row.targets.pageviews}
          />
        ),
      },
      {
        key: "vpa",
        header: "Views/artikel",
        className: "hidden md:table-cell",
        render: (row) => (
          <span>{formatNumber(Math.round(row.viewsPerArticle))}</span>
        ),
      },
      {
        key: "mom",
        header: "MoM",
        className: "hidden lg:table-cell",
        render: (row) => (
          <div className="flex flex-col text-sm">
            <span>PV {formatMom(row.momPageviews)}</span>
            <span className="text-[11px] text-muted-foreground">
              Terbit {formatMom(row.momPublished)}
            </span>
          </div>
        ),
      },
      {
        key: "aksi",
        header: "Aksi",
        className: "hidden md:table-cell",
        render: (row) =>
          row.categoryId === "__uncategorized__" ? (
            <span className="text-muted-foreground text-sm">—</span>
          ) : (
            <Button variant="ghost" size="sm" asChild className="h-8 px-2">
              <Link
                href={`/admin-xyz/analytics/writing?categoryId=${encodeURIComponent(row.categoryId)}&period=${encodeURIComponent(period)}`}
              >
                Detail
                <ExternalLink className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          ),
      },
    ],
    [period],
  );

  const siteTarget = summary?.sitePublishTarget;
  const siteTargetUnset = !siteTarget || siteTarget.status === "unset";

  return (
    <div className="min-w-0 max-w-full space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">
          Laporan KPI{" "}
          <span className="text-muted-foreground text-xl font-medium">
            (Redaksi)
          </span>
        </h1>
        <p className="text-sm text-muted-foreground">
          {isEditorOnly
            ? "Scorecard kontribusi Anda sebagai penulis dan penyunting (self-only)."
            : "Scorecard kontribusi berdasarkan karya (author) dan penyuntingan (audit log), plus performa kanal."}
        </p>
      </div>

      {/* Filters */}
      <div className="bg-card p-3 sm:p-4 rounded-xl border border-border shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          {peopleTabActive ? (
            <div className="relative w-full sm:flex-1 sm:min-w-[12rem] sm:max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Cari nama staf..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-9 h-9 bg-background"
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground w-full sm:flex-1 sm:min-w-[12rem]">
              Scorecard kanal root vs target CHANNEL
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="w-[130px] h-9 bg-background text-xs">
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

            <Select value={year} onValueChange={setYear}>
              <SelectTrigger className="w-[90px] h-9 bg-background text-xs">
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
              size="sm"
              type="button"
              onClick={handleReset}
              className="h-9 shrink-0 gap-2 px-3 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </Button>

            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="h-9 shrink-0 gap-2 px-3 text-xs font-medium"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Macro strip — org for full roles, personal for editor */}
      {isFullAccess ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
            <MetricCard
              label="Artikel terbit"
              value={
                summaryQuery.isLoading ? "…" : formatNumber(summary?.published)
              }
            />
            <MetricCard
              label="Tayangan situs"
              value={
                summaryQuery.isLoading ? "…" : formatNumber(summary?.pageviews)
              }
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
              label="Avg SLA"
              value={
                summaryQuery.isLoading
                  ? "…"
                  : `${formatNumber(Math.round(summary?.avgSlaMinutes ?? 0))} mnt`
              }
              hint={`Compliance ${formatPercent(summary?.slaComplianceRate)} · target ${formatNumber(summary?.targetSlaMinutes)} mnt`}
            />
            <MetricCard
              label="Target terbit situs"
              value={
                summaryQuery.isLoading ? (
                  "…"
                ) : siteTargetUnset ? (
                  <TargetUnsetBadge className="mt-1" />
                ) : (
                  formatPercent(siteTarget?.achievementRate)
                )
              }
              hint={
                siteTargetUnset
                  ? "Target site belum diset untuk periode ini"
                  : siteTarget?.scopeLabel ||
                    `Target ${formatNumber(siteTarget?.value)}`
              }
            />
            <MetricCard
              label="Konsentrasi top-1"
              value={
                summaryQuery.isLoading
                  ? "…"
                  : formatPercent(summary?.concentrationTop1)
              }
              className="col-span-2 xl:col-span-1"
            />
          </div>
          {summary?.alerts ? <AlertRail alerts={summary.alerts} /> : null}
        </>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
          <MetricCard
            label="Artikel terbit (Anda)"
            value={
              reportQuery.isLoading || companionQuery.isLoading
                ? "…"
                : formatNumber(writerSelfRow?.articlePublishedThisMonth)
            }
          />
          <MetricCard
            label="Tayangan (Anda)"
            value={
              reportQuery.isLoading || companionQuery.isLoading
                ? "…"
                : formatNumber(writerSelfRow?.pageViewsThisMonth)
            }
          />
          <MetricCard
            label="Artikel diproses"
            value={
              reportQuery.isLoading || companionQuery.isLoading
                ? "…"
                : formatNumber(editorSelfRow?.articlesProcessedThisMonth)
            }
          />
          <MetricCard
            label="Strictness"
            value={
              reportQuery.isLoading || companionQuery.isLoading
                ? "…"
                : formatPercent(editorSelfRow?.editorStrictnessRate)
            }
          />
          <MetricCard
            label="Avg SLA"
            value={
              reportQuery.isLoading || companionQuery.isLoading
                ? "…"
                : editorSelfRow && editorSelfRow.articlesProcessedThisMonth > 0
                  ? `${formatNumber(editorSelfRow.avgProcessingTimeMinutes)} mnt`
                  : "—"
            }
            hint={
              editorSelfRow
                ? `Target ${formatNumber(editorSelfRow.targetSlaMinutes)} mnt`
                : undefined
            }
          />
          <MetricCard
            label="SLA compliance"
            value={
              reportQuery.isLoading || companionQuery.isLoading
                ? "…"
                : editorSelfRow && editorSelfRow.articlesProcessedThisMonth > 0
                  ? formatPercent(editorSelfRow.slaComplianceRate)
                  : "—"
            }
          />
        </div>
      )}

      {activitySource === "editor_activities" ? (
        <p className="text-xs text-muted-foreground rounded-lg border border-border bg-muted/30 px-3 py-2">
          Catatan freshness: sebagian metrik aktivitas masih memakai sumber
          legacy <span className="font-medium">editor_activities</span>. Angka
          revisi/proses bisa undercount jika audit log belum lengkap.
        </p>
      ) : null}

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as ActiveTab)}
        className="w-full"
      >
        <TabsList className="h-auto w-full justify-start overflow-x-auto whitespace-nowrap bg-transparent gap-2 px-0 flex-wrap">
          <TabsTrigger
            value="writer_team"
            className="px-4 sm:px-6 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md shadow-xs border border-border/50 bg-card"
          >
            Penulis
          </TabsTrigger>
          <TabsTrigger
            value="editor"
            className="px-4 sm:px-6 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md shadow-xs border border-border/50 bg-card"
          >
            Editor
          </TabsTrigger>
          {isFullAccess ? (
            <TabsTrigger
              value="channel"
              className="px-4 sm:px-6 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md shadow-xs border border-border/50 bg-card"
            >
              Kanal/Rubrik
            </TabsTrigger>
          ) : null}
        </TabsList>

        <div className="mt-4 sm:mt-6">
          <TabsContent value="writer_team" className="m-0 space-y-4">
            <p className="text-xs text-muted-foreground">
              Berdasarkan author artikel di periode ini (semua status). Role CMS
              hanya label — Admin/Pemred yang menulis tetap masuk.
            </p>
            <div className="bg-card rounded-xl border border-border overflow-x-auto shadow-xs min-w-0">
              <ListTable
                columns={writerColumns}
                data={reportRows as KPIWriterTeamResponse[]}
                loading={reportQuery.isLoading}
                emptyText="Tidak ada kontribusi penulis pada periode ini."
                rowKey={(row) => row.userId}
                compact
              />
            </div>
          </TabsContent>

          <TabsContent value="editor" className="m-0 space-y-4">
            <p className="text-xs text-muted-foreground">
              Berdasarkan aktivitas penyuntingan di audit log (PUBLISH,
              SCHEDULE, REJECT, UPDATE).
            </p>
            <div className="bg-card rounded-xl border border-border overflow-x-auto shadow-xs min-w-0">
              <ListTable
                columns={editorColumns}
                data={reportRows as KPIEditorResponse[]}
                loading={reportQuery.isLoading}
                emptyText="Tidak ada kontribusi editor pada periode ini."
                rowKey={(row) => row.userId}
                compact
              />
            </div>
          </TabsContent>

          {isFullAccess ? (
            <TabsContent value="channel" className="m-0 space-y-4">
              <div className="bg-card rounded-xl border border-border overflow-x-auto shadow-xs min-w-0">
                <ListTable
                  columns={channelColumns}
                  data={channelRows}
                  loading={channelQuery.isLoading}
                  emptyText="Tidak ada kanal root untuk ditampilkan."
                  rowKey={(row) => row.categoryId}
                  compact
                />
              </div>
            </TabsContent>
          ) : null}
        </div>
      </Tabs>
    </div>
  );
}
