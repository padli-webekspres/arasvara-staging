"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useDropzone } from "react-dropzone";
import { DragDropProvider } from "@dnd-kit/react";
import { v4 as uuidv4 } from "uuid";
import { toast } from "sonner";
import { get as idbGet, set as idbSet, del as idbDel } from "idb-keyval";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronUp, ImageOff, Plus, Save } from "lucide-react";
import Image from "next/image";
import CropImageModal from "@/components/media/CropImageModal";
import { shouldUnoptimizeNewsCardImage } from "@/lib/utils";
import { getAdminStandardCardGridClass } from "@/lib/admin-card-grid";
import SearchableSelect from "@/components/ui/SearchableSelect";
import {
  ADS_SINGLE_ARTICLE_SECTION_ORDER,
  AdsSingleArticlePlacement,
  adsSingleArticleBannerCropSpec,
  adsSingleArticlePlacementLabel,
  type AdsArticleCategory,
} from "@/types/ads";
import AdsFormCard, { type AdsFormCardItem } from "./AdsFormCard";
import type { option } from "@/types/general";

// ─── Konstanta persistence ────────────────────────────────────────────────────

const LS_META_KEY = "arasvara-single-article-ads-v1";

function idbBannerKey(id: string): string {
  return `single-article-ad-banner:${id}`;
}

// ─── Tipe internal ────────────────────────────────────────────────────────────

export interface AdsServerBanner {
  url: string;
  filename: string;
  mimetype: string;
  size: number;
}

export interface SingleArticleDraft {
  _id: string;
  serverId?: string;
  name: string;
  placement: AdsSingleArticlePlacement;
  linkUrl: string;
  order: number;
  startedAt: string;
  endedAt: string;
  banner: {
    previewUrl: string;
    blob?: Blob;
    serverData?: AdsServerBanner;
  };
}

type BannerState = {
  previewUrl: string;
  blob?: Blob;
  serverData?: AdsServerBanner;
} | null;

type SingleArticleDraftMeta = Omit<SingleArticleDraft, "banner">;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeOrders(items: SingleArticleDraft[]): SingleArticleDraft[] {
  const groups = new Map<AdsSingleArticlePlacement, SingleArticleDraft[]>();

  for (const item of items) {
    const g = groups.get(item.placement) ?? [];
    g.push(item);
    groups.set(item.placement, g);
  }

  const out: SingleArticleDraft[] = [];
  for (const placement of ADS_SINGLE_ARTICLE_SECTION_ORDER) {
    const list = (groups.get(placement) ?? []).sort(
      (a, b) => a.order - b.order,
    );
    list.forEach((item, idx) => out.push({ ...item, order: idx }));
  }
  return out;
}

function cloneBannerSlot(
  b: SingleArticleDraft["banner"],
): SingleArticleDraft["banner"] {
  if (b.blob) {
    return { blob: b.blob, previewUrl: URL.createObjectURL(b.blob) };
  }
  return { previewUrl: b.previewUrl, serverData: b.serverData };
}

function nowLocalStr(): string {
  const d = new Date();
  d.setSeconds(0, 0);
  return d.toISOString().slice(0, 16);
}

