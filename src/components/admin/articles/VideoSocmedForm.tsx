"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { DragDropProvider } from "@dnd-kit/react";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import { get as idbGet, set as idbSet, del as idbDel } from "idb-keyval";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Save, Plus, Loader2 } from "lucide-react";
import { isAxiosError } from "axios";
import api from "@/lib/axios";
import CropImageModal from "@/components/media/CropImageModal";
import VideoFormCard from "./VideoFormCard";
import Image from "next/image";
import { SectionVideoItem } from "@/types/articleSection";
import { ensureWebpFile } from "@/lib/image/ensureWebpBlob";
import { prepareImageForCrop } from "@/lib/image/prepareImageForCrop";
import {
  getAdminCardGridClass,
  getCropOutputSize,
  getSocmedAspectLabel,
  getSocmedCropAspect,
  getSocmedLayout,
  getSocmedVideoAspectClass,
  type SocmedPlatform,
} from "@/lib/socmed-video-layout";

const THUMBNAIL_UPLOAD_TIMEOUT_MS = 60_000;

/** Map error simpan/upload ke pesan yang mudah dipahami orang awam. */
function getFriendlySaveErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.message.startsWith("THUMBNAIL_BLOB_MISSING:")) {
      return "Sebagian thumbnail draft lokal hilang. Unggah ulang thumbnail sebelum menyimpan.";
    }
    if (error.message.startsWith("UPLOAD_FAILED:")) {
      return "Upload thumbnail gagal. Coba simpan lagi.";
    }
  }

  if (isAxiosError(error)) {
    if (error.code === "ECONNABORTED" || error.message.includes("timeout")) {
      return "Koneksi lambat. Coba simpan lagi.";
    }

    const status = error.response?.status;
    const data = error.response?.data as
      | { error?: string; details?: string }
      | undefined;
    const apiError = typeof data?.error === "string" ? data.error : "";
    const apiDetails =
      typeof data?.details === "string" ? data.details : "";
    const combined = `${apiError} ${apiDetails}`.toLowerCase();

    if (status === 401 || combined.includes("unauthorized")) {
      return "Sesi login berakhir. Silakan login ulang.";
    }
    if (
      combined.includes("file harus berupa gambar") ||
      combined.includes("bukan gambar")
    ) {
      return "Thumbnail tidak dikenali sebagai gambar. Unggah ulang thumbnail.";
    }
    if (
      combined.includes("file is required") ||
      combined.includes("file required")
    ) {
      return "Upload gagal terkirim. Coba lagi.";
    }
    if (apiDetails) {
      return `Gagal menyimpan: ${apiDetails}`;
    }
    if (apiError && apiError !== "Upload failed" && apiError !== "Upsert failed") {
      return `Gagal menyimpan: ${apiError}`;
    }
  }

  if (error instanceof Error && error.message) {
    return `Gagal menyimpan: ${error.message}`;
  }

  return "Gagal menyimpan video. Coba lagi.";
}

// ── Type Definitions ──────────────────────────────────────────────────────
type SocialPlatform = SocmedPlatform;
type CombinedPlatform = "tiktok" | "instagram";
type FormMode = "platform" | "combined";

interface VideoSocmedFormProps {
  mode?: FormMode;
  socialPlatform?: SocialPlatform;
  customTitle?: string;
  existingItems?: SectionVideoItem[];
  onSave?: (items: SectionVideoItem[]) => Promise<void> | void;
}

// ── Constants ─────────────────────────────────────────────────────────────
const COMBINED_STORAGE_SCOPE = "combined";

const getStorageKey = (mode: FormMode, platform?: SocialPlatform) =>
  mode === "combined"
    ? `videoSocmed_${COMBINED_STORAGE_SCOPE}_items`
    : `videoSocmed_${platform}_items`;

const getIdbKey = (mode: FormMode, platform: SocialPlatform | undefined, id: string) =>
  mode === "combined"
    ? `videoSocmed_${COMBINED_STORAGE_SCOPE}_thumbnail_${id}`
    : `videoSocmed_${platform}_thumbnail_${id}`;

