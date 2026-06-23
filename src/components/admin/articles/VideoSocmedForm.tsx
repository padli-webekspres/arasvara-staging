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
import api from "@/lib/axios";
import CropImageModal from "@/components/media/CropImageModal";
import VideoFormCard from "./VideoFormCard";
import Image from "next/image";
import { SectionVideoItem } from "@/types/articleSection";
import {
  getAdminCardGridClass,
  getCropOutputSize,
  getSocmedAspectLabel,
  getSocmedCropAspect,
  getSocmedLayout,
  getSocmedVideoAspectClass,
  type SocmedPlatform,
} from "@/lib/socmed-video-layout";

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

  // ── State: Edit Mode ──────────────────────────────────────────────────
  const [editingId, setEditingId] = useState<string | null>(null);

  // ── State: Save Loading ───────────────────────────────────────────────
  const [isSaving, setIsSaving] = useState(false);

  // ── Effect: Load initial data ────────────────────────────────────────
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setLoading(true);

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
                  thumbnail_url: URL.createObjectURL(blob),
                };
              }
              return item;
            }),
          );

          console.log("Loaded items with thumbnails:", itemsWithThumbnails);

          setVideoItems(itemsWithThumbnails);
        }
      } catch (error) {
        console.error("Error loading initial data:", error);
        toast.error("Gagal memuat data video");
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, [mode, socialPlatform, existingItems]);

  // ── Effect: Revoke preview URLs on unmount ─────────────────────────
  useEffect(() => {
    return () => {
      if (thumbnailPreview) URL.revokeObjectURL(thumbnailPreview);
      if (rawImageSrc) URL.revokeObjectURL(rawImageSrc);
      videoItems.forEach((item) => {
        if (item.thumbnail_url?.startsWith("blob:")) {
          URL.revokeObjectURL(item.thumbnail_url);
        }
      });
    };
  }, []);

  // ── Dropzone for thumbnail upload ─────────────────────────────────
  const onDrop = useCallback((files: File[]) => {
    if (!files.length) return;
    const file = files[0];

    // Validate file is image
    if (!file.type.startsWith("image/")) {
      toast.error("Hanya file gambar yang diizinkan");
      return;
    }

    setRawImageSrc(URL.createObjectURL(file));
    setCropOpen(true);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [] },
    maxFiles: 1,
    multiple: false,
  });

  // ── Handle crop complete and save blob locally ──────────────────────
  const handleCropDone = useCallback(
    async (blob: Blob) => {
      setCropOpen(false);

      // Revoke previous preview
      if (thumbnailPreview) URL.revokeObjectURL(thumbnailPreview);
      if (rawImageSrc) URL.revokeObjectURL(rawImageSrc);

      setRawImageSrc(null);
      setThumbnailBlob(blob);
      setThumbnailPreview(URL.createObjectURL(blob));

      toast.success("Gambar berhasil di-crop");
    },
    [thumbnailPreview, rawImageSrc],
  );

  const handleCropCancel = useCallback(() => {
    setCropOpen(false);
    if (rawImageSrc) URL.revokeObjectURL(rawImageSrc);
    setRawImageSrc(null);
  }, [rawImageSrc]);

  // ── Handle remove thumbnail ───────────────────────────────────────
  const handleRemoveThumbnail = useCallback(() => {
    if (thumbnailPreview) URL.revokeObjectURL(thumbnailPreview);
    setThumbnailBlob(null);
    setThumbnailPreview(null);
    toast.info("Gambar dihapus");
  }, [thumbnailPreview]);

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
            if (item.thumbnail_url && item.thumbnail_url.startsWith("blob:")) {
              URL.revokeObjectURL(item.thumbnail_url);
            }
            const newthumbnail_url = URL.createObjectURL(thumbnailBlob);
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
        const newthumbnail_url = URL.createObjectURL(thumbnailBlob);

        const newItem: SectionVideoItem = {
          _id: newId,
          video_url: formData.url,
          title: formData.title,
          order: videoItems.length,
          thumbnail_url: newthumbnail_url,
          type: isCombined ? selectedType : socialPlatform,
          createdAt: new Date(),
          createdBy: "local",
        };

        // Save blob to IndexedDB
        await idbSet(getIdbKey(mode, socialPlatform, newId), thumbnailBlob);

        const updatedItems = [...videoItems, newItem];
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
    if (item.thumbnail_url) {
      setThumbnailPreview(item.thumbnail_url);
    }

    const blob = await idbGet<Blob>(
      getIdbKey(mode, socialPlatform, item._id),
    );
    if (blob) {
      setThumbnailBlob(blob);
    }

    // Scroll to form
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ── Handle remove card ────────────────────────────────────────────
  const handleRemoveCard = async (id: string) => {
    try {
      const itemToRemove = videoItems.find((item) => item._id === id);

      // Revoke blob preview URL
      if (itemToRemove?.thumbnail_url) {
        URL.revokeObjectURL(itemToRemove.thumbnail_url);
      }

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
        setEditingId(null);
        setFormData({ url: "", title: "" });
        setThumbnailBlob(null);
        setThumbnailPreview(null);
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
            if (blob) {
              const uploadPlatform =
                isCombined &&
                (item.type === "tiktok" || item.type === "instagram")
                  ? item.type
                  : socialPlatform;
              const formData = new FormData();
              formData.append("file", blob, "thumbnail.webp");
              const response = await api.post<{
                url: string;
                filename: string;
              }>(
                `/articles/socmed/${uploadPlatform}/upload-thumbnail`,
                formData,
                { headers: { "Content-Type": "multipart/form-data" } },
              );
              if (!response.data?.url) {
                throw new Error(`Failed to upload thumbnail for ${item.title}`);
              }
              return { ...item, thumbnail_url: response.data.url };
            }
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
      toast.error("Gagal menyimpan video ke backend");
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
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:max-h-screen lg:min-h-0">
        {/* ── LEFT: Grid Cards & Sorting ────────────────────────────────*/}
        <div className="order-2 lg:order-1 lg:col-span-2 flex flex-col overflow-hidden rounded-lg border border-border bg-card p-4">
          <div className="mb-4 flex flex-col justify-between gap-2 lg:flex-row lg:items-center">
            <h3 className="text-lg font-semibold">Daftar Video</h3>
            <p className="text-sm font-light text-muted-foreground">
              {videoItems.length} video ditambahkan
            </p>
          </div>

          {/* Video Items Grid */}
          <div className="flex-1 overflow-y-auto pr-2">
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
        <div className="order-1 lg:order-2 flex flex-col overflow-y-auto rounded-lg border border-border bg-card p-4">
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
                    isDragActive
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50 hover:bg-muted/30"
                  }`}
                >
                  <input {...getInputProps()} />
                  <p className="text-sm font-medium">
                    Drag & drop gambar di sini atau klik untuk memilih
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    PNG, JPG, WEBP — rasio {aspectLabel}
                  </p>
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
                onClick={() => {
                  setEditingId(null);
                  setFormData({ url: "", title: "" });
                  setThumbnailBlob(null);
                  setThumbnailPreview(null);
                }}
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
