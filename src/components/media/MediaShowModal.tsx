"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { Badge } from "../ui/badge";
import { PencilLineIcon, Trash2, X } from "lucide-react";
import type { Media, MediaUsageInArticle } from "@/types/media";
import { Button } from "../ui/button";
import MediaEditForm from "./MediaEditForm";
import { toast } from "sonner";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { ROLES } from "@/lib/auth-client";
import api from "@/lib/axios";
import { getApiErrorMessage } from "@/lib/api-error";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface MediaShowModalProps {
  open: boolean;
  media: Media;
  onClose: () => void;
  /** Dipanggil setelah hard delete sukses agar parent bisa update list. */
  onDeleted?: (mediaId: string) => void;
}

/**
 * Hitung rata-rata luminance dari image element untuk menentukan warna gradient.
 * Menggunakan canvas untuk sampling pixel image.
 */
async function getImageLuminance(imageSrc: string): Promise<number> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(128); // Default neutral
        return;
      }

      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      let total = 0;
      let count = 0;
      const sampleStep = 10; // Sample every 10th pixel untuk performa

      for (let i = 0; i < data.length; i += 4 * sampleStep) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        // Formula luminance standar (ITU-R BT.601)
        total += 0.299 * r + 0.587 * g + 0.114 * b;
        count++;
      }

      const luminance = count > 0 ? total / count : 128;
      resolve(luminance);
    };
    img.onerror = () => resolve(128); // Default jika gagal load
    img.src = imageSrc;
  });
}

