"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DragDropProvider } from "@dnd-kit/react";
import { isSortable } from "@dnd-kit/react/sortable";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import axios from "@/lib/axios";
import type { CategoryWithParent } from "@/types/category";
import { fetchAllCategoriesPages } from "@/components/categories/categoryModalFetch";
import { SortableFeaturedCategoryCard } from "./SortableFeaturedCategoryCard";
import { CategoryOrderModalLayout } from "./CategoryOrderModalLayout";
import {
  buildFeaturedBulkPayload,
  categoryToFeaturedSortItem,
  type FeaturedCategorySortItem,
} from "./featuredOrderPayload";

export interface FeaturedCategoriesOrderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Draf unggulan disimpan di parent agar bertahan walau modal ditutup. */
  featuredItems: FeaturedCategorySortItem[];
  onFeaturedItemsChange: React.Dispatch<
    React.SetStateAction<FeaturedCategorySortItem[]>
  >;
  onSaveSuccess?: () => void;
}

export default function FeaturedCategoriesOrderModal({
  open,
  onOpenChange,
  featuredItems,
  onFeaturedItemsChange,
  onSaveSuccess,
}: FeaturedCategoriesOrderModalProps) {
  const [loadingFeaturedSeed, setLoadingFeaturedSeed] = useState(false);
  const featuredSeedDoneRef = useRef(false);

  const [picklistCats, setPicklistCats] = useState<CategoryWithParent[]>([]);
  const [loadingPicklist, setLoadingPicklist] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedIds = useMemo(
    () => new Set(featuredItems.map((i) => i._id)),
    [featuredItems],
  );

  useEffect(() => {
    if (!open) {
      featuredSeedDoneRef.current = false;
      setSearchQuery("");
      setDebouncedSearch("");
      return;
    }

    if (featuredItems.length > 0 || featuredSeedDoneRef.current) {
      return;
    }

    let cancelled = false;
    setLoadingFeaturedSeed(true);
    fetchAllCategoriesPages({ onlyFeatured: true, sortBy: "featuredOrder" })
      .then((cats) => {
        if (cancelled) return;
        const mapped: FeaturedCategorySortItem[] = [];
        for (const c of cats) {
          const row = categoryToFeaturedSortItem(c);
          if (row) mapped.push(row);
        }
        onFeaturedItemsChange((prev) => {
          if (prev.length > 0) return prev;
          return mapped;
        });
      })
      .catch(() => {
        if (!cancelled) toast.error("Gagal memuat kategori unggulan.");
      })
      .finally(() => {
        if (!cancelled) {
          featuredSeedDoneRef.current = true;
          setLoadingFeaturedSeed(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, featuredItems.length, onFeaturedItemsChange]);

  useEffect(() => {
    if (!open) return;
    if (featuredItems.length > 0) {
      featuredSeedDoneRef.current = true;
    }
  }, [open, featuredItems.length]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoadingPicklist(true);
    fetchAllCategoriesPages({})
      .then((cats) => {
        if (!cancelled) setPicklistCats(cats);
      })
      .catch(() => {
        if (!cancelled) toast.error("Gagal memuat daftar kategori.");
      })
      .finally(() => {
        if (!cancelled) setLoadingPicklist(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [searchQuery, open]);

  const filteredPicker = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return picklistCats;
    return picklistCats.filter((c) => {
      const name = c.name?.toLowerCase() ?? "";
      const slug = c.slug?.toLowerCase() ?? "";
      const nick = c.nickname?.trim().toLowerCase() ?? "";
      return (
        name.includes(q) ||
        slug.includes(q) ||
        (nick !== "" && nick.includes(q))
      );
    });
  }, [picklistCats, debouncedSearch]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- event drag @dnd-kit
  const handleDragEnd = useCallback((event: any) => {
    if (event.canceled) return;
    const { source } = event.operation;
    if (isSortable(source)) {
      const { initialIndex, index } = source.sortable;
      if (initialIndex !== index) {
        onFeaturedItemsChange((items) => {
          const next = [...items];
          const [moved] = next.splice(initialIndex, 1);
          next.splice(index, 0, moved);
          return next;
        });
      }
    }
  }, [onFeaturedItemsChange]);

  const handleAdd = useCallback(
    (cat: CategoryWithParent) => {
      const item = categoryToFeaturedSortItem(cat);
      if (!item) {
        toast.error("Kategori tidak memiliki ID valid.");
        return;
      }
      onFeaturedItemsChange((prev) => {
        if (prev.some((p) => p._id === item._id)) return prev;
        const next = [...prev, item];
        queueMicrotask(() =>
          toast.success("Ditambahkan ke daftar unggulan (simpan untuk menerapkan)."),
        );
        return next;
      });
    },
    [onFeaturedItemsChange],
  );

  const handleRemove = useCallback(
    (id: string) => {
      onFeaturedItemsChange((prev) => prev.filter((p) => p._id !== id));
    },
    [onFeaturedItemsChange],
  );

  const handleSave = useCallback(async () => {
    const items = buildFeaturedBulkPayload(featuredItems);
    setSaving(true);
    try {
      await axios.post("/categories/featured", { items });
      toast.success("Urutan kategori unggulan tersimpan.");
      onSaveSuccess?.();
      onOpenChange(false);
    } catch (err: unknown) {
      const ax = err as {
        response?: { data?: { error?: string; message?: string } };
      };
      const msg =
        ax.response?.data?.error ||
        ax.response?.data?.message ||
        (err instanceof Error ? err.message : "") ||
        "Gagal menyimpan urutan kategori unggulan.";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }, [featuredItems, onOpenChange, onSaveSuccess]);

  const leftBusy = loadingFeaturedSeed && featuredItems.length === 0;

  const orderPanel = (
    <>
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-base font-semibold">Diunggulkan</h3>
        <p className="text-sm font-normal text-muted-foreground">
          {featuredItems.length} kategori
        </p>
      </div>
      <div className="min-h-[200px] flex-1 overflow-y-auto overscroll-y-contain pr-1">
        {leftBusy ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : featuredItems.length === 0 ? (
          <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-border px-4 text-center text-sm text-muted-foreground">
            Belum ada kategori yang diunggulkan. Tambahkan dari panel kanan
            atau simpan kosong untuk menonaktifkan semua unggulan.
          </div>
        ) : (
          <DragDropProvider onDragEnd={handleDragEnd}>
            <div className="flex flex-col gap-2">
              {featuredItems.map((item, index) => (
                <SortableFeaturedCategoryCard
                  key={item._id}
                  category={item}
                  index={index}
                  onRemove={handleRemove}
                />
              ))}
            </div>
          </DragDropProvider>
        )}
      </div>
    </>
  );

  const pickerPanel = (
    <>
      <h3 className="mb-3 text-base font-semibold">Cari &amp; tambahkan</h3>
      <Input
        type="search"
        placeholder="Saring nama, slug, atau nama panggilan…"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="mb-3 text-base md:text-sm"
        aria-label="Saring daftar kategori"
      />
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-y-contain pr-1">
        {loadingPicklist ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
          </div>
        ) : filteredPicker.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {debouncedSearch.trim()
              ? "Tidak ada kategori yang cocok dengan saringan."
              : "Tidak ada kategori di sistem."}
          </p>
        ) : (
          filteredPicker.map((cat) => {
            const id = cat._id != null ? String(cat._id) : "";
            const already = Boolean(id && selectedIds.has(id));
            return (
              <div
                key={id || cat.slug}
                className="rounded-lg border border-border bg-background p-3"
              >
                <p className="font-medium leading-tight">{cat.name}</p>
                <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                  {cat.slug}
                </p>
                <div className="mt-2 flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={already || !id || saving}
                    onClick={() => handleAdd(cat)}
                    aria-label={
                      already
                        ? `${cat.name} sudah diunggulkan`
                        : `Tambahkan ${cat.name} ke unggulan`
                    }
                  >
                    <Plus className="mr-1 h-4 w-4" />
                    {already ? "Sudah unggulan" : "Tambah ke unggulan"}
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] w-full lg:max-w-5xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-border px-6 py-4 text-left">
          <DialogTitle>Urutan kategori unggulan</DialogTitle>
          <DialogDescription>
            Kiri: seret untuk mengurutkan. Kanan: tambahkan dari seluruh
            kategori (filter kotak cari). Simpan untuk menerapkan ke server.
          </DialogDescription>
        </DialogHeader>

        <CategoryOrderModalLayout
          orderTabLabel="Diunggulkan"
          pickerTabLabel="Cari & tambah"
          defaultMobileTab="picker"
          orderPanel={orderPanel}
          pickerPanel={pickerPanel}
        />

        <DialogFooter className="shrink-0 flex-col gap-2 border-t border-border bg-muted/30 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-left text-xs text-muted-foreground">
            Menghapus semua kartu dan menyimpan akan menonaktifkan unggulan bagi
            semua kategori.
          </p>
          <Button
            type="button"
            disabled={leftBusy || saving}
            className="shrink-0"
            onClick={() => void handleSave()}
          >
            {saving ? "Menyimpan…" : "Simpan perubahan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
