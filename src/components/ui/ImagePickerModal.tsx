"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Images, Upload, Check, X, AlertCircle, Loader2, SearchIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import DraftImageUploadForm from "@/components/media/DraftImageUploadForm";
import CropImageModal from "@/components/media/CropImageModal";
import ArticleAttributionDialog from "@/components/ui/ArticleAttributionDialog";
import api from "@/lib/axios";
import type { Media, PendingMedia } from "@/types/media";
import {
  CONTENT_CROP_ASPECT,
  CONTENT_CROP_HEIGHT,
  CONTENT_CROP_WIDTH,
  CONTENT_WEBP_QUALITY,
  FEATURED_CROP_ASPECT,
  FEATURED_CROP_HEIGHT,
  FEATURED_CROP_WIDTH,
  FEATURED_WEBP_QUALITY,
} from "@/lib/media/cropPresets";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Atribusi gambar yang spesifik untuk artikel (bukan data media asli). */
export interface ArticleAttribution {
  caption: string;
  credit: string;
}

/**
 * Hasil single-select — media yang dipilih beserta atribusi artikel.
 * Atribusi ini disimpan di dokumen artikel, bukan di koleksi media.
 */
export type ImagePickerResult = {
  media: Media | PendingMedia;
  articleAttribution: ArticleAttribution;
};

/**
 * Hasil multi-select — setiap media sudah memiliki atribusi default
 * yang bisa diedit lebih lanjut di daftar galeri artikel.
 */
export type MultiImagePickerResult = {
  selectedMediaArray: Array<{
    media: Media | PendingMedia;
    attribution: ArticleAttribution;
  }>;
};

export interface ImagePickerModalProps {
  open: boolean;
  onClose: () => void;
  onSelect?: (result: ImagePickerResult) => void;
  onSelectMultiple?: (result: MultiImagePickerResult) => void;
  isMultiSelect?: boolean;
  /** ID media yang sudah ada di galeri artikel — digunakan untuk mencegah duplikasi. */
  galleryMediaIds?: string[];
  /** Judul dialog atribusi — bisa disesuaikan per konteks (featured / body). */
  attributionDialogTitle?: string;
  /** Jika true, tombol crop menggunakan rasio tetap untuk featured image (1280x800). */
  cropForFeatured?: boolean;
}

type Tab = "upload" | "gallery";

const GALLERY_LIMIT = 20;

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Modal pemilih gambar yang mengorkestrasi seluruh alur:
 * - Tab Gallery: pilih dari media library → attribution dialog
 * - Tab Upload: pilih file → crop → form metadata → attribution dialog
 *
 * Untuk multi-select (format GALLERY), attribution dialog tidak muncul —
 * semua gambar langsung masuk dengan default caption & credit dari media.
 */