const MediaShowModal = ({
  open,
  media,
  onClose,
  onDeleted,
}: MediaShowModalProps) => {
  const { data: currentUser } = useCurrentUser();
  const isAdmin =
    (currentUser?.role ?? "").toLowerCase() === ROLES.ADMIN.toLowerCase();

  const [luminance, setLuminance] = useState(128); // Default: neutral gray
  const [showEditForm, setShowEditForm] = useState(false);
  const [mediaData, setMediaData] = useState<Media>(media);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [usageLoading, setUsageLoading] = useState(false);
  const [blockingArticles, setBlockingArticles] = useState<
    MediaUsageInArticle[]
  >([]);
  const imageRef = useRef<HTMLImageElement>(null);

  // Sync media prop to local state if modal reopened with different media
  useEffect(() => {
    setMediaData(media);
    setBlockingArticles([]);
  }, [media]);

  // Hitung luminance saat modal dibuka atau media berubah
  useEffect(() => {
    if (!open) return;
    getImageLuminance(mediaData.url).then((lum) => {
      setLuminance(lum);
    });
  }, [open, mediaData.url]);

  // Admin: cek usage saat modal dibuka
  useEffect(() => {
    if (!open || !isAdmin || !mediaData._id) return;

    let cancelled = false;
    setUsageLoading(true);
    api
      .get<{
        success: boolean;
        blockingArticles: MediaUsageInArticle[];
      }>(`/media/${mediaData._id}/usage`)
      .then(({ data }) => {
        if (cancelled) return;
        setBlockingArticles(data.blockingArticles ?? []);
      })
      .catch(() => {
        if (cancelled) return;
        // Jika usage gagal, jangan izinkan hapus sampai dicek ulang
        setBlockingArticles([
          {
            _id: "unknown",
            title: "Tidak dapat memeriksa pemakaian media",
            slug: "",
            status: "",
            usedAs: [],
          },
        ]);
      })
      .finally(() => {
        if (!cancelled) setUsageLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, isAdmin, mediaData._id]);

  // Tutup modal jika tekan ESC (kecuali sedang edit)
  useEffect(() => {
    if (!open || showEditForm || deleteDialogOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose, showEditForm, deleteDialogOpen]);

  // Gradient & style logic
  const isDarkImage = luminance <= 128;
  const gradientClass = isDarkImage
    ? "from-white/80 to-transparent"
    : "from-black/80 to-transparent";
  const textColorClass = isDarkImage ? "text-black" : "text-white";
  const badgeVariant = isDarkImage ? "default" : "secondary";

  const getMediaType = (): string => {
    if (mediaData.mimetype?.startsWith("image/")) return "Image";
    if (mediaData.mimetype?.startsWith("video/")) return "Video";
    return "File";
  };

  const isBlocked = blockingArticles.length > 0;
  const canDelete = isAdmin && !usageLoading && !isBlocked;

  // Handler for edit success (optimistic update)
  const handleEditSuccess = (updated: Media) => {
    setMediaData(updated);
    setShowEditForm(false);
    toast.success("Media updated successfully");
  };

  const handleHardDelete = async () => {
    if (!canDelete || !mediaData._id) return;
    setDeleting(true);
    try {
      await api.delete(`/media/${mediaData._id}`);
      toast.success("Media berhasil dihapus.");
      onDeleted?.(mediaData._id);
      setDeleteDialogOpen(false);
      onClose();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Gagal menghapus media"));
    } finally {
      setDeleting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/25"
        onClick={onClose}
        aria-label="Close modal background"
      />
      {/* Modal Content */}
      <div className="relative w-full max-w-7xl mx-auto bg-black rounded-lg overflow-hidden z-10">
        {/* Close Button */}
        {!showEditForm && (
          <Button
            variant="outline"
            type="button"
            onClick={onClose}
            className="absolute top-2 right-2 z-50 opacity-50"
            aria-label="Close modal"
          >
            <X className="h-4 w-4 text-black" />
          </Button>
        )}
        {/* Image */}
        <Image
          ref={imageRef}
          unoptimized
          src={mediaData.url}
          alt={mediaData.caption || "Media"}
          width={1200}
          height={800}
          className="w-full h-auto object-cover"
          priority
        />
        {/* Gradient Overlay + Info di bawah gambar */}
        <div
          className={`absolute inset-x-0 bottom-0 bg-linear-to-t ${gradientClass} p-6`}
        >
          <div className="flex flex-col md:flex-row md:justify-between md:gap-4 pt-4 md:pt-8 md:items-center w-full">
            <div className="flex flex-col md:flex-row md:items-center md:gap-4 gap-2 ">
              <Badge
                variant={badgeVariant}
                className="w-fit text-sm lg:text-base lg:px-3 py-1"
              >
                {getMediaType()}
              </Badge>
              {mediaData.credit && (
                <p className={`lg:text-lg font-medium ${textColorClass}`}>
                  Credit: {mediaData.credit}
                </p>
              )}
              {mediaData.caption && (
                <p className={`lg:text-lg ${textColorClass}`}>
                  {mediaData.caption}
                </p>
              )}
            </div>
            <div className="flex flex-col items-stretch md:items-end gap-2 mt-3 md:mt-0">
              <div className="flex flex-wrap gap-2 justify-end">
                {isAdmin && (
                  <Button
                    variant="destructive"
                    size="lg"
                    onClick={() => setDeleteDialogOpen(true)}
                    disabled={!canDelete || showEditForm || deleting}
                    title={
                      isBlocked
                        ? "Media masih dipakai artikel aktif"
                        : usageLoading
                          ? "Memeriksa pemakaian..."
                          : "Hapus media"
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                    Hapus
                  </Button>
                )}
                <Button
                  variant={badgeVariant}
                  size="lg"
                  onClick={() => setShowEditForm(true)}
                  disabled={showEditForm}
                >
                  <PencilLineIcon />
                  Edit
                </Button>
              </div>
              {isAdmin && isBlocked && (
                <div
                  className={`text-xs max-w-md text-right ${textColorClass} opacity-90`}
                >
                  <p className="font-medium mb-1">
                    Tidak bisa dihapus — masih dipakai artikel:
                  </p>
                  <ul className="list-disc list-inside text-left md:text-right space-y-0.5">
                    {blockingArticles.slice(0, 5).map((a) => (
                      <li key={a._id}>
                        {a.title || a.slug || a._id}
                        {a.status ? ` (${a.status})` : ""}
                      </li>
                    ))}
                    {blockingArticles.length > 5 && (
                      <li>+{blockingArticles.length - 5} lainnya</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
        {/* Edit Form Overlay */}
        {showEditForm && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="relative w-full max-w-lg mx-auto bg-card rounded-lg shadow-lg p-6">
              <MediaEditForm
                media={mediaData}
                onSuccess={handleEditSuccess}
                onCancel={() => setShowEditForm(false)}
              />
            </div>
          </div>
        )}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus media ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Media akan dihapus permanen dari database dan object storage.
              Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleHardDelete();
              }}
              disabled={deleting || !canDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Menghapus..." : "Ya, Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MediaShowModal;
