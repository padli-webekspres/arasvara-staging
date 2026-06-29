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
import {
  AdsPosition,
  ADS_HOMEPAGE_SECTION_ORDER,
  adsHomepageBannerCropSpec,
  adsHomepageEffectiveSpan,
  adsHomepagePositionLabel,
  adsHomepageSupportsSpan,
} from "@/types/ads";
import AdsFormCard, { type AdsFormCardItem } from "./AdsFormCard";

const LS_META_KEY = "arasvara-homepage-ads-v5";

function idbBannerKey(id: string): string {
  return `homepage-ad-banner:${id}`;
}

function isAdsPosition(v: string): v is AdsPosition {
  return Object.values(AdsPosition).includes(v as AdsPosition);
}

/** Normalisasi `order` per posisi (0..n-1) setelah tambah/hapus/pindah section. */
function normalizeAllOrders(items: AdsDraft[]): AdsDraft[] {
  const groups = new Map<AdsPosition, AdsDraft[]>();
  for (const item of items) {
    const g = groups.get(item.position) ?? [];
    g.push(item);
    groups.set(item.position, g);
  }

  const orderedPositions = [
    ...ADS_HOMEPAGE_SECTION_ORDER.filter((p) => groups.has(p)),
    ...[...groups.keys()].filter(
      (p) => !ADS_HOMEPAGE_SECTION_ORDER.includes(p),
    ),
  ];

  const out: AdsDraft[] = [];
  for (const pos of orderedPositions) {
    const list = (groups.get(pos) ?? []).sort((a, b) => a.order - b.order);
    list.forEach((item, idx) =>
      out.push({ ...item, position: pos, order: idx }),
    );
  }
  return out;
}

export interface AdsServerBanner {
  url: string;
  filename: string;
  mimetype: string;
  size: number;
}

export interface AdsDraft {
  _id: string;
  name: string;
  serverId?: string;
  /** Slot penempatan di homepage (API `position`). */
  position: AdsPosition;
  /** Hanya relevan untuk posisi span-eligible; selalu 1 | 2 (non-eligible disimpan sebagai 1). */
  span: 1 | 2;
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

function cloneBannerSlot(b: AdsDraft["banner"]): AdsDraft["banner"] {
  if (b.blob) {
    return {
      blob: b.blob,
      previewUrl: URL.createObjectURL(b.blob),
      serverData: undefined,
    };
  }
  return {
    previewUrl: b.previewUrl,
    serverData: b.serverData,
  };
}

interface AdsHomepageFormProps {
  initialItems?: AdsDraft[];
  onSave?: (items: AdsDraft[]) => Promise<void> | void;
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

type AdsDraftMeta = Omit<AdsDraft, "banner"> & { serverId?: string };

export default function AdsHomepageForm({
  initialItems = [],
  onSave,
}: AdsHomepageFormProps) {
  const [adItems, setAdItems] = useState<AdsDraft[]>(() =>
    normalizeAllOrders(initialItems),
  );

  const preSnapshotRef = useRef<AdsDraft[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const hydratedRef = useRef(false);
  /** Anchor scroll “ke atas” pada layar sempit (sidebar di atas konten). */
  const pageTopRef = useRef<HTMLDivElement>(null);

  const [formPosition, setFormPosition] = useState<AdsPosition>(
    AdsPosition.HEADLINE,
  );
  const [linkUrl, setLinkUrl] = useState("");
  const [name, setName] = useState("");
  const [startedAt, setStartedAt] = useState(nowLocalStr);
  const [endedAt, setEndedAt] = useState(monthLaterStr);
  const [banner, setBanner] = useState<BannerState>(null);
  const [formSpan, setFormSpan] = useState<1 | 2>(1);

  const [cropOpen, setCropOpen] = useState(false);
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null);
  /** Posisi yang dipakai untuk rasio crop modal saat ini */
  const [cropAspectPosition, setCropAspectPosition] = useState<AdsPosition>(
    AdsPosition.HEADLINE,
  );
  /** Span yang dipakai untuk rasio crop modal saat ini */
  const [cropAspectSpan, setCropAspectSpan] = useState<1 | 2>(1);

  useEffect(() => {
    setAdItems(
      normalizeAllOrders(
        initialItems.map((it) => ({
          ...it,
          span: adsHomepageEffectiveSpan(it.position, it.span),
        })),
      ),
    );
  }, [initialItems]);

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
        const metas = JSON.parse(raw) as AdsDraftMeta[];
        if (!Array.isArray(metas)) {
          hydratedRef.current = true;
          return;
        }
        const items: AdsDraft[] = [];
        for (const m of metas) {
          const blob = await idbGet<Blob>(idbBannerKey(m._id));
          if (!blob) continue;
          const posRaw =
            typeof (m as AdsDraftMeta & { position?: string }).position ===
            "string"
              ? (m as AdsDraftMeta & { position?: string }).position!
              : AdsPosition.HEADLINE;
          const position = isAdsPosition(posRaw)
            ? posRaw
            : AdsPosition.HEADLINE;
          const spanRaw = (m as AdsDraftMeta & { span?: unknown }).span;
          const parsedSpan =
            spanRaw === 2 ? 2 : spanRaw === 1 ? 1 : undefined;
          items.push({
            ...m,
            position,
            span: adsHomepageEffectiveSpan(position, parsedSpan),
            name: typeof m.name === "string" ? m.name : "",
            banner: {
              blob,
              previewUrl: URL.createObjectURL(blob),
            },
          });
        }
        if (!cancelled && items.length > 0) {
          setAdItems(normalizeAllOrders(items));
        }
      } catch (e) {
        console.error("Gagal memuat draft iklan homepage:", e);
      } finally {
        if (!cancelled) hydratedRef.current = true;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialItems]);

