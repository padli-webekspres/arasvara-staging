"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Calendar as CalendarIcon, Eye, RotateCcw } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { ListTable, ListTableColumn } from "@/components/table/ListTable";
import Link from "next/link";
import { resolveAuthorPublicHref } from "@/lib/author-public-path";
import { fetcher } from "@/lib/fetcher";
import { DateTime } from "luxon";
import { EditorActivity } from "@/types/analytics/editorActivity";
import { Button } from "@/components/ui/button";
import { type DateRange } from "react-day-picker";
import { endOfDay, format, isValid, parse, startOfDay } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { BrandDayPicker } from "@/components/ui/BrandDayPicker";
import { ADMIN_PAGINATION_WRAP } from "@/lib/admin-ui";
import { EDITORIAL_ENTITIES } from "@/types/auditLog";
import { formatDateTimeReadableJakarta } from "@/lib/datetime-jakarta";

const LIMIT = 20;

const ACTIONS = [
  "CREATE",
  "PUBLISH",
  "SCHEDULE",
  "UPDATE",
  "TAKE_DOWN",
  "DELETE",
  "RESTORE",
  "REJECT",
];

const ENTITY_OPTIONS = [...EDITORIAL_ENTITIES];

/** Parse tanggal kalender yyyy-MM-dd (URL & day picker output) */
function parseYmd(value: string | null): Date | undefined {
  if (!value?.trim()) return undefined;
  const d = parse(value.trim(), "yyyy-MM-dd", new Date());
  return isValid(d) ? d : undefined;
}

/**
 * Fallback: nilai ISO penuh di URL dari implementasi lama (datetime-local).
 */
function parseDateParamFlexible(value: string | null): Date | undefined {
  if (!value?.trim()) return undefined;
  const ymd = parseYmd(value);
  if (ymd) return ymd;
  const d = new Date(value.trim());
  return isValid(d) ? d : undefined;
}

function dateRangeBoundsToApiIso(
  from: Date,
  to: Date,
): {
  startDate: string;
  endDate: string;
} {
  return {
    startDate: startOfDay(from).toISOString(),
    endDate: endOfDay(to).toISOString(),
  };
}