export default function ImagePickerModal({
  open,
  onClose,
  onSelect,
  onSelectMultiple,
  isMultiSelect = false,
  galleryMediaIds = [],
  attributionDialogTitle = "Atribusi Gambar untuk Artikel Ini",
  cropForFeatured = false,
}: ImagePickerModalProps) {
  const [tab, setTab] = useState<Tab>("upload");

  // ─── State Gallery ──────────────────────────────────────────────────────────
  const [mediaList, setMediaList] = useState<Media[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [galleryPage, setGalleryPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const [selectedMediaArray, setSelectedMediaArray] = useState<Media[]>([]);
  const [gallerySearch, setGallerySearch] = useState("");
  const [debouncedGallerySearch, setDebouncedGallerySearch] = useState("");
  const gallerySearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  // ─── State Upload (fase 1 → crop → fase 2) ─────────────────────────────────
  /** blobUrl gambar asli yang dipilih user — dikirim ke CropModal */
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  /** Blob hasil crop dari CropModal — dikirim ke DraftImageUploadForm (fase 2) */
  const [croppedBlob, setCroppedBlob] = useState<Blob | null>(null);

  // ─── State Attribution Dialog ───────────────────────────────────────────────
  const [attributionOpen, setAttributionOpen] = useState(false);
  const [attributionDefaultCaption, setAttributionDefaultCaption] = useState("");
  const [attributionDefaultCredit, setAttributionDefaultCredit] = useState("");
  /** Media final yang menunggu konfirmasi atribusi sebelum dikirim ke parent */
  const [pendingResultMedia, setPendingResultMedia] = useState<
    Media | PendingMedia | null
  >(null);

  const resetUploadState = useCallback(() => {
    // Revoke blob URL lama agar tidak ada memory leak
    if (cropSrc) {
      URL.revokeObjectURL(cropSrc);
    }
    setCropSrc(null);
    setCropOpen(false);
    setCroppedBlob(null);
  }, [cropSrc]);

  // ─── Reset semua state saat modal ditutup ───────────────────────────────────
  // Jangan reset jika crop/atribusi masih terbuka — di mobile, nested Dialog Radix
  // kadang memicu onOpenChange(false) pada picker saat crop baru dibuka, yang
  // sebelumnya merevoke blob URL dan menampilkan broken "Crop preview".
  useEffect(() => {
    if (!open && !cropOpen && !attributionOpen) {
      setSelectedMedia(null);
      setSelectedMediaArray([]);
      setTab("upload");
      setGallerySearch("");
      setDebouncedGallerySearch("");
      resetUploadState();
      setPendingResultMedia(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cropOpen, attributionOpen]);

  /** Nested crop/atribusi: cegah picker menutup & merevoke blob URL. */
  const hasNestedOverlay = cropOpen || attributionOpen;

  const handlePickerOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen && hasNestedOverlay) return;
      if (!nextOpen) onClose();
    },
    [hasNestedOverlay, onClose],
  );

  const preventOutsideDismissWhileNested = useCallback(
    (event: Event) => {
      if (hasNestedOverlay) {
        event.preventDefault();
      }
    },
    [hasNestedOverlay],
  );

  // Debounce search input (sama pola halaman /admin-xyz/media)
  useEffect(() => {
    if (gallerySearchDebounceRef.current) {
      clearTimeout(gallerySearchDebounceRef.current);
    }
    gallerySearchDebounceRef.current = setTimeout(() => {
      setDebouncedGallerySearch(gallerySearch);
    }, 300);
    return () => {
      if (gallerySearchDebounceRef.current) {
        clearTimeout(gallerySearchDebounceRef.current);
      }
    };
  }, [gallerySearch]);

  const loadGallery = useCallback(async (page: number, reset = false, query = "") => {
    setGalleryLoading(true);
    try {
      const params = new URLSearchParams({
        filter: "image",
        page: String(page),
        limit: String(GALLERY_LIMIT),
      });
      const trimmed = query.trim();
      if (trimmed) params.set("query", trimmed);

      const res = await api.get<{
        success: boolean;
        media: Media[];
        total?: number;
      }>(`/media?${params.toString()}`);
      const items: Media[] = res.data.media ?? [];
      setMediaList((prev) => (reset ? items : [...prev, ...items]));
      setHasMore(items.length === GALLERY_LIMIT);
    } catch (err) {
      console.error("Gagal memuat galeri media:", err);
    } finally {
      setGalleryLoading(false);
    }
  }, []);

  // ─── Load gallery saat tab gallery aktif atau query berubah ───────────────
  useEffect(() => {
    if (tab === "gallery" && open) {
      setMediaList([]);
      setGalleryPage(1);
      setHasMore(false);
      void loadGallery(1, true, debouncedGallerySearch);
    }
  }, [tab, open, debouncedGallerySearch, loadGallery]);

  const handleLoadMore = () => {
    const next = galleryPage + 1;
    setGalleryPage(next);
    void loadGallery(next, false, debouncedGallerySearch);
  };

  // ─── Helper: cek status seleksi ────────────────────────────────────────────
  const isMediaSelected = (mediaId?: string) => {
    if (!mediaId) return false;
    return isMultiSelect
      ? selectedMediaArray.some((m) => m._id === mediaId)
      : selectedMedia?._id === mediaId;
  };

  const isMediaAlreadyInGallery = (mediaId?: string) => {
    if (!mediaId) return false;
    return galleryMediaIds.includes(mediaId);
  };

  // ─── Handler: toggle multi-select ──────────────────────────────────────────
  const handleMediaToggleMulti = (media: Media) => {
    setSelectedMediaArray((prev) => {
      const exists = prev.some((m) => m._id === media._id);
      return exists
        ? prev.filter((m) => m._id !== media._id)
        : [...prev, media];
    });
  };

  // ─── Handler: konfirmasi dari galeri ───────────────────────────────────────

  /**
   * Multi-select: langsung kirim semua gambar dengan default attribution.
   * Tidak ada dialog atribusi per-item (Opsi A).
   */
  const handleMultiSelectConfirm = () => {
    if (selectedMediaArray.length === 0) return;

    const result: MultiImagePickerResult = {
      selectedMediaArray: selectedMediaArray.map((media) => ({
        media,
        attribution: {
          caption: media.caption ?? "",
          credit: media.credit ?? "",
        },
      })),
    };

    onSelectMultiple?.(result);
    onClose();
  };

  /**
   * Single-select: buka attribution dialog dengan default dari media yang dipilih.
   */
  const handleSingleSelectConfirm = () => {
    if (!selectedMedia) return;

    setPendingResultMedia(selectedMedia);
    setAttributionDefaultCaption(selectedMedia.caption ?? "");
    setAttributionDefaultCredit(selectedMedia.credit ?? "");
    setAttributionOpen(true);
  };

  const handleGalleryConfirm = () => {
    if (isMultiSelect) {
      handleMultiSelectConfirm();
    } else {
      handleSingleSelectConfirm();
    }
  };

  // ─── Handler: alur upload ──────────────────────────────────────────────────

  /**
   * Fase 1: user memilih file dari dropzone.
   * Buka CropModal dengan blobUrl gambar asli.
   */
  const handleFileSelected = useCallback((blobUrl: string) => {
    setCropSrc(blobUrl);
    setCropOpen(true);
  }, []);

  /**
   * Setelah crop selesai: simpan blob hasil crop, tutup CropModal.
   * DraftImageUploadForm akan masuk ke fase 2 otomatis.
   */
  const handleCropDone = useCallback((blob: Blob) => {
    setCroppedBlob(blob);
    setCropOpen(false);
    // Revoke cropSrc karena sudah tidak diperlukan
    setCropSrc((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  const handleCropCancel = useCallback(() => {
    setCropOpen(false);
    // Revoke dan reset cropSrc agar dropzone kembali aktif
    setCropSrc((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  // Jika parent memaksa menutup picker (navigasi / unmount state), bersihkan crop
  // agar tidak tersisa modal orphan dengan blob URL basi.
  useEffect(() => {
    if (!open && cropOpen) {
      handleCropCancel();
    }
  }, [open, cropOpen, handleCropCancel]);

  /**
   * Fase 2: user selesai isi metadata, media siap.
   * Buka attribution dialog dengan default dari metadata media.
   */
  const handleMediaReady = useCallback((pendingMedia: PendingMedia) => {
    setPendingResultMedia(pendingMedia);
    setAttributionDefaultCaption(pendingMedia.caption ?? "");
    setAttributionDefaultCredit(pendingMedia.credit ?? "");
    setAttributionOpen(true);
  }, []);

  /**
   * Reset ke fase 1 (dropzone) — dipakai saat user klik X di preview fase 2.
   */
  const handleResetUpload = useCallback(() => {
    setCroppedBlob(null);
    setCropSrc(null);
    setPendingResultMedia(null);
  }, []);

  // ─── Handler: attribution dialog ──────────────────────────────────────────

  const handleAttributionConfirm = useCallback(
    (attribution: ArticleAttribution) => {
      if (!pendingResultMedia) return;

      onSelect?.({
        media: pendingResultMedia,
        articleAttribution: attribution,
      });

      setAttributionOpen(false);
      setPendingResultMedia(null);
      onClose();
    },
    [pendingResultMedia, onSelect, onClose],
  );

  const handleAttributionCancel = useCallback(() => {
    setAttributionOpen(false);
    // Biarkan pendingResultMedia — user bisa klik "Konfirmasi" lagi nanti
    // atau menutup modal utama untuk membatalkan sepenuhnya
  }, []);

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <Dialog open={open} onOpenChange={handlePickerOpenChange}>
        <DialogContent
          className="max-w-2xl w-full md:max-w-3xl flex flex-col overflow-hidden"
          style={{ maxHeight: "90vh" }}
          onPointerDownOutside={preventOutsideDismissWhileNested}
          onInteractOutside={preventOutsideDismissWhileNested}
          onFocusOutside={preventOutsideDismissWhileNested}
          onEscapeKeyDown={(event) => {
            // Escape harus menutup crop/atribusi dulu, bukan picker + revoke URL
            if (hasNestedOverlay) {
              event.preventDefault();
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>Pilih Gambar</DialogTitle>
          </DialogHeader>

          {/* Tab buttons */}
          <div className="flex border-b shrink-0 -mt-2">
            {(["upload", "gallery"] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${tab === t
                    ? "border-b-2 border-hijauSawah text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                  }`}
              >
                {t === "upload" ? (
                  <Upload className="h-4 w-4" />
                ) : (
                  <Images className="h-4 w-4" />
                )}
                {t === "upload" ? "Upload" : "Gallery"}
              </button>
            ))}
          </div>

          {/* Scrollable content area */}
          <div className="flex-1 overflow-y-auto min-h-0 py-2">
            {/* Tab Upload */}
            {tab === "upload" && (
              <DraftImageUploadForm
                croppedBlob={croppedBlob}
                onFileSelected={handleFileSelected}
                onMediaReady={handleMediaReady}
                onCancel={croppedBlob ? handleResetUpload : onClose}
              />
            )}

            {/* Tab Gallery */}
            {tab === "gallery" && (
              <div className="space-y-3">
                <InputGroup>
                  <InputGroupInput
                    placeholder="Cari gambar..."
                    value={gallerySearch}
                    onChange={(e) => setGallerySearch(e.target.value)}
                  />
                  <InputGroupAddon>
                    <SearchIcon />
                  </InputGroupAddon>
                </InputGroup>

                {galleryLoading && mediaList.length === 0 ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : mediaList.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-16">
                    {debouncedGallerySearch.trim()
                      ? "Tidak ada gambar yang cocok dengan pencarian."
                      : "Belum ada gambar di galeri."}
                  </p>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 items-start">
                      {mediaList.map((item) => {
                        const isSelected = isMediaSelected(item._id);
                        const isAlreadyInGallery = isMediaAlreadyInGallery(item._id);
                        const credit = item.credit?.trim();
                        const caption = item.caption?.trim();
                        return (
                          <button
                            key={item._id}
                            type="button"
                            onClick={() => {
                              if (isMultiSelect) {
                                if (!isAlreadyInGallery) {
                                  handleMediaToggleMulti(item);
                                }
                              } else {
                                setSelectedMedia(isSelected ? null : item);
                              }
                            }}
                            disabled={isAlreadyInGallery && !isMultiSelect}
                            className={`group text-left rounded-lg border overflow-hidden transition-all ${
                              isAlreadyInGallery
                                ? "border-destructive opacity-60 cursor-not-allowed"
                                : isSelected
                                  ? "border-hijauSawah ring-1 ring-hijauSawah"
                                  : "border-border hover:border-muted-foreground"
                            }`}
                            title={
                              isAlreadyInGallery
                                ? "Sudah ada di galeri"
                                : (caption || item.filename)
                            }
                          >
                            <div className="relative aspect-video bg-muted">
                              <img
                                src={`/api/media/view?key=${encodeURIComponent(item.filename)}`}
                                alt={caption || item.filename}
                                className="object-cover w-full h-full"
                                loading="lazy"
                              />
                              {isAlreadyInGallery && !isMultiSelect && (
                                <div className="absolute inset-0 bg-destructive/20 flex items-center justify-center">
                                  <X className="h-6 w-6 text-destructive drop-shadow" />
                                </div>
                              )}
                              {isSelected && (
                                <div className="absolute inset-0 bg-hijauSawah/20 flex items-center justify-center">
                                  <Check className="h-6 w-6 text-hijauSawah drop-shadow" />
                                </div>
                              )}
                              {isAlreadyInGallery && isMultiSelect && (
                                <div className="absolute inset-0 bg-destructive/20 flex items-end justify-end p-1">
                                  <AlertCircle className="h-4 w-4 text-destructive drop-shadow" />
                                </div>
                              )}
                            </div>
                            <div className="p-2.5 space-y-1">
                              <Badge variant="default" className="mb-1">
                                Image
                              </Badge>
                              {credit ? (
                                <p className="text-xs text-primary line-clamp-1">
                                  Credit: {credit}
                                </p>
                              ) : null}
                              {caption ? (
                                <p className="text-xs text-primary line-clamp-2">
                                  {caption}
                                </p>
                              ) : null}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {hasMore && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={handleLoadMore}
                        disabled={galleryLoading}
                      >
                        {galleryLoading && (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        )}
                        Muat lebih banyak
                      </Button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Footer — hanya untuk tab gallery */}
          {tab === "gallery" && (
            <div className="flex justify-end gap-2 pt-3 border-t shrink-0">
              <Button type="button" variant="outline" onClick={onClose}>
                Batal
              </Button>
              <Button
                type="button"
                onClick={handleGalleryConfirm}
                disabled={
                  isMultiSelect
                    ? selectedMediaArray.length === 0
                    : !selectedMedia
                }
              >
                {isMultiSelect
                  ? `Sisipkan (${selectedMediaArray.length})`
                  : "Sisipkan"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* CropModal — ditampilkan di atas ImagePickerModal */}
      <CropImageModal
        open={cropOpen && Boolean(cropSrc)}
        imageSrc={cropSrc ?? ""}
        aspect={cropForFeatured ? FEATURED_CROP_ASPECT : 16 / 9}
        outputWidth={cropForFeatured ? FEATURED_CROP_WIDTH : 1920}
        outputHeight={cropForFeatured ? FEATURED_CROP_HEIGHT : 1080}
        webpQuality={cropForFeatured ? FEATURED_WEBP_QUALITY : CONTENT_WEBP_QUALITY}
        title={
          cropForFeatured
            ? "Potong gambar unggulan (1280 × 800)"
            : "Potong gambar"
        }
        onCrop={handleCropDone}
        onCancel={handleCropCancel}
      />

      {/* Attribution Dialog — muncul setelah crop/media siap */}
      <ArticleAttributionDialog
        open={attributionOpen}
        title={attributionDialogTitle}
        defaultCaption={attributionDefaultCaption}
        defaultCredit={attributionDefaultCredit}
        onConfirm={handleAttributionConfirm}
        onCancel={handleAttributionCancel}
      />
    </>
  );
}