  useEffect(() => {
    if (!hydratedRef.current) return;

    void (async () => {
      try {
        const metas: AdsDraftMeta[] = adItems.map((it) => ({
          _id: it._id,
          serverId: it.serverId,
          name: it.name,
          position: it.position,
          span: it.span,
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
        console.error("Gagal menyimpan draft iklan homepage:", e);
      }
    })();
  }, [adItems]);

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

  const activeCropPosition = useMemo(() => {
    if (editingId) {
      return (
        adItems.find((i) => i._id === editingId)?.position ??
        AdsPosition.HEADLINE
      );
    }
    return formPosition;
  }, [editingId, adItems, formPosition]);

  const sidebarCropSpec = adsHomepageBannerCropSpec(activeCropPosition, formSpan);
  const modalCropSpec = adsHomepageBannerCropSpec(cropAspectPosition, cropAspectSpan);

  const openCrop = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) {
        toast.error("Hanya file gambar yang diizinkan");
        return;
      }
      const pos = editingId
        ? (adItems.find((i) => i._id === editingId)?.position ?? formPosition)
        : formPosition;
      setCropAspectPosition(pos);
      setCropAspectSpan(formSpan);
      if (rawImageSrc) URL.revokeObjectURL(rawImageSrc);
      setRawImageSrc(URL.createObjectURL(file));
      setCropOpen(true);
    },
    [rawImageSrc, editingId, adItems, formPosition, formSpan],
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

      const label = adsHomepageBannerCropSpec(cropAspectPosition).label;
      const previewUrl = URL.createObjectURL(blob);
      setBanner((prev) => {
        if (prev?.previewUrl && prev.blob) URL.revokeObjectURL(prev.previewUrl);
        return { previewUrl, blob, serverData: undefined };
      });
      toast.success(`Banner ${label} berhasil di-crop`);
    },
    [rawImageSrc, cropAspectPosition],
  );

  const handleCropCancel = useCallback(() => {
    setCropOpen(false);
    if (rawImageSrc) URL.revokeObjectURL(rawImageSrc);
    setRawImageSrc(null);
  }, [rawImageSrc]);

  const resetForm = useCallback(() => {
    setEditingId(null);
    setName("");
    setLinkUrl("");
    setStartedAt(nowLocalStr());
    setEndedAt(monthLaterStr());
    if (banner?.blob && banner.previewUrl)
      URL.revokeObjectURL(banner.previewUrl);
    setBanner(null);
    setFormSpan(1);
  }, [banner]);

  /**
   * Ubah span selama sesi edit → hapus banner di sidebar (wajib crop ulang).
   * Ini TIDAK mempengaruhi adItems hingga handleAddOrUpdate dipanggil,
   * sehingga "Batal Edit" mengembalikan keadaan semula secara otomatis.
   */
  const handleSpanChange = (v: string) => {
    const next = v === "2" ? 2 : (1 as const);
    if (editingId && next !== formSpan) {
      if (banner?.blob && banner.previewUrl) URL.revokeObjectURL(banner.previewUrl);
      setBanner(null);
      toast.info(
        `Span berubah ke ${next}:${" "}rasio banner ikut berubah, mohon upload ulang gambar.`,
      );
    }
    setFormSpan(next);
  };

  const handleFormPositionChange = (value: string) => {
    if (!isAdsPosition(value)) return;
    setFormPosition(value);
    if (!adsHomepageSupportsSpan(value)) setFormSpan(1);
    if (!editingId && banner) {
      if (banner.blob && banner.previewUrl)
        URL.revokeObjectURL(banner.previewUrl);
      setBanner(null);
      toast.info("Banner di-reset karena rasio berbeda tiap posisi");
    }
  };

  const handleAddOrUpdate = () => {
    if (!name.trim()) {
      toast.error("Nama iklan tidak boleh kosong");
      return;
    }
    if (!linkUrl.trim()) {
      toast.error("Link URL tidak boleh kosong");
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

    const resolvedSpan = adsHomepageEffectiveSpan(formPosition, formSpan);

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
            position: formPosition,
            span: resolvedSpan,
            linkUrl,
            startedAt,
            endedAt,
            banner: cloneBannerSlot(banner),
          };
        });
        return normalizeAllOrders(next);
      });
      toast.success("Iklan diperbarui");
    } else {
      setAdItems((prev) => {
        const sectionCount = prev.filter(
          (i) => i.position === formPosition,
        ).length;
        const newItem: AdsDraft = {
          _id: uuidv4(),
          name: name.trim(),
          position: formPosition,
          span: resolvedSpan,
          linkUrl,
          order: sectionCount,
          startedAt,
          endedAt,
          banner: cloneBannerSlot(banner),
        };
        return normalizeAllOrders([...prev, newItem]);
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
    setFormSpan(1);
  };

  const handleEditCard = (item: AdsFormCardItem) => {
    const full = adItems.find((i) => i._id === item._id);
    if (!full) return;
    if (banner?.blob && banner.previewUrl)
      URL.revokeObjectURL(banner.previewUrl);
    setEditingId(full._id);
    setFormPosition(full.position);
    setName(full.name ?? "");
    setLinkUrl(full.linkUrl);
    setStartedAt(full.startedAt);
    setEndedAt(full.endedAt);
    setFormSpan(
      adsHomepageSupportsSpan(full.position)
        ? adsHomepageEffectiveSpan(full.position, full.span)
        : 1,
    );
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
    setAdItems((prev) => normalizeAllOrders(prev.filter((i) => i._id !== id)));
    if (editingId === id) resetForm();
    toast.success("Iklan dihapus");
  };

  const handleDragEndForSection =
    (position: AdsPosition) =>
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
              .filter((i) => i.position === position)
              .sort((a, b) => a.order - b.order);
            const updated = [...sectionItems];
            const [moved] = updated.splice(initialIndex, 1);
            updated.splice(index, 0, moved);
            const others = prev.filter((i) => i.position !== position);
            const reindexed = updated.map((item, idx) => ({
              ...item,
              order: idx,
            }));
            return normalizeAllOrders([...others, ...reindexed]);
          });
          toast.success("Urutan diperbarui");
        }
      }
    };

  const handleSave = async () => {
    if (!onSave) return;
    setIsSaving(true);
    preSnapshotRef.current = adItems;
    try {
      await onSave(adItems);
    } catch {
      setAdItems(preSnapshotRef.current);
      toast.error(
        "Gagal menyimpan — perubahan dikembalikan ke kondisi sebelumnya",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const canAdd =
    name.trim().length > 0 &&
    linkUrl.trim().length > 0 &&
    banner !== null &&
    (banner.blob != null || banner.serverData != null);

  /** Form sidebar tambah/edit sedang dipakai — tombol simpan global dinonaktifkan. */
  const sidebarHasPendingInput =
    cropOpen ||
    editingId !== null ||
    name.trim().length > 0 ||
    linkUrl.trim().length > 0 ||
    banner !== null;

  const itemsBySection = useMemo(() => {
    const map = new Map<AdsPosition, AdsDraft[]>();
    for (const p of ADS_HOMEPAGE_SECTION_ORDER) {
      map.set(
        p,
        adItems
          .filter((i) => i.position === p)
          .sort((a, b) => a.order - b.order),
      );
    }
    return map;
  }, [adItems]);

  const scrollToPageTop = useCallback(() => {
    pageTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const sidebarShowsSpan = adsHomepageSupportsSpan(formPosition);

  return (
    <div ref={pageTopRef} className="w-full">
      <div className="mb-6 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold">Iklan Homepage</h1>
          <p className="text-sm text-muted-foreground">
            Kelola slot per posisi · rasio banner mengikuti posisi · drag untuk
            mengurutkan dalam satu posisi
          </p>
        </div>
        {onSave && (
          <Button
            onClick={handleSave}
            disabled={
              isSaving || sidebarHasPendingInput
            }
            size="lg"
          >
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? "Menyimpan..." : "Simpan Perubahan"}
          </Button>
        )}
      </div>

      <div className="relative grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-3 xl:items-start xl:min-h-0">
        <div className="order-2 min-w-0 space-y-8 xl:order-1 xl:col-span-2 xl:min-h-0">
          {ADS_HOMEPAGE_SECTION_ORDER.map((position) => {
            const sectionItems = itemsBySection.get(position) ?? [];
            const label = adsHomepagePositionLabel(position);
            const cropLabel = adsHomepageBannerCropSpec(position, 1).label;

            return (
              <div
                key={position}
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
                        Belum ada iklan di posisi ini.
                        <br />
                        Pilih posisi di sidebar lalu tambahkan banner (
                        {cropLabel}
                        ).
                      </p>
                    </div>
                  ) : (
                    <DragDropProvider
                      onDragEnd={handleDragEndForSection(position)}
                    >
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {sectionItems.map((item, index) => (
                          <AdsFormCard
                            key={item._id}
                            item={item}
                            index={index}
                            isSelected={editingId === item._id}
                            onEdit={handleEditCard}
                            onRemove={handleRemoveCard}
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

        <div className="order-1 flex min-w-0 flex-col gap-4 rounded-lg border border-border bg-card p-4 xl:order-2 xl:sticky xl:top-20 xl:z-10 xl:max-h-[calc(100vh-6rem)] xl:min-h-0 xl:self-start xl:overflow-y-auto xl:overscroll-contain xl:shadow-sm">
          <h3 className="text-lg font-semibold">
            {editingId ? "Edit Iklan" : "Tambah Iklan Baru"}
          </h3>

          <div className="space-y-1.5">
            <Label htmlFor="adPosition">
              Posisi <span className="text-destructive">*</span>
            </Label>
            <Select
              value={formPosition}
              onValueChange={handleFormPositionChange}
              disabled={banner !== null}
            >
              <SelectTrigger id="adPosition" className="w-full">
                <SelectValue placeholder="Pilih posisi" />
              </SelectTrigger>
              <SelectContent>
                {ADS_HOMEPAGE_SECTION_ORDER.map((p) => (
                  <SelectItem key={p} value={p}>
                    {adsHomepagePositionLabel(p)} ({adsHomepageBannerCropSpec(p, 1).label})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Banner baru akan masuk ke section &quot;
              {adsHomepagePositionLabel(formPosition)}&quot;. Rasio crop:{" "}
              {sidebarCropSpec.label}.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="adName">
              Nama iklan <span className="text-destructive">*</span>
            </Label>
            <Input
              id="adName"
              type="text"
              placeholder="Contoh: Promo Minggu Ini"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

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

          {sidebarShowsSpan && (
            <div className="space-y-1.5">
              <Label htmlFor="adSpan">Lebar slot (span)</Label>
              <Select
                value={String(formSpan)}
                onValueChange={handleSpanChange}
              >
                <SelectTrigger id="adSpan" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Jumlah kolom grid yang dipakai slot ini (hanya untuk posisi ini).
              </p>
            </div>
          )}

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
                    if (banner.blob && banner.previewUrl) {
                      URL.revokeObjectURL(banner.previewUrl);
                    }
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
              onClick={() => resetForm()}
            >
              Batal Edit
            </Button>
          )}
        </div>
      </div>

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
