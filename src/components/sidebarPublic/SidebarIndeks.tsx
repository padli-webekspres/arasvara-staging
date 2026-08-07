"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { DayPicker } from "react-day-picker";
import { format, isValid, parse } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useCategoryOptions } from "@/hooks/useCategory";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarIcon, ChevronRight, RotateCcw } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import "react-day-picker/dist/style.css";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SidebarIndeksProps {
  className?: string;
  /** Dipanggil saat user mengubah input tanggal */
  onDateChange?: (date: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Bangun href kategori sambil mempertahankan query `date` yang aktif.
 * Slug kosong berarti "Semua Kategori" (tidak ada param category di URL).
 */
function buildCategoryHref(slug: string, currentDate: string | null): string {
  const params = new URLSearchParams();
  if (slug) params.set("category", slug);
  if (currentDate) params.set("date", currentDate);
  const queryString = params.toString();
  return `/indeks${queryString ? `?${queryString}` : ""}`;
}

/** Parse YYYY-MM-DD ke Date lokal (hindari shift timezone dari ISO string). */
function parseDateParam(value: string): Date | undefined {
  if (!value) return undefined;
  const parsed = parse(value, "yyyy-MM-dd", new Date());
  return isValid(parsed) ? parsed : undefined;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SidebarIndeks({
  className,
  onDateChange,
}: SidebarIndeksProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeCategory = searchParams.get("category") ?? "";
  const currentDate = searchParams.get("date") ?? "";
  const [dateOpen, setDateOpen] = useState(false);

  // ── Ambil daftar kategori dari API (cached via React Query) ──
  const { data: categoryOptions, isLoading: loadingCategories } =
    useCategoryOptions();

  const selectedDate = parseDateParam(currentDate);
  const dateLabel =
    selectedDate != null
      ? format(selectedDate, "dd MMM yyyy", { locale: idLocale })
      : "Pilih tanggal";

  // ── Handler: Pilih tanggal dari DayPicker (bukan native date — iOS Safari overflow) ──
  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    onDateChange?.(format(date, "yyyy-MM-dd"));
    setDateOpen(false);
  };

  // ── Handler: Reset filter tanggal ──
  const handleResetDate = () => {
    onDateChange?.("");
  };

  // ── Handler: Perubahan kategori via dropdown (mobile) ──
  const handleCategoryChange = (value: string) => {
    const href = buildCategoryHref(
      value === "all" ? "" : value,
      currentDate || null,
    );
    router.push(href);
  };

  // Class trigger disetarakan: tanggal (Button) & kategori (SelectTrigger)
  const filterTriggerClassName =
    "h-9 w-full min-w-0 max-w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs";

  return (
    <aside className={cn("flex flex-col gap-4 md:gap-6 md:overflow-y-auto md:max-h-[calc(100vh-200px)] md:pr-4 min-w-0", className)}>
      {/* ── Header ── */}
      <div className="flex justify-between items-center min-w-0 gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold mb-1">Indeks Berita</h2>
          <p className="text-xs text-muted-foreground">
            Telusuri artikel berdasarkan kategori dan tanggal
          </p>
        </div>
        <Link href="/indeks" className="shrink-0 w-fit md:mt-8">
          <Button variant={"outline"} className="w-fit">
            <RotateCcw className="h-4 w-4" />
          </Button>
        </Link>
      </div>

      {/* ── Filter Tanggal ── */}
      {/*
        Native input[type=date] di Safari iOS punya min intrinsic width yang
        tidak bisa dikekang CSS (overflow halaman). Ganti ke Button + DayPicker
        seperti SidebarSearch agar lebar/tinggi bisa diset sama dengan Select.
      */}
      <div className="flex w-full min-w-0 flex-col gap-2">
        <Label htmlFor="indeks-date" className="text-sm font-semibold">
          Tanggal
        </Label>
        <Popover open={dateOpen} onOpenChange={setDateOpen}>
          <PopoverTrigger asChild>
            <Button
              id="indeks-date"
              type="button"
              variant="outline"
              className={cn(
                filterTriggerClassName,
                "justify-between font-normal hover:bg-background",
              )}
            >
              <span
                className={cn(
                  "truncate",
                  !currentDate && "text-muted-foreground",
                )}
              >
                {dateLabel}
              </span>
              <CalendarIcon className="size-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <DayPicker
              mode="single"
              selected={selectedDate}
              onSelect={handleDateSelect}
              disabled={{ after: new Date() }}
              locale={idLocale}
              showOutsideDays
            />
          </PopoverContent>
        </Popover>
        {currentDate && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-auto self-start px-1 text-xs text-muted-foreground"
            onClick={handleResetDate}
          >
            Reset tanggal
          </Button>
        )}
      </div>

      {/* ── Divider ── */}
      <div className="border-t border-muted hidden md:block" />

      {/* ── Flat List Kategori ── */}
      <div className="hidden md:flex flex-col gap-1">
        <span className="text-sm font-semibold mb-2 block">Kategori</span>
        <nav aria-label="Filter kategori" className="flex flex-col gap-0.5">
          {/* Item "Semua Kategori" selalu tampil di posisi paling atas */}
          <Link
            href={buildCategoryHref("", currentDate || null)}
            className={cn(
              "flex items-center justify-between gap-3 px-3 py-2 rounded-md text-sm",
              "text-foreground hover:bg-muted/60 transition-colors",
              activeCategory === "" && "bg-muted font-semibold text-primary",
            )}
            aria-current={activeCategory === "" ? "page" : undefined}
          >
            <span>Semua Kategori</span>
            <ChevronRight
              className={`h-4 w-4 shrink-0 text-muted-foreground ${activeCategory === "" ? "" : "mr-2"}`}
            />
          </Link>

          {/* Loading skeleton saat kategori belum dimuat */}
          {loadingCategories && (
            <>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2">
                  <Skeleton className="h-4 w-4 rounded" />
                  <Skeleton className="h-4 w-28" />
                </div>
              ))}
            </>
          )}

          {/* Daftar kategori dari API */}
          {!loadingCategories &&
            categoryOptions?.map((cat: { label: string; value: string }) => {
              const isActive = activeCategory === cat.value;
              const href = buildCategoryHref(cat.value, currentDate || null);

              return (
                <Link
                  key={cat.value}
                  href={href}
                  className={cn(
                    "flex items-center justify-between gap-3 px-3 py-2 rounded-md text-sm",
                    "text-foreground hover:bg-muted/60 transition-colors",
                    isActive && "bg-muted font-semibold text-primary",
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  <span>{cat.label}</span>
                  <ChevronRight
                    className={`h-4 w-4 shrink-0 text-muted-foreground ${isActive ? "" : "mr-2"}`}
                  />
                </Link>
              );
            })}
        </nav>
      </div>

      {/* ── Dropdown Kategori (Mobile View) ── */}
      <div className="flex w-full min-w-0 flex-col gap-2 md:hidden">
        <Label htmlFor="mobile-category" className="text-sm font-semibold">
          Kategori
        </Label>
        {loadingCategories ? (
          <Skeleton className="h-9 w-full rounded-md" />
        ) : (
          <Select
            value={activeCategory || "all"}
            onValueChange={handleCategoryChange}
          >
            <SelectTrigger
              id="mobile-category"
              className={filterTriggerClassName}
            >
              <SelectValue placeholder="Pilih Kategori" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Kategori</SelectItem>
              {categoryOptions?.map((cat: { label: string; value: string }) => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </aside>
  );
}

// ─── Skeleton Export ──────────────────────────────────────────────────────────

/** Loading skeleton untuk SidebarIndeks (digunakan di Suspense fallback) */
export function SidebarIndeksSkeleton({ className }: { className?: string }) {
  return (
    <aside className={cn("flex flex-col gap-6", className)}>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-3 w-40" />
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-9 w-full rounded-md" />
      </div>
      <div className="border-t border-muted" />
      <div className="flex flex-col gap-1">
        <Skeleton className="h-4 w-20 mb-2" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-2">
            <Skeleton className="h-4 w-4 rounded-full" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
    </aside>
  );
}