export default function EditorActivityPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [page, setPage] = useState(1);
  const [userId, setUserId] = useState("");
  const [action, setAction] = useState("");
  const [entity, setEntity] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [data, setData] = useState<EditorActivity[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedReasonRow, setSelectedReasonRow] = useState<EditorActivity | null>(
    null,
  );
  const [, startTransition] = useTransition();

  const updateParams = (
    params: Record<string, string | number | boolean | null>,
  ) => {
    const sp = new URLSearchParams(searchParams.toString());
    Object.entries(params).forEach(([k, v]) => {
      if (v === "" || v === false || v == null) sp.delete(k);
      else sp.set(k, String(v));
    });
    startTransition(() => {
      router.push(`?${sp.toString()}`);
    });
  };

  /** Sinkronkan `search` hasil debounce ke URL tanpa menghapus filter lain */
  function syncSearchToUrl() {
    const sp = new URLSearchParams(searchParams.toString());
    const q = search.trim();
    if (!q) sp.delete("search");
    else sp.set("search", q);
    sp.set("page", "1");
    startTransition(() => {
      router.push(`?${sp.toString()}`);
    });
  }

  const dateRange: DateRange | undefined = useMemo(() => {
    const from = parseDateParamFlexible(searchParams.get("startDate"));
    const to = parseDateParamFlexible(searchParams.get("endDate"));
    if (!from && !to) return undefined;
    return { from: from ?? to, to: to ?? from };
  }, [searchParams]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setSearch(searchInput);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchInput]);

  useEffect(() => {
    const urlSearchNorm = (searchParams.get("search") || "").trim();
    if (search === urlSearchNorm) return;
    syncSearchToUrl();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useLayoutEffect(() => {
    const pageParam = parseInt(searchParams.get("page") || "1", 10);
    const userIdParam = searchParams.get("userId") || "";
    const actionParam = searchParams.get("action") || "";
    const entityParam = searchParams.get("entity") || "";
    const searchParam = searchParams.get("search") || "";
    Promise.resolve().then(() => {
      setPage(pageParam);
      setUserId(userIdParam);
      setAction(actionParam);
      setEntity(entityParam);
      setSearchInput(searchParam);
      setSearch(searchParam);
    });
  }, [searchParams]);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("limit", String(LIMIT));
    params.set("skip", String((page - 1) * LIMIT));
    if (userId) params.set("userId", userId);
    if (action) params.set("action", action);
    if (entity) params.set("entity", entity);

    if (dateRange?.from) {
      const end = dateRange.to ?? dateRange.from;
      const { startDate, endDate } = dateRangeBoundsToApiIso(
        dateRange.from,
        end,
      );
      params.set("startDate", startDate);
      params.set("endDate", endDate);
    }

    if (search) params.set("search", search);

    fetcher<{ data: EditorActivity[]; total?: number }>(
      `/analytics/editor-activity?${params.toString()}`,
    )
      .then((res) => {
        setData(res.data || []);
        setTotal(res.total ?? 0);
      })
      .finally(() => setLoading(false));
  }, [page, userId, action, entity, dateRange, search]);

  const totalPages = Math.max(1, Math.ceil((total || data.length) / LIMIT));
  const visiblePages = useMemo(() => {
    const start = Math.max(1, page - 4);
    const end = Math.min(totalPages, page + 4);
    const pages: number[] = [];
    for (let p = start; p <= end; p++) pages.push(p);
    return pages;
  }, [page, totalPages]);

  /** Freshness: max timestamp dari baris yang sedang dimuat (halaman/filter aktif). */
  const lastActivityFormatted = useMemo(() => {
    let maxMs = 0;
    for (const row of data) {
      if (!row.timestamp) continue;
      const ms =
        typeof row.timestamp === "string"
          ? Date.parse(row.timestamp)
          : row.timestamp instanceof Date
            ? row.timestamp.getTime()
            : NaN;
      if (Number.isFinite(ms) && ms > maxMs) maxMs = ms;
    }
    if (maxMs <= 0) return null;
    const formatted = formatDateTimeReadableJakarta(new Date(maxMs));
    return formatted || null;
  }, [data]);

  const dateRangeLabel = () => {
    if (!dateRange?.from) return "Rentang tanggal";
    if (!dateRange.to || dateRange.from.getTime() === dateRange.to.getTime()) {
      return format(dateRange.from, "d MMM yyyy", { locale: idLocale });
    }
    return `${format(dateRange.from, "d MMM yyyy", { locale: idLocale })} – ${format(dateRange.to, "d MMM yyyy", { locale: idLocale })}`;
  };

  const onDateRangeSelect = (range: DateRange | undefined) => {
    if (!range?.from) {
      updateParams({ startDate: null, endDate: null, page: 1 });
      return;
    }
    const fromStr = format(range.from, "yyyy-MM-dd");
    const toStr = range.to
      ? format(range.to, "yyyy-MM-dd")
      : format(range.from, "yyyy-MM-dd");
    updateParams({ startDate: fromStr, endDate: toStr, page: 1 });
  };

  const columns: ListTableColumn<EditorActivity>[] = [
    {
      key: "timestamp",
      header: "Waktu",
      render: (row) => {
        if (!row.timestamp) return "-";
        let isoString: string;
        if (typeof row.timestamp === "string") {
          isoString = row.timestamp;
        } else if (row.timestamp instanceof Date) {
          isoString = row.timestamp.toISOString();
        } else {
          return "-";
        }
        const dt = DateTime.fromISO(isoString, { zone: "Asia/Jakarta" });
        return dt.isValid ? dt.toFormat("HH:mm, dd-MM-yyyy") : "-";
      },
    },
    {
      key: "user",
      header: "User",
      render: (row) => {
        if (!row.user)
          return <span className="italic text-muted-foreground">-</span>;
        const authorHref = row.user.slug
          ? resolveAuthorPublicHref(row.user)
          : null;
        if (!authorHref) {
          return <span>{row.user.name}</span>;
        }
        return (
          <Link
            href={authorHref}
            className="text-primary underline hover:text-primary/80"
          >
            {row.user.name}
          </Link>
        );
      },
    },
    {
      key: "action",
      header: "Aksi",
      render: (row) => {
        const actionColorClasses: Record<string, string> = {
          PUBLISH: "bg-green-600 text-white",
          PUBLISHED: "bg-green-700 text-white",
          UPDATE: "bg-blue-600 text-white",
          SCHEDULE: "bg-cyan-600 text-white",
          SCHEDULED: "bg-cyan-700 text-white",
          TAKE_DOWN: "bg-yellow-600 text-white",
          DELETE: "bg-red-600 text-white",
          RESTORE: "bg-purple-600 text-white",
          CREATE: "bg-indigo-600 text-white",
          REJECT: "bg-orange-600 text-white",
        };
        const colorClass =
          actionColorClasses[row.action] || "bg-gray-400 text-white";
        return (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${colorClass}`}
          >
            {String(row.action).replace("_", " ")}
          </span>
        );
      },
    },
    {
      key: "article",
      header: "Artikel / Target",
      render: (row) => {
        const title = row.target || row.article?.title || row.details || "";
        if (!title)
          return <span className="italic text-muted-foreground">-</span>;
        return (
          <span className="block truncate max-w-[12rem] md:max-w-xs">
            {title}
          </span>
        );
      },
    },
    {
      key: "meta",
      header: "Reason",
      className: "hidden lg:table-cell",
      render: (row) => {
        const reasonText = row.meta?.reason || row.details || "";
        if (!reasonText) {
          return <span className="italic text-muted-foreground">-</span>;
        }
        return (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setSelectedReasonRow(row)}
            title="Lihat reason"
            aria-label="Lihat reason"
          >
            <Eye className="h-4 w-4" />
          </Button>
        );
      },
    },
  ];

  const resetFilters = () => {
    setUserId("");
    setAction("");
    setEntity("");
    setSearchInput("");
    setSearch("");
    updateParams({
      userId: null,
      action: null,
      entity: null,
      startDate: null,
      endDate: null,
      search: null,
      page: 1,
    });
  };

  const searchField = (
    <div className="space-y-2 w-full min-w-0">
      <Label htmlFor="editor-activity-search" className="text-xs md:text-sm">
        Pencarian
      </Label>
      <Input
        id="editor-activity-search"
        placeholder="Nama, email, atau judul artikel…"
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        className="w-full"
      />
    </div>
  );

  const actionFilter = (
    <div className="space-y-2 flex-1 basis-0 min-w-[8rem] md:flex-none md:basis-auto md:w-[11rem] lg:w-[12rem] md:shrink-0">
      <Label className="text-xs md:text-sm">Aksi</Label>
      <Select
        value={action || "ALL"}
        onValueChange={(val) => {
          const mapped = val === "ALL" ? "" : val;
          setAction(mapped);
          updateParams({ action: mapped || null, page: 1 });
        }}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Semua Aksi" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">Semua Aksi</SelectItem>
          {ACTIONS.map((a) => (
            <SelectItem key={a} value={a}>
              {a.replace("_", " ")}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  const entityFilter = (
    <div className="space-y-2 flex-1 basis-0 min-w-[10rem] md:flex-none md:basis-auto md:w-[13rem] lg:w-[14rem] md:shrink-0">
      <Label className="text-xs md:text-sm">Entity</Label>
      <Select
        value={entity || "ALL"}
        onValueChange={(val) => {
          const mapped = val === "ALL" ? "" : val;
          setEntity(mapped);
          updateParams({ entity: mapped || null, page: 1 });
        }}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Semua Entity" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">Semua Entity</SelectItem>
          {ENTITY_OPTIONS.map((item) => (
            <SelectItem key={item} value={item}>
              {item}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  const dateFilter = (
    <div className="space-y-2 flex-1 basis-0 min-w-[9rem] md:flex-none md:basis-auto md:min-w-[12rem] lg:min-w-[14rem]">
      <Label className="text-xs md:text-sm">Tanggal aktivitas</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-start text-left font-normal"
            type="button"
          >
            <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
            <span className="truncate">{dateRangeLabel()}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <BrandDayPicker
            mode="range"
            selected={dateRange}
            onSelect={onDateRangeSelect}
            locale={idLocale}
            numberOfMonths={1}
            className="p-3"
          />
          <div className="border-t p-2 flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onDateRangeSelect(undefined)}
            >
              Hapus tanggal
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );

  const resetButton = (
    <Button
      variant="outline"
      type="button"
      onClick={resetFilters}
      aria-label="Reset filter"
      title="Reset filter"
      className="inline-flex h-10 w-10 shrink-0 items-center justify-center gap-0 p-0 lg:h-10 lg:w-auto lg:gap-2 lg:px-4"
    >
      <RotateCcw className="h-4 w-4 shrink-0" aria-hidden />
      <span className="hidden lg:inline">Reset filter</span>
    </Button>
  );

  return (
    <div className="min-w-0 max-w-full space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Aktivitas Redaksi</h1>
          <p className="text-muted-foreground">
            Riwayat aksi penting redaksi (publish, update, take down, dsb)
          </p>
        </div>
      </div>

      {!loading && lastActivityFormatted ? (
        <p className="text-xs text-muted-foreground rounded-lg border border-border bg-muted/30 px-3 py-2 break-words">
          Data aktivitas terakhir:{" "}
          <span className="font-medium text-foreground/90">
            {lastActivityFormatted}
          </span>
          . Sumber utama: <span className="font-medium">audit_log</span>.
        </p>
      ) : null}

      {/* Mobile: baris 1 aksi + tanggal + reset (ikon); baris 2 pencarian */}
      <div className="flex flex-col gap-4 md:hidden">
        <div className="flex flex-wrap items-end gap-3">
          {actionFilter}
          {entityFilter}
          {dateFilter}
          <div className="flex items-end shrink-0">{resetButton}</div>
        </div>
        {searchField}
      </div>

      {/* md+: satu baris — pencarian, aksi, tanggal, reset (ikon md–lg, teks di lg) */}
      <div className="hidden md:flex md:flex-row md:flex-nowrap md:items-end md:gap-3">
        <div className="min-w-0 flex-1">{searchField}</div>
        {actionFilter}
        {entityFilter}
        {dateFilter}
        <div className="flex shrink-0 items-end">{resetButton}</div>
      </div>

      <div className="bg-card rounded-lg border border-border overflow-x-auto">
        <ListTable
          columns={columns}
          data={data}
          loading={loading}
          emptyText="Tidak ada data"
          rowKey={(row) =>
            typeof row._id === "object" &&
            row._id !== null &&
            "toString" in row._id
              ? row._id.toString()
              : String(row._id)
          }
        />
      </div>

      <Dialog
        open={Boolean(selectedReasonRow)}
        onOpenChange={(open) => {
          if (!open) setSelectedReasonRow(null);
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detail Reason</DialogTitle>
            <DialogDescription>
              Informasi lengkap reason dan konteks aktivitas redaksi.
            </DialogDescription>
          </DialogHeader>
          {selectedReasonRow && (
            <div className="space-y-4">
              <div className="grid gap-2 text-sm">
                <div>
                  <span className="font-semibold">Aksi:</span>{" "}
                  {String(selectedReasonRow.action).replace("_", " ")}
                </div>
                <div>
                  <span className="font-semibold">Entity:</span>{" "}
                  {selectedReasonRow.entity || "-"}
                </div>
                <div>
                  <span className="font-semibold">Target:</span>{" "}
                  {selectedReasonRow.target ||
                    selectedReasonRow.article?.title ||
                    "-"}
                </div>
                <div>
                  <span className="font-semibold">Waktu:</span>{" "}
                  {typeof selectedReasonRow.timestamp === "string"
                    ? DateTime.fromISO(selectedReasonRow.timestamp, {
                        zone: "Asia/Jakarta",
                      }).toFormat("HH:mm, dd-MM-yyyy")
                    : DateTime.fromJSDate(selectedReasonRow.timestamp, {
                        zone: "Asia/Jakarta",
                      }).toFormat("HH:mm, dd-MM-yyyy")}
                </div>
              </div>
              <div className="rounded-md border bg-muted/20 p-3 text-sm whitespace-pre-wrap break-words">
                {selectedReasonRow.meta?.reason ||
                  selectedReasonRow.details ||
                  "-"}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {totalPages > 1 && (
        <Pagination className="my-4 flex-wrap justify-center">
          <PaginationContent className={ADMIN_PAGINATION_WRAP}>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  if (page > 1) updateParams({ page: page - 1 });
                }}
                className={page <= 1 ? "pointer-events-none opacity-50" : ""}
              />
            </PaginationItem>
            {visiblePages[0] > 1 && (
              <>
                <PaginationItem>
                  <PaginationLink
                    href="#"
                    isActive={page === 1}
                    onClick={(e) => {
                      e.preventDefault();
                      if (page !== 1) updateParams({ page: 1 });
                    }}
                  >
                    1
                  </PaginationLink>
                </PaginationItem>
                {visiblePages[0] > 2 && (
                  <PaginationItem>
                    <PaginationEllipsis />
                  </PaginationItem>
                )}
              </>
            )}
            {visiblePages.map((pageNum) => (
              <PaginationItem key={pageNum}>
                <PaginationLink
                  href="#"
                  isActive={page === pageNum}
                  onClick={(e) => {
                    e.preventDefault();
                    if (page !== pageNum) updateParams({ page: pageNum });
                  }}
                >
                  {pageNum}
                </PaginationLink>
              </PaginationItem>
            ))}
            {visiblePages[visiblePages.length - 1] < totalPages && (
              <>
                {visiblePages[visiblePages.length - 1] < totalPages - 1 && (
                  <PaginationItem>
                    <PaginationEllipsis />
                  </PaginationItem>
                )}
                <PaginationItem>
                  <PaginationLink
                    href="#"
                    isActive={page === totalPages}
                    onClick={(e) => {
                      e.preventDefault();
                      if (page !== totalPages) updateParams({ page: totalPages });
                    }}
                  >
                    {totalPages}
                  </PaginationLink>
                </PaginationItem>
              </>
            )}
            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  if (page < totalPages) updateParams({ page: page + 1 });
                }}
                className={
                  page >= totalPages ? "pointer-events-none opacity-50" : ""
                }
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}
