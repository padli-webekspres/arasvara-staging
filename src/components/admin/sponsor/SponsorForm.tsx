"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { DragDropProvider } from "@dnd-kit/react";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import { get as idbGet, set as idbSet, del as idbDel } from "idb-keyval";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Save, Plus, Loader2 } from "lucide-react";
import api from "@/lib/axios";
import CropImageModal from "@/components/media/CropImageModal";
import SponsorFormCard from "./SponsorFormCard";
import Image from "next/image";
import { SponsorItem } from "@/types/sponsor";
import { shouldUnoptimizeNewsCardImage } from "@/lib/utils";
import { getAdminStandardCardGridClass } from "@/lib/admin-card-grid";

interface SponsorFormProps {
  existingItems?: SponsorItem[]; // Load existing items on mount
  onSave?: (items: SponsorItem[]) => Promise<void> | void; // Callback when save is clicked
}

// ── Constants ─────────────────────────────────────────────────────────────
const STORAGE_KEY = `sponsor_items`;
const getIdbKey = (id: string) => `sponsor_image_${id}`;

export default function SponsorForm({
  existingItems = [],
  onSave,
}: SponsorFormProps) {
  // ── State: Items ────────────────────────────────────────────────
  const [items, setItems] = useState<SponsorItem[]>([]);
  const [loading, setLoading] = useState(true);

  // ── State: Form Input ─────────────────────────────────────────────────
  const [formData, setFormData] = useState({
    name: "",
  });

  // ── State: Image Upload ───────────────────────────────────────────
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
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

        // If existingItems provided, use those (from backend/parent)
        if (existingItems.length > 0) {
          setItems(existingItems);
          return;
        }

        // Otherwise, load from localStorage
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsedItems = JSON.parse(stored) as SponsorItem[];

          // Load images from IndexedDB
          const itemsWithImages = await Promise.all(
            parsedItems.map(async (item) => {
              const blob = item._id
                ? await idbGet<Blob>(getIdbKey(item._id))
                : undefined;
              if (blob) {
                return {
                  ...item,
                  image_url: URL.createObjectURL(blob),
                };
              }
              return item;
            }),
          );

          setItems(itemsWithImages);
        }
      } catch (error) {
        console.error("Error loading initial data:", error);
        toast.error("Gagal memuat data sponsor");
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, [existingItems]);

  // ── Effect: Revoke preview URLs on unmount ─────────────────────────
  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
      if (rawImageSrc) URL.revokeObjectURL(rawImageSrc);
      items.forEach((item) => {
        if (item.image_url && item.image_url.startsWith("blob:"))
          URL.revokeObjectURL(item.image_url);
      });
    };
  }, []);

  // ── Dropzone for image upload ─────────────────────────────────
  const onDrop = useCallback((files: File[]) => {
    if (!files.length) return;
    const file = files[0];

    // Validate file is image
    if (!file.type.startsWith("image/")) {
      toast.error("Hanya file gambar yang diizinkan");
      return;
    }

    // We skip cropping for sponsors, or we can use a wide crop (e.g., 16:9 or free). Let's use free aspect ratio (0) or skip crop altogether to allow any size logo.
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

      if (imagePreview) URL.revokeObjectURL(imagePreview);
      if (rawImageSrc) URL.revokeObjectURL(rawImageSrc);

      setRawImageSrc(null);
      setImageBlob(blob);
      setImagePreview(URL.createObjectURL(blob));

      toast.success("Gambar berhasil disiapkan");
    },
    [imagePreview, rawImageSrc],
  );

  const handleCropCancel = useCallback(() => {
    setCropOpen(false);
    if (rawImageSrc) URL.revokeObjectURL(rawImageSrc);
    setRawImageSrc(null);
  }, [rawImageSrc]);

  // ── Handle remove image ───────────────────────────────────────
  const handleRemoveImage = useCallback(() => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageBlob(null);
    setImagePreview(null);
    toast.info("Gambar dihapus");
  }, [imagePreview]);

  // ── Handle form input change ──────────────────────────────────────
  const handleFormChange = (field: "name", value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // ── Handle add/update item ──────────────────────────────────
  const handleAddOrUpdate = async () => {
    // Validate
    if (!formData.name.trim()) {
      toast.error("Nama sponsor tidak boleh kosong");
      return;
    }

    if (!imageBlob && !imagePreview) {
      toast.error("Gambar harus diunggah");
      return;
    }

    try {
      if (editingId) {
        // Update existing item
        const updatedItems = items.map((item) => {
          if (item._id === editingId) {
            // Revoke old blob URL if it's a blob URL
            if (
              item.image_url &&
              item.image_url.startsWith("blob:") &&
              imageBlob
            ) {
              URL.revokeObjectURL(item.image_url);
            }
            const newImageUrl = imageBlob
              ? URL.createObjectURL(imageBlob)
              : item.image_url;
            return {
              ...item,
              name: formData.name,
              image_url: newImageUrl,
            };
          }
          return item;
        });

        // Save blob to IndexedDB
        if (imageBlob) {
          await idbSet(getIdbKey(editingId), imageBlob);
        }

        setItems(updatedItems);
        saveToLocalStorage(updatedItems);

        toast.success("Sponsor berhasil diperbarui");
        setEditingId(null);
      } else {
        // Create new item
        const newId = uuidv4();
        const newImageUrl = URL.createObjectURL(imageBlob!);

        const newItem: SponsorItem = {
          _id: newId,
          name: formData.name,
          order: items.length,
          image_url: newImageUrl,
          createdAt: new Date(),
          createdBy: "local",
        };

        // Save blob to IndexedDB
        await idbSet(getIdbKey(newId), imageBlob);

        const updatedItems = [...items, newItem];
        setItems(updatedItems);
        saveToLocalStorage(updatedItems);

        toast.success("Sponsor berhasil ditambahkan");
      }

      // Reset form
      setFormData({ name: "" });
      setImageBlob(null);
      setImagePreview(null);
    } catch (error) {
      console.error("Error adding/updating sponsor:", error);
      toast.error("Gagal menyimpan ke storage lokal");
    }
  };

  // ── Handle edit card ──────────────────────────────────────────────
  const handleEditCard = async (item: SponsorItem) => {
    if (!item._id) return;
    setEditingId(item._id);
    setFormData({ name: item.name });

    // Load image from IndexedDB or URL
    if (item.image_url) {
      setImagePreview(item.image_url);
    }

    const blob = await idbGet<Blob>(getIdbKey(item._id));
    if (blob) {
      setImageBlob(blob);
    } else {
      setImageBlob(null);
    }

    // Scroll to form
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ── Handle remove card ────────────────────────────────────────────
  const handleRemoveCard = async (id: string) => {
    try {
      const itemToRemove = items.find((item) => item._id === id);

      if (
        itemToRemove?.image_url &&
        itemToRemove.image_url.startsWith("blob:")
      ) {
        URL.revokeObjectURL(itemToRemove.image_url);
      }

      await idbDel(getIdbKey(id));

      const updatedItems = items
        .filter((item) => item._id !== id)
        .map((item, index) => ({ ...item, order: index }));

      setItems(updatedItems);
      saveToLocalStorage(updatedItems);

      if (editingId === id) {
        setEditingId(null);
        setFormData({ name: "" });
        setImageBlob(null);
        setImagePreview(null);
      }

      toast.success("Sponsor berhasil dihapus");
    } catch (error) {
      console.error("Error removing sponsor:", error);
      toast.error("Gagal menghapus sponsor");
    }
  };

  // ── Handle drag and drop sorting ──────────────────────────────────
  const handleDragEnd = (event: any) => {
    if (event.canceled) return;
    const { source } = event.operation;

    if (source && "sortable" in source) {
      const { initialIndex, index } = source.sortable;

      if (initialIndex !== index) {
        const newItems = [...items];
        const [movedItem] = newItems.splice(initialIndex, 1);
        newItems.splice(index, 0, movedItem);

        const updatedItems = newItems.map((item, idx) => ({
          ...item,
          order: idx,
        }));

        setItems(updatedItems);
        saveToLocalStorage(updatedItems);

        toast.success("Urutan sponsor berhasil diperbarui");
      }
    }
  };

  // ── Save to localStorage ──────────────────────────────────────────
  const saveToLocalStorage = (items: SponsorItem[]) => {
    try {
      const itemsToStore = items.map(({ image_url, ...rest }) => rest);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(itemsToStore));
    } catch (error) {
      console.error("Error saving to localStorage:", error);
      toast.error("Gagal menyimpan ke storage lokal");
    }
  };

  // ── Handle save to backend ────────────────────────────────────────
  const handleSaveToBackend = async () => {
    try {
      setIsSaving(true);
      toast.info("Menyimpan");

      // Step 1: Upload blobs to S3 and collect URLs
      const itemsWithUrls = await Promise.all(
        items.map(async (item) => {
          if (
            item.image_url &&
            item.image_url.startsWith("blob:") &&
            item._id
          ) {
            const blob = await idbGet<Blob>(getIdbKey(item._id));
            if (blob) {
              const formData = new FormData();
              formData.append("file", blob, "image.webp");
              const response = await api.post<{
                url: string;
                filename: string;
              }>(`/sponsor/upload-image`, formData, {
                headers: { "Content-Type": "multipart/form-data" },
              });
              if (!response.data?.url) {
                throw new Error(`Failed to upload image for ${item.name}`);
              }
              return { ...item, image_url: response.data.url };
            }
          }
          return item;
        }),
      );

      // Step 2: POST to /api/sponsor
      if (onSave) {
        await onSave(itemsWithUrls);
      }

      toast.success("Sponsor berhasil disimpan!");
    } catch (error) {
      console.error("Error saving to backend:", error);
      toast.error("Gagal menyimpan sponsor ke backend");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-w-0 max-w-full w-full">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <h1 className="text-2xl font-bold capitalize">Daftar Sponsor</h1>
        <Button onClick={handleSaveToBackend} disabled={isSaving} size="lg">
          <Save className="mr-2 h-4 w-4" />
          {isSaving ? "Menyimpan..." : "Simpan Perubahan"}
        </Button>
      </div>

      {/* Main Layout: Grid (Left) + Sidebar Form (Right) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:max-h-[min(80vh,48rem)] xl:max-h-screen lg:min-h-0">
        {/* ── LEFT: Grid Cards & Sorting ────────────────────────────────*/}
        <div className="order-2 lg:order-1 lg:col-span-2 flex min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card p-4">
          <div className="mb-4 flex flex-col justify-between gap-2 lg:flex-row lg:items-center">
            <h3 className="text-lg font-semibold">Daftar Sponsor</h3>
            <p className="text-sm font-light text-muted-foreground">
              {items.length} sponsor ditambahkan
            </p>
          </div>

          {/* Items Grid */}
          <div className="flex-1 overflow-y-auto pr-2">
            {items.length === 0 ? (
              <div className="flex h-full items-center justify-center rounded-lg border-2 border-dashed border-border p-12">
                <p className="text-muted-foreground">
                  Belum ada sponsor yang ditambahkan
                </p>
              </div>
            ) : (
              <DragDropProvider onDragEnd={handleDragEnd}>
                <div className={getAdminStandardCardGridClass()}>
                  {items.map((item, index) => (
                    <SponsorFormCard
                      key={item._id}
                      item={item}
                      index={index}
                      onEdit={handleEditCard}
                      onRemove={handleRemoveCard}
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
            {editingId ? "Edit Sponsor" : "Tambah Sponsor"}
          </h3>

          {/* Form Fields */}
          <div className="space-y-4">
            {/* Title Input */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Nama Sponsor <span className="text-destructive">*</span>
              </label>
              <Input
                type="text"
                placeholder="Masukkan nama sponsor"
                value={formData.name}
                onChange={(e) => handleFormChange("name", e.target.value)}
              />
            </div>

            {/* Thumbnail Upload Area */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Logo / Gambar <span className="text-destructive">*</span>
              </label>

              {imagePreview ? (
                <div className="space-y-2">
                  <div className="relative aspect-video overflow-hidden rounded-lg bg-muted p-2 flex items-center justify-center">
                    <Image
                      src={imagePreview}
                      alt="Preview"
                      className="object-contain"
                      fill
                      sizes="(max-width: 1024px) 100vw, 320px"
                      unoptimized={shouldUnoptimizeNewsCardImage(imagePreview)}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full text-destructive hover:text-destructive"
                    onClick={handleRemoveImage}
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
                    PNG, JPG, WEBP (Bebas rasio, latar transparan
                    direkomendasikan)
                  </p>
                </div>
              )}
            </div>

            {/* Add/Update Button */}
            <Button
              onClick={handleAddOrUpdate}
              className="w-full"
              disabled={!formData.name || (!imageBlob && !imagePreview)}
            >
              <Plus className="mr-2 h-4 w-4" />
              {editingId ? "Perbarui Sponsor" : "Tambahkan Sponsor"}
            </Button>

            {/* Cancel Edit Button */}
            {editingId && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setEditingId(null);
                  setFormData({ name: "" });
                  setImageBlob(null);
                  setImagePreview(null);
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
          aspect={1 / 1} // Persegi 1:1
          title="Crop Gambar Sponsor"
          onCrop={handleCropDone}
          onCancel={handleCropCancel}
        />
      )}
    </div>
  );
}