// ── Component ─────────────────────────────────────────────────────────────
export default function VideoSocmedForm({
  mode = "platform",
  socialPlatform = "youtube",
  customTitle,
  existingItems = [],
  onSave,
}: VideoSocmedFormProps) {
  const isCombined = mode === "combined";
  const layoutPlatform: SocmedPlatform = isCombined ? "tiktok" : socialPlatform;
  const activeBlobUrlsRef = useRef(new Set<string>());

  const isBlobUrl = useCallback((url: string | null | undefined) => {
    return typeof url === "string" && url.startsWith("blob:");
  }, []);

  const trackBlobUrl = useCallback(
    (url: string | null | undefined): string | null => {
      const blobUrl =
        typeof url === "string" && url.startsWith("blob:") ? url : null;
      if (!blobUrl) return url ?? null;
      activeBlobUrlsRef.current.add(blobUrl);
      return blobUrl;
    },
    [],
  );

  const revokeBlobUrl = useCallback(
    (url: string | null | undefined) => {
      const blobUrl =
        typeof url === "string" && url.startsWith("blob:") ? url : null;
      if (!blobUrl) return;
      try {
        URL.revokeObjectURL(blobUrl);
      } finally {
        activeBlobUrlsRef.current.delete(blobUrl);
      }
    },
    [],
  );

  const clearAllTrackedBlobUrls = useCallback(() => {
    activeBlobUrlsRef.current.forEach((url) => {
      URL.revokeObjectURL(url);
    });
    activeBlobUrlsRef.current.clear();
  }, []);
  // ── State: Video Items ────────────────────────────────────────────────
  const [videoItems, setVideoItems] = useState<SectionVideoItem[]>([]);
  const [loading, setLoading] = useState(true);

  // ── State: Form Input ─────────────────────────────────────────────────
  const [formData, setFormData] = useState({
    url: "",
    title: "",
  });
  const [selectedType, setSelectedType] = useState<CombinedPlatform>("tiktok");

  // ── State: Thumbnail Upload ───────────────────────────────────────────
  const [thumbnailBlob, setThumbnailBlob] = useState<Blob | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [preparingCrop, setPreparingCrop] = useState(false);

  // ── State: Edit Mode ──────────────────────────────────────────────────
  const [editingId, setEditingId] = useState<string | null>(null);

  // ── State: Save Loading ───────────────────────────────────────────────
  const [isSaving, setIsSaving] = useState(false);

  const resetEditorState = useCallback(() => {
    setEditingId(null);
    setFormData({ url: "", title: "" });
    setThumbnailBlob(null);
    setThumbnailPreview((prev) => {
      revokeBlobUrl(prev);
      return null;
    });
    setRawImageSrc((prev) => {
      revokeBlobUrl(prev);
      return null;
    });
  }, [revokeBlobUrl]);

  // ── Effect: Load initial data ────────────────────────────────────────
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setLoading(true);
        clearAllTrackedBlobUrls();

        // Prefer backend data from parent (over local draft)
        if (existingItems.length > 0) {
          setVideoItems(existingItems);
          setLoading(false);
          return;
        }

        // Otherwise, load from localStorage
        const stored = localStorage.getItem(getStorageKey(mode, socialPlatform));
        if (stored) {
          const parsedItems = JSON.parse(stored) as SectionVideoItem[];
          let missingThumbnailCount = 0;

          // Load thumbnails from IndexedDB
          const itemsWithThumbnails = await Promise.all(
            parsedItems.map(async (item) => {
              const blob = item._id
                ? await idbGet<Blob>(
                    getIdbKey(mode, socialPlatform, item._id),
                  )
                : undefined;
              if (blob) {
                return {
                  ...item,
                  thumbnail_url: trackBlobUrl(URL.createObjectURL(blob)) ?? "",
                };
              }
              if (item.thumbnail_url) {
                missingThumbnailCount += 1;
              }
              const { thumbnail_url, ...rest } = item;
              return rest as SectionVideoItem;
            }),
          );

          setVideoItems(itemsWithThumbnails);
          if (missingThumbnailCount > 0) {
            toast.warning(
              `${missingThumbnailCount} thumbnail draft tidak ditemukan lagi di penyimpanan lokal.`,
            );
          }
        }
      } catch (error) {
        console.error("Error loading initial data:", error);
        toast.error("Gagal memuat data video");
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, [clearAllTrackedBlobUrls, existingItems, mode, socialPlatform, trackBlobUrl]);

  // ── Effect: Revoke preview URLs on unmount ─────────────────────────
  useEffect(() => {
    return () => {
      clearAllTrackedBlobUrls();
    };
  }, [clearAllTrackedBlobUrls]);

  // ── Dropzone for thumbnail upload ─────────────────────────────────
  const onDrop = useCallback(
    async (files: File[]) => {
      if (!files.length || preparingCrop) return;
      const file = files[0];

      // Kosongkan type masih diizinkan (Safari/iOS sering kirim type "");
      // HEIC/HEIF juga lolos lewat prepareImageForCrop.
      if (file.type && !file.type.startsWith("image/")) {
        toast.error("Hanya file gambar yang diizinkan");
        return;
      }

      setPreparingCrop(true);
      try {
        const objectUrl = await prepareImageForCrop(file);
        setRawImageSrc((prev) => {
          revokeBlobUrl(prev);
          return trackBlobUrl(objectUrl);
        });
        setCropOpen(true);
      } catch {
        toast.error(
          "Gambar tidak dapat dimuat. Coba lagi atau gunakan format JPEG/PNG/WebP.",
        );
      } finally {
        setPreparingCrop(false);
      }
    },
    [preparingCrop, revokeBlobUrl, trackBlobUrl],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [] },
    maxFiles: 1,
    multiple: false,
    disabled: preparingCrop || thumbnailBlob !== null,
  });

  // ── Handle crop complete and save blob locally ──────────────────────
  const handleCropDone = useCallback(
    async (blob: Blob) => {
      setCropOpen(false);

      // Revoke previous preview
      revokeBlobUrl(thumbnailPreview);
      revokeBlobUrl(rawImageSrc);

      setRawImageSrc(null);
      setThumbnailBlob(blob);
      setThumbnailPreview(trackBlobUrl(URL.createObjectURL(blob)));

      toast.success("Gambar berhasil di-crop");
    },
    [rawImageSrc, revokeBlobUrl, thumbnailPreview, trackBlobUrl],
  );

  const handleCropCancel = useCallback(() => {
    setCropOpen(false);
    revokeBlobUrl(rawImageSrc);
    setRawImageSrc(null);
  }, [rawImageSrc, revokeBlobUrl]);

  // ── Handle remove thumbnail ───────────────────────────────────────
  const handleRemoveThumbnail = useCallback(() => {
    revokeBlobUrl(thumbnailPreview);
    setThumbnailBlob(null);
    setThumbnailPreview(null);
    toast.info("Gambar dihapus");
  }, [revokeBlobUrl, thumbnailPreview]);

  // ── Handle form input change ──────────────────────────────────────
  const handleFormChange = (field: "url" | "title", value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // ── Handle add/update video item ──────────────────────────────────
  const handleAddOrUpdate = async () => {
    // Validate
    if (!formData.url.trim()) {
      toast.error("URL video tidak boleh kosong");
      return;
    }

    if (!formData.title.trim()) {
      toast.error("Judul tidak boleh kosong");
      return;
    }

    if (!thumbnailBlob) {
      toast.error("Thumbnail harus diunggah");
      return;
    }

    try {
      if (editingId) {
        // Update existing item
        const updatedItems = videoItems.map((item) => {
          if (item._id === editingId) {
            // Revoke old blob URL if it's a blob URL (not server URL)
            revokeBlobUrl(item.thumbnail_url);
            const newthumbnail_url =
              trackBlobUrl(URL.createObjectURL(thumbnailBlob)) ?? "";
            return {
              ...item,
              video_url: formData.url,
              title: formData.title,
              thumbnail_url: newthumbnail_url,
              ...(isCombined ? { type: selectedType } : {}),
            };
          }
          return item;
        });

        // Save blob to IndexedDB
        await idbSet(
          getIdbKey(mode, socialPlatform, editingId),
          thumbnailBlob,
        );

        setVideoItems(updatedItems);
        saveToLocalStorage(updatedItems);

        toast.success("Video berhasil diperbarui");
        setEditingId(null);
      } else {
        // Create new item
        const newId = uuidv4();
        const newthumbnail_url =
          trackBlobUrl(URL.createObjectURL(thumbnailBlob)) ?? "";

        const newItem: SectionVideoItem = {
          _id: newId,
          video_url: formData.url,
          title: formData.title,
          order: 0,
          thumbnail_url: newthumbnail_url,
          type: isCombined ? selectedType : socialPlatform,
          createdAt: new Date(),
          createdBy: "local",
        };

        // Save blob to IndexedDB
        await idbSet(getIdbKey(mode, socialPlatform, newId), thumbnailBlob);

        // Video baru di urutan pertama; reindex order agar konsisten dengan array
        const updatedItems = [newItem, ...videoItems].map((item, idx) => ({
          ...item,
          order: idx,
        }));
        setVideoItems(updatedItems);
        saveToLocalStorage(updatedItems);

        toast.success("Video berhasil ditambahkan");
      }

      // Reset form
      setFormData({ url: "", title: "" });
      setThumbnailBlob(null);
      setThumbnailPreview(null);
    } catch (error) {
      console.error("Error adding/updating video:", error);
      toast.error("Gagal menyimpan video ke storage");
    }
  };

  // ── Handle edit card ──────────────────────────────────────────────
  const handleEditCard = async (item: SectionVideoItem) => {
    if (!item._id) return;
    setEditingId(item._id);
    setFormData({ url: item.video_url, title: item.title });
    if (isCombined && (item.type === "tiktok" || item.type === "instagram")) {
      setSelectedType(item.type);
    }

    // Load thumbnail from IndexedDB
    setThumbnailPreview((prev) => {
      if (prev !== item.thumbnail_url) revokeBlobUrl(prev);
      return item.thumbnail_url ?? null;
    });

    const blob = await idbGet<Blob>(
      getIdbKey(mode, socialPlatform, item._id),
    );
    if (blob) {
      setThumbnailBlob(blob);
    } else {
      setThumbnailBlob(null);
      if (isBlobUrl(item.thumbnail_url)) {
        setThumbnailPreview(null);
      }
      toast.warning(
        "Thumbnail draft lokal untuk item ini tidak ditemukan. Silakan unggah ulang jika ingin menggantinya.",
      );
    }

    // Scroll to form
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ── Handle remove card ────────────────────────────────────────────
  const handleRemoveCard = async (id: string) => {
    try {
      const itemToRemove = videoItems.find((item) => item._id === id);

      // Revoke blob preview URL
      revokeBlobUrl(itemToRemove?.thumbnail_url);

      // Delete from IndexedDB
      await idbDel(getIdbKey(mode, socialPlatform, id));

      // Update state
      const updatedItems = videoItems
        .filter((item) => item._id !== id)
        .map((item, index) => ({ ...item, order: index }));

      setVideoItems(updatedItems);
      saveToLocalStorage(updatedItems);

      // Reset editing if this was the item being edited
      if (editingId === id) {
        resetEditorState();
      }

      toast.success("Video berhasil dihapus");
    } catch (error) {
      console.error("Error removing video:", error);
      toast.error("Gagal menghapus video");
    }
  };

  // ── Handle drag and drop sorting ──────────────────────────────────
  const handleDragEnd = (event: any) => {
    if (event.canceled) return;
    const { source } = event.operation;

    if (source && "sortable" in source) {
      const { initialIndex, index } = source.sortable;

      if (initialIndex !== index) {
        const newItems = [...videoItems];
        const [movedItem] = newItems.splice(initialIndex, 1);
        newItems.splice(index, 0, movedItem);

        // Update order field
        const updatedItems = newItems.map((item, idx) => ({
          ...item,
          order: idx,
        }));

        setVideoItems(updatedItems);
        saveToLocalStorage(updatedItems);

        toast.success("Urutan video berhasil diperbarui");
      }
    }
  };

  // ── Save to localStorage ──────────────────────────────────────────
  const saveToLocalStorage = (items: SectionVideoItem[]) => {
    try {
      const itemsToStore = items.map(({ thumbnail_url, ...rest }) => rest);
      localStorage.setItem(
        getStorageKey(mode, socialPlatform),
        JSON.stringify(itemsToStore),
      );
    } catch (error) {
      console.error("Error saving to localStorage:", error);
      toast.error("Gagal menyimpan ke storage lokal");
    }
  };

  // ── Handle save to backend ────────────────────────────────────────
  const handleSaveToBackend = async () => {
    if (videoItems.length === 0) {
      toast.error("Tambahkan minimal 1 video sebelum menyimpan");
      return;
    }

    try {
      setIsSaving(true);
      toast.info("Menyimpan video ke backend...");

      // Step 1: Upload blobs to platform-specific folder and collect URLs
      const itemsWithUrls = await Promise.all(
        videoItems.map(async (item) => {
          if (
            item.thumbnail_url &&
            item.thumbnail_url.startsWith("blob:") &&
            item._id
          ) {
            const blob = await idbGet<Blob>(
              getIdbKey(mode, socialPlatform, item._id),
            );
            if (!blob) {
              throw new Error(
                `THUMBNAIL_BLOB_MISSING:${item.title || item._id}`,
              );
            }
            const uploadPlatform =
              isCombined &&
              (item.type === "tiktok" || item.type === "instagram")
                ? item.type
                : socialPlatform;
            // Normalisasi MIME/ekstensi (Safari IndexedDB sering kosongkan type)
            const file = await ensureWebpFile(blob);
            const formData = new FormData();
            formData.append("file", file);
            const response = await api.post<{
              url: string;
              filename: string;
            }>(
              `/articles/socmed/${uploadPlatform}/upload-thumbnail`,
              formData,
              // Jangan set Content-Type manual — biarkan browser isi boundary
              { timeout: THUMBNAIL_UPLOAD_TIMEOUT_MS },
            );
            if (!response.data?.url) {
              throw new Error(`UPLOAD_FAILED:${item.title}`);
            }
            return { ...item, thumbnail_url: response.data.url };
          }
          return item;
        }),
      );

      if (onSave) {
        await onSave(itemsWithUrls);
      }

      toast.success("Video berhasil disimpan!");
    } catch (error) {
      console.error("Error saving to backend:", error);
      toast.error(getFriendlySaveErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  const layout = getSocmedLayout(layoutPlatform);
  const cropAspect = getSocmedCropAspect(layout);
  const aspectLabel = getSocmedAspectLabel(layout);
  const thumbnailAspectClass = getSocmedVideoAspectClass(layout);
  const cardGridClass = getAdminCardGridClass(layout);
  const { width: cropOutputWidth, height: cropOutputHeight } =
    getCropOutputSize(layout);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-6 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <h1 className="text-2xl font-bold capitalize">
          {customTitle ||
            (isCombined ? "Feed Socmed" : `Video ${socialPlatform}`)}
        </h1>
        <Button
          onClick={handleSaveToBackend}
          disabled={isSaving || videoItems.length === 0}
          size="lg"
        >
          <Save className="mr-2 h-4 w-4" />
          {isSaving ? "Menyimpan..." : "Simpan Perubahan"}
        </Button>
      </div>

      {/* Main Layout: Grid (Left) + Sidebar Form (Right) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:min-h-0 lg:items-start">
        {/* ── LEFT: Grid Cards & Sorting ────────────────────────────────*/}
        <div className="order-2 lg:order-1 lg:col-span-2 flex flex-col overflow-hidden rounded-lg border border-border bg-card p-4 lg:max-h-[calc(100dvh-11rem)]">
          <div className="mb-4 flex flex-col justify-between gap-2 lg:flex-row lg:items-center">
            <h3 className="text-lg font-semibold">Daftar Video</h3>
            <p className="text-sm font-light text-muted-foreground">
              {videoItems.length} video ditambahkan
            </p>
          </div>

          {/* Video Items Grid */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-2 [-webkit-overflow-scrolling:touch]">
            {videoItems.length === 0 ? (
              <div className="flex h-full items-center justify-center rounded-lg border-2 border-dashed border-border">
                <p className="text-muted-foreground">
                  Belum ada video yang ditambahkan
                </p>
              </div>
            ) : (
              <DragDropProvider onDragEnd={handleDragEnd}>
                <div className={cardGridClass}>
                  {videoItems.map((item, index) => (
                    <VideoFormCard
                      key={item._id}
                      item={item}
                      index={index}
                      onEdit={handleEditCard}
                      onRemove={handleRemoveCard}
                      thumbnailAspectClass={thumbnailAspectClass}
                      showPlatformBadge={isCombined}
                    />
                  ))}
                </div>
              </DragDropProvider>
            )}
          </div>
        </div>

        {/* ── RIGHT: Form Input Sidebar ─────────────────────────────────*/}
        <div className="order-1 lg:order-2 flex flex-col rounded-lg border border-border bg-card p-4 lg:max-h-[calc(100dvh-11rem)] lg:overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]">
          <h3 className="mb-4 text-lg font-semibold">
            {editingId ? "Edit Video" : "Tambah Video"}
          </h3>

          {/* Form Fields */}
          <div className="space-y-4">
            {isCombined && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  Platform <span className="text-destructive">*</span>
                </label>
                <Select
                  value={selectedType}
                  onValueChange={(value) =>
                    setSelectedType(value as CombinedPlatform)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Pilih platform" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tiktok">TikTok</SelectItem>
                    <SelectItem value="instagram">Instagram</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* URL Input */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Video URL <span className="text-destructive">*</span>
              </label>
              <Input
                type="url"
                placeholder="https://example.com/video"
                value={formData.url}
                onChange={(e) => handleFormChange("url", e.target.value)}
              />
            </div>

            {/* Title Input */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Judul <span className="text-destructive">*</span>
              </label>
              <Input
                type="text"
                placeholder="Masukkan judul video"
                value={formData.title}
                onChange={(e) => handleFormChange("title", e.target.value)}
              />
            </div>

            {/* Thumbnail Upload Area */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Thumbnail <span className="text-destructive">*</span>
              </label>

              {thumbnailPreview ? (
                <div className="space-y-2">
                  <div
                    className={`relative overflow-hidden rounded-lg bg-muted ${thumbnailAspectClass}`}
                  >
                    <Image
                      src={thumbnailPreview}
                      alt="Thumbnail preview"
                      className="h-full w-full object-cover"
                      width={400}
                      height={500}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full text-destructive hover:text-destructive"
                    onClick={handleRemoveThumbnail}
                  >
                    Hapus Gambar
                  </Button>
                </div>
              ) : (
                <div
                  {...getRootProps()}
                  className={`cursor-pointer select-none rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors ${
                    preparingCrop
                      ? "pointer-events-none border-border opacity-60"
                      : isDragActive
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50 hover:bg-muted/30"
                  }`}
                >
                  <input {...getInputProps()} />
                  {preparingCrop ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      <p className="text-sm font-medium">
                        Menyiapkan gambar...
                      </p>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm font-medium">
                        Drag & drop gambar di sini atau klik untuk memilih
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        PNG, JPG, WEBP, HEIC — rasio {aspectLabel}
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Add/Update Button */}
            <Button
              onClick={handleAddOrUpdate}
              className="w-full"
              disabled={!formData.url || !formData.title || !thumbnailBlob}
            >
              <Plus className="mr-2 h-4 w-4" />
              {editingId ? "Perbarui Video" : "Tambahkan Video"}
            </Button>

            {/* Cancel Edit Button */}
            {editingId && (
              <Button
                variant="outline"
                className="w-full"
                onClick={resetEditorState}
              >
                Batal Edit
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Crop Modal */}
      {rawImageSrc && (
        <CropImageModal
          open={cropOpen}
          imageSrc={rawImageSrc}
          aspect={cropAspect}
          layout={layout}
          outputWidth={cropOutputWidth}
          outputHeight={cropOutputHeight}
          title={`Crop Thumbnail (${customTitle || (isCombined ? "Socmed" : socialPlatform)}) — ${aspectLabel}`}
          onCrop={handleCropDone}
          onCancel={handleCropCancel}
        />
      )}
    </div>
  );
}