function monthLaterStr(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  d.setSeconds(0, 0);
  return d.toISOString().slice(0, 16);
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface AdsSingleArticleFormProps {
  initialItems?: SingleArticleDraft[];
  initialCategories?: AdsArticleCategory[];
  /** Daftar kategori yang tersedia — dilempar dari page. */
  categoryOptions: option[];
  /**
   * Dipanggil ketika user mengubah scope kategori.
   * Page akan fetch ulang iklan untuk kategori yang dipilih.
   */
  onLoadScope?: (cats: AdsArticleCategory[]) => void;
  onSave?: (
    items: SingleArticleDraft[],
    categories: AdsArticleCategory[],
  ) => Promise<void>;
}

// ─── Komponen ─────────────────────────────────────────────────────────────────

export default function AdsSingleArticleForm({
  initialItems = [],
  initialCategories = [],
  categoryOptions,
  onLoadScope,
  onSave,
}: AdsSingleArticleFormProps) {
  // ── State utama ──────────────────────────────────────────────────────────

  const [adItems, setAdItems] = useState<SingleArticleDraft[]>(() =>
    normalizeOrders(initialItems),
  );

  /** Scope kategori yang sedang dikelola dalam sesi ini. */
  const [scopeCategories, setScopeCategories] = useState<AdsArticleCategory[]>(
    initialCategories,
  );

  const preSnapshotRef = useRef<SingleArticleDraft[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const hydratedRef = useRef(false);
  const pageTopRef = useRef<HTMLDivElement>(null);

  // ── Form fields ──────────────────────────────────────────────────────────

  const [formPlacement, setFormPlacement] = useState<AdsSingleArticlePlacement>(
    AdsSingleArticlePlacement.VERTICAL,
  );
  const [name, setName] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [startedAt, setStartedAt] = useState(nowLocalStr);
  const [endedAt, setEndedAt] = useState(monthLaterStr);
  const [banner, setBanner] = useState<BannerState>(null);

  // ── Crop modal ───────────────────────────────────────────────────────────

  const [cropOpen, setCropOpen] = useState(false);
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null);
  const [cropPlacement, setCropPlacement] =
    useState<AdsSingleArticlePlacement>(AdsSingleArticlePlacement.VERTICAL);

  // ─────────────────────────────────────────────────────────────────────────
  // Sinkronisasi initialItems dari page (setelah fetch scope)
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    setAdItems(normalizeOrders(initialItems));
  }, [initialItems]);

  useEffect(() => {
    setScopeCategories(initialCategories);
  }, [initialCategories]);

  // ─────────────────────────────────────────────────────────────────────────
  // Persistence: hydrate dari localStorage + IDB saat mount
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    if (initialItems.length > 0) {
      hydratedRef.current = true;
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      try {
        const raw = localStorage.getItem(LS_META_KEY);
        if (!raw) {
          hydratedRef.current = true;
          return;
        }
        const metas = JSON.parse(raw) as SingleArticleDraftMeta[];
        if (!Array.isArray(metas)) {
          hydratedRef.current = true;
          return;
        }
        const items: SingleArticleDraft[] = [];
        for (const m of metas) {
          const blob = await idbGet<Blob>(idbBannerKey(m._id));
          if (!blob) continue;
          const placement = Object.values(AdsSingleArticlePlacement).includes(
            m.placement,
          )
            ? m.placement
            : AdsSingleArticlePlacement.VERTICAL;
          items.push({
            ...m,
            placement,
            banner: { blob, previewUrl: URL.createObjectURL(blob) },
          });
        }
        if (!cancelled && items.length > 0) {
          setAdItems(normalizeOrders(items));
        }
      } catch (e) {
        console.error("Gagal memuat draft single article:", e);
      } finally {
        if (!cancelled) hydratedRef.current = true;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initialItems]);

  // ─────────────────────────────────────────────────────────────────────────
  // Persistence: simpan ke localStorage + IDB setiap adItems berubah
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!hydratedRef.current) return;

    void (async () => {
      try {
        const metas: SingleArticleDraftMeta[] = adItems.map((it) => ({
          _id: it._id,
          serverId: it.serverId,
          name: it.name,
          placement: it.placement,
          linkUrl: it.linkUrl,
          order: it.order,
          startedAt: it.startedAt,
          endedAt: it.endedAt,
        }));
        localStorage.setItem(LS_META_KEY, JSON.stringify(metas));
        for (const it of adItems) {
          if (it.banner.blob) {
            await idbSet(idbBannerKey(it._id), it.banner.blob);
          }
        }
      } catch (e) {
        console.error("Gagal menyimpan draft single article:", e);
      }
    })();
  }, [adItems]);

  // ─────────────────────────────────────────────────────────────────────────
  // Revoke object URLs saat unmount
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (rawImageSrc) URL.revokeObjectURL(rawImageSrc);
    };
  }, [rawImageSrc]);

  const adItemsRef = useRef(adItems);
  adItemsRef.current = adItems;

  useEffect(() => {
    return () => {
      for (const it of adItemsRef.current) {
        if (it.banner.blob && it.banner.previewUrl) {
          URL.revokeObjectURL(it.banner.previewUrl);
        }
      }
    };
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Derived / memoized
  // ─────────────────────────────────────────────────────────────────────────

  const activePlacement = useMemo<AdsSingleArticlePlacement>(() => {
    if (editingId) {
      return (
        adItems.find((i) => i._id === editingId)?.placement ?? formPlacement
      );
    }
    return formPlacement;
  }, [editingId, adItems, formPlacement]);

  const sidebarCropSpec = adsSingleArticleBannerCropSpec(activePlacement);
  const modalCropSpec = adsSingleArticleBannerCropSpec(cropPlacement);

  const itemsByPlacement = useMemo(() => {
    const map = new Map<AdsSingleArticlePlacement, SingleArticleDraft[]>();
    for (const p of ADS_SINGLE_ARTICLE_SECTION_ORDER) {
      map.set(
        p,
        adItems
          .filter((i) => i.placement === p)
          .sort((a, b) => a.order - b.order),
      );
    }
    return map;
  }, [adItems]);

  // IDs kategori yang terpilih (untuk SearchableSelect)
  const selectedCategoryIds = useMemo(
    () => scopeCategories.map((c) => String(c._id)),
    [scopeCategories],
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Handlers — kategori scope
  // ─────────────────────────────────────────────────────────────────────────

  const handleCategoriesChange = (value: string | string[]) => {
    const ids = Array.isArray(value) ? value : [value];
    const cats: AdsArticleCategory[] = [];
    for (const id of ids) {
      const opt = categoryOptions.find((o) => o.value === id);
      if (!opt) continue;
      cats.push({
        _id: id,
        slug: opt.id ?? opt.label.toLowerCase().replace(/\s+/g, "-"),
      });
    }
    setScopeCategories(cats);
  };

  const handleLoadScope = () => {
    if (scopeCategories.length === 0) {
      toast.error("Pilih minimal 1 kategori terlebih dahulu");
      return;
    }
    onLoadScope?.(scopeCategories);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Handlers — placement
  // ─────────────────────────────────────────────────────────────────────────

  const handleFormPlacementChange = (value: string) => {
    const p = value as AdsSingleArticlePlacement;
    setFormPlacement(p);
    if (!editingId && banner) {
      if (banner.blob && banner.previewUrl)
        URL.revokeObjectURL(banner.previewUrl);
      setBanner(null);
      toast.info("Banner di-reset karena rasio berbeda tiap penempatan");
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Handlers — crop
  // ─────────────────────────────────────────────────────────────────────────

  const openCrop = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) {
        toast.error("Hanya file gambar yang diizinkan");
        return;
      }
      const placement = editingId
        ? (adItems.find((i) => i._id === editingId)?.placement ?? formPlacement)
        : formPlacement;
      setCropPlacement(placement);
      if (rawImageSrc) URL.revokeObjectURL(rawImageSrc);
      setRawImageSrc(URL.createObjectURL(file));
      setCropOpen(true);
    },
    [rawImageSrc, editingId, adItems, formPlacement],
  );

  const dz = useDropzone({
    onDrop: (files) => files[0] && openCrop(files[0]),
    accept: { "image/*": [] },
    maxFiles: 1,
    multiple: false,
  });

  const handleCropDone = useCallback(
    (blob: Blob) => {
      setCropOpen(false);
      if (rawImageSrc) URL.revokeObjectURL(rawImageSrc);
      setRawImageSrc(null);
      const label = adsSingleArticleBannerCropSpec(cropPlacement).label;
      const previewUrl = URL.createObjectURL(blob);
      setBanner((prev) => {
        if (prev?.previewUrl && prev.blob) URL.revokeObjectURL(prev.previewUrl);
        return { previewUrl, blob, serverData: undefined };
      });
      toast.success(`Banner ${label} berhasil di-crop`);
    },
    [rawImageSrc, cropPlacement],
  );

  const handleCropCancel = useCallback(() => {
    setCropOpen(false);
    if (rawImageSrc) URL.revokeObjectURL(rawImageSrc);
    setRawImageSrc(null);
  }, [rawImageSrc]);

  // ─────────────────────────────────────────────────────────────────────────
  // Handlers — form add/edit/remove
  // ─────────────────────────────────────────────────────────────────────────

  const resetForm = useCallback(() => {
    setEditingId(null);
    setName("");
    setLinkUrl("");
    setStartedAt(nowLocalStr());
    setEndedAt(monthLaterStr());
    if (banner?.blob && banner.previewUrl) URL.revokeObjectURL(banner.previewUrl);
    setBanner(null);
  }, [banner]);

  const handleAddOrUpdate = () => {
    if (!name.trim()) {
      toast.error("Nama iklan tidak boleh kosong");
      return;
    }
    if (!linkUrl.trim()) {
      toast.error("Link URL tidak boleh kosong");
      return;
    }
    if (scopeCategories.length === 0) {
      toast.error("Pilih minimal 1 kategori");
      return;
    }
    if (!banner || (!banner.blob && !banner.serverData)) {
      toast.error(`Banner (${sidebarCropSpec.label}) harus diisi`);
      return;
    }
    if (!startedAt || !endedAt) {
      toast.error("Tanggal mulai dan selesai harus diisi");
      return;
    }
    if (new Date(endedAt) <= new Date(startedAt)) {
      toast.error("Tanggal selesai harus setelah tanggal mulai");
      return;
    }

    if (editingId) {
      setAdItems((prev) => {
        const next = prev.map((item) => {
          if (item._id !== editingId) return item;
          if (item.banner.blob && item.banner.previewUrl) {
            URL.revokeObjectURL(item.banner.previewUrl);
          }
          return {
            ...item,
            name: name.trim(),
            placement: formPlacement,
            linkUrl,
            startedAt,
            endedAt,
            banner: cloneBannerSlot(banner),
          };
        });
        return normalizeOrders(next);
      });
      toast.success("Iklan diperbarui");
    } else {
      setAdItems((prev) => {
        const sectionCount = prev.filter(
          (i) => i.placement === formPlacement,
        ).length;
        const newItem: SingleArticleDraft = {
          _id: uuidv4(),
          name: name.trim(),
          placement: formPlacement,
          linkUrl,
          order: sectionCount,
          startedAt,
          endedAt,
          banner: cloneBannerSlot(banner),
        };
        return normalizeOrders([...prev, newItem]);
      });
      toast.success("Iklan berhasil ditambahkan");
    }

    if (banner?.blob && banner.previewUrl)
      URL.revokeObjectURL(banner.previewUrl);
    setBanner(null);
    setEditingId(null);
    setName("");
    setLinkUrl("");
    setStartedAt(nowLocalStr());
    setEndedAt(monthLaterStr());
  };

  const handleEditCard = (item: AdsFormCardItem) => {
    const full = adItems.find((i) => i._id === item._id);
    if (!full) return;
    if (banner?.blob && banner.previewUrl)
      URL.revokeObjectURL(banner.previewUrl);
    setEditingId(full._id);
    setFormPlacement(full.placement);
    setName(full.name ?? "");
    setLinkUrl(full.linkUrl);
    setStartedAt(full.startedAt);
    setEndedAt(full.endedAt);
    setBanner(cloneBannerSlot(full.banner));
  };

  const handleRemoveCard = (id: string) => {
    const item = adItems.find((i) => i._id === id);
    if (item) {
      if (item.banner.blob && item.banner.previewUrl) {
        URL.revokeObjectURL(item.banner.previewUrl);
      }
      void idbDel(idbBannerKey(id));
    }
    setAdItems((prev) => normalizeOrders(prev.filter((i) => i._id !== id)));
    if (editingId === id) resetForm();
    toast.success("Iklan dihapus");
  };

  const handleDragEndForPlacement =
    (placement: AdsSingleArticlePlacement) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (event: any) => {
      if (event.canceled) return;
      const { source } = event.operation;
      if (source && "sortable" in source) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const { initialIndex, index } = source.sortable;
        if (initialIndex !== index) {
          setAdItems((prev) => {
            const sectionItems = prev
              .filter((i) => i.placement === placement)
              .sort((a, b) => a.order - b.order);
            const updated = [...sectionItems];
            const [moved] = updated.splice(initialIndex, 1);
            updated.splice(index, 0, moved);
            const others = prev.filter((i) => i.placement !== placement);
            const reindexed = updated.map((item, idx) => ({
              ...item,
              order: idx,
            }));
            return normalizeOrders([...others, ...reindexed]);
          });
          toast.success("Urutan diperbarui");
        }
      }
    };

  // ─────────────────────────────────────────────────────────────────────────
  // Handler — save
  // ─────────────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!onSave) return;
    if (scopeCategories.length === 0) {
      toast.error("Pilih minimal 1 kategori sebelum menyimpan");
      return;
    }
    setIsSaving(true);
    preSnapshotRef.current = adItems;
    try {
      await onSave(adItems, scopeCategories);
    } catch {
      setAdItems(preSnapshotRef.current);
      toast.error("Gagal menyimpan — perubahan dikembalikan ke kondisi sebelumnya");
    } finally {
      setIsSaving(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Derived flags
  // ─────────────────────────────────────────────────────────────────────────

  const canAdd =
    scopeCategories.length > 0 &&
    name.trim().length > 0 &&
    linkUrl.trim().length > 0 &&
    banner !== null &&
    (banner.blob != null || banner.serverData != null);

  const sidebarHasPendingInput =
    cropOpen ||
    editingId !== null ||
    name.trim().length > 0 ||
    linkUrl.trim().length > 0 ||
    banner !== null;

  const scrollToPageTop = useCallback(() => {
    pageTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div ref={pageTopRef} className="w-full">
      {/* Header */}
      <div className="mb-6 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold">Iklan Single Article</h1>
          <p className="text-sm text-muted-foreground">
            Kelola slot iklan per halaman artikel · pilih kategori scope lalu
            muat data · drag untuk mengurutkan
          </p>
        </div>
        {onSave && (
          <Button
            onClick={handleSave}
            disabled={
              isSaving ||
              scopeCategories.length === 0 ||
              sidebarHasPendingInput
            }
            size="lg"
          >
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? "Menyimpan..." : "Simpan Perubahan"}
          </Button>
        )}
      </div>

      <div className="relative grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-3 xl:items-start xl:min-h-0">
        {/* ── Left panel: 2 seksi (VERTICAL + HORIZONTAL) ── */}
        <div className="order-2 min-w-0 space-y-8 xl:order-1 xl:col-span-2 xl:min-h-0">
          {ADS_SINGLE_ARTICLE_SECTION_ORDER.map((placement) => {
            const sectionItems = itemsByPlacement.get(placement) ?? [];
            const label = adsSingleArticlePlacementLabel(placement);
            const cropLabel = adsSingleArticleBannerCropSpec(placement).label;

            return (
              <div
                key={placement}
                className="flex flex-col overflow-hidden rounded-lg border border-border bg-card p-4"
              >
                <div className="mb-4 flex items-center justify-between gap-2">
                  <h3 className="text-lg font-semibold">{label}</h3>
                  <p className="text-sm text-muted-foreground">
                    {sectionItems.length} slot · crop {cropLabel}
                  </p>
                </div>

                <div className="flex-1 overflow-y-auto pr-1">
                  {sectionItems.length === 0 ? (
                    <div className="flex min-h-[140px] items-center justify-center rounded-lg border-2 border-dashed border-border">
                      <p className="text-center text-sm text-muted-foreground">
                        Belum ada iklan di penempatan ini.
                        <br />
                        Pilih &quot;{label}&quot; di sidebar lalu tambahkan
                        banner ({cropLabel}).
                      </p>
                    </div>
                  ) : (
                    <DragDropProvider
                      onDragEnd={handleDragEndForPlacement(placement)}
                    >
                      <div className={getAdminStandardCardGridClass()}>
                        {sectionItems.map((item, index) => (
                          <AdsFormCard
                            key={item._id}
                            item={item}
                            index={index}
                            isSelected={editingId === item._id}
                            onEdit={handleEditCard}
                            onRemove={handleRemoveCard}
                            cropSpecOverride={adsSingleArticleBannerCropSpec(
                              placement,
                            )}
                          />
                        ))}
                      </div>
                    </DragDropProvider>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Sidebar kanan ── */}
        <div className="order-1 flex min-w-0 flex-col gap-4 rounded-lg border border-border bg-card p-4 xl:order-2 xl:sticky xl:top-20 xl:z-10 xl:max-h-[calc(100vh-6rem)] xl:min-h-0 xl:self-start xl:overflow-y-auto xl:overscroll-contain xl:shadow-sm">
          <h3 className="text-lg font-semibold">
            {editingId ? "Edit Iklan" : "Tambah Iklan Baru"}
          </h3>

          {/* 1. Kategori scope */}
          <div className="space-y-1.5">
            <Label>
              Kategori <span className="text-destructive">*</span>
            </Label>
            <SearchableSelect
              options={categoryOptions}
              value={selectedCategoryIds}
              onChange={handleCategoriesChange}
              placeholder="Pilih kategori..."
              isMulti
            />
            <div className="flex items-center gap-2">
              <p className="flex-1 text-[11px] text-muted-foreground">
                Iklan akan berlaku di semua artikel berkategori ini.
              </p>
              {onLoadScope && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 text-xs"
                  disabled={scopeCategories.length === 0}
                  onClick={handleLoadScope}
                >
                  Muat
                </Button>
              )}
            </div>
          </div>

          {/* 2. Penempatan */}
          <div className="space-y-1.5">
            <Label htmlFor="adPlacement">
              Penempatan <span className="text-destructive">*</span>
            </Label>
            <Select
              value={formPlacement}
              onValueChange={handleFormPlacementChange}
              disabled={banner !== null}
            >
              <SelectTrigger id="adPlacement" className="w-full">
                <SelectValue placeholder="Pilih penempatan" />
              </SelectTrigger>
              <SelectContent>
                {ADS_SINGLE_ARTICLE_SECTION_ORDER.map((p) => (
                  <SelectItem key={p} value={p}>
                    {adsSingleArticlePlacementLabel(p)} (
                    {adsSingleArticleBannerCropSpec(p).label})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Rasio crop: {sidebarCropSpec.label}
            </p>
          </div>

          {/* 3. Nama iklan */}
          <div className="space-y-1.5">
            <Label htmlFor="adName">
              Nama iklan <span className="text-destructive">*</span>
            </Label>
            <Input
              id="adName"
              type="text"
              placeholder="Contoh: Promo Agustus"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* 4. Link URL */}
          <div className="space-y-1.5">
            <Label htmlFor="linkUrl">
              Link URL <span className="text-destructive">*</span>
            </Label>
            <Input
              id="linkUrl"
              type="url"
              placeholder="https://example.com/promo"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
            />
          </div>

          {/* 5. Tanggal */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="startedAt">Mulai</Label>
              <Input
                id="startedAt"
                type="datetime-local"
                value={startedAt}
                onChange={(e) => setStartedAt(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="endedAt">Selesai</Label>
              <Input
                id="endedAt"
                type="datetime-local"
                value={endedAt}
                onChange={(e) => setEndedAt(e.target.value)}
              />
            </div>
          </div>

          {/* 6. Banner */}
          <div className="space-y-2 rounded-lg border border-border p-3">
            <Label className="flex flex-wrap items-center gap-1.5">
              Banner
              <span className="text-[10px] font-normal text-muted-foreground">
                ({sidebarCropSpec.label})
              </span>
              <span className="text-destructive">*</span>
            </Label>

            {banner ? (
              <div className="space-y-2">
                <div
                  className={`relative w-full overflow-hidden rounded-md bg-muted ${sidebarCropSpec.previewAspectClass}`}
                >
                  <Image
                    src={banner.previewUrl}
                    alt="Pratinjau banner"
                    fill
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 320px"
                    unoptimized={shouldUnoptimizeNewsCardImage(banner.previewUrl)}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    if (banner.blob && banner.previewUrl)
                      URL.revokeObjectURL(banner.previewUrl);
                    setBanner(null);
                  }}
                >
                  <ImageOff className="mr-1.5 h-3.5 w-3.5" />
                  Hapus & ganti
                </Button>
              </div>
            ) : (
              <div
                {...dz.getRootProps()}
                className={`cursor-pointer select-none rounded-lg border-2 border-dashed px-4 py-8 text-center text-sm transition-colors ${
                  dz.isDragActive
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50 hover:bg-muted/30"
                }`}
              >
                <input {...dz.getInputProps()} />
                <p className="font-medium">Drag & drop atau klik untuk pilih</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Crop rasio {sidebarCropSpec.label}
                </p>
              </div>
            )}
          </div>

          {/* 7. Tombol aksi */}
          <Button
            type="button"
            className="w-full"
            disabled={!canAdd}
            onClick={handleAddOrUpdate}
          >
            <Plus className="mr-2 h-4 w-4" />
            {editingId ? "Perbarui Iklan" : "Tambahkan Iklan"}
          </Button>

          {editingId && (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={resetForm}
            >
              Batal Edit
            </Button>
          )}
        </div>
      </div>

      {/* Crop modal */}
      {rawImageSrc && (
        <CropImageModal
          open={cropOpen}
          imageSrc={rawImageSrc}
          aspect={modalCropSpec.aspect}
          title={`Crop banner (${modalCropSpec.label})`}
          onCrop={handleCropDone}
          onCancel={handleCropCancel}
        />
      )}

      {/* Floating scroll-to-top (mobile only) */}
      <Button
        type="button"
        variant="secondary"
        size="icon"
        className="fixed bottom-5 right-5 z-50 h-11 w-11 rounded-full border border-border shadow-md lg:hidden"
        aria-label="Kembali ke atas"
        onClick={scrollToPageTop}
      >
        <ChevronUp className="h-5 w-5" />
      </Button>
    </div>
  );
}
