"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import ReactCrop, {
  centerCrop,
  makeAspectCrop,
  convertToPixelCrop,
  type Crop,
  type PixelCrop,
} from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  getCroppedImg,
  toNaturalPixelCrop,
  CROP_OUTPUT_TOO_LARGE,
  type CropImageExportOptions,
} from "@/lib/image/getCroppedImg";

export type { CropImageExportOptions };

interface CropImageModalProps {
  open: boolean;
  imageSrc: string;
  aspect?: number;
  title?: string;
  /** Boleh async (mis. simpan IndexedDB) — modal menunggu hingga selesai. */
  onCrop: (blob: Blob) => void | Promise<void>;
  onCancel: () => void;
  /** Output tetap + kompresi (opsional). */
  outputWidth?: number;
  outputHeight?: number;
  webpQuality?: number;
  /** Mengatur lebar dialog & tinggi viewport crop (default mengikuti aspect). */
  layout?: "portrait" | "landscape";
}

const MAX_IMAGE_RETRIES = 2;

function cropModalChrome(aspect: number, layout?: "portrait" | "landscape") {
  const isLandscape = layout === "landscape" || (layout == null && aspect >= 1);
  return {
    dialogClass: isLandscape ? "max-w-2xl gap-4" : "max-w-sm gap-4",
    viewportHeight: isLandscape
      ? "min(280px, 40dvh)"
      : "min(480px, 55dvh)",
  };
}

export default function CropImageModal({
  open,
  imageSrc,
  aspect = 4 / 5,
  title = "Potong gambar",
  onCrop,
  onCancel,
  outputWidth,
  outputHeight,
  webpQuality = 0.9,
  layout,
}: CropImageModalProps) {
  const { dialogClass, viewportHeight } = cropModalChrome(aspect, layout);
  const imgRef = useRef<HTMLImageElement>(null);
  const [crop, setCrop] = useState<Crop | undefined>(undefined);
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
  const [loading, setLoading] = useState(false);
  const [imageReady, setImageReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  /** Naikkan nilai ini untuk memaksa remount <img> (retry decode). */
  const [reloadToken, setReloadToken] = useState(0);
  const retryCountRef = useRef(0);

  const applyInitialCrop = useCallback(
    (img: HTMLImageElement) => {
      const { width, height } = img;
      if (!width || !height) return;

      const percentCrop = centerCrop(
        makeAspectCrop({ unit: "%", width: 90 }, aspect, width, height),
        width,
        height,
      );
      setCrop(percentCrop);
      // Implikasikan completedCrop langsung agar tombol crop bisa diklik tanpa harus drag dulu
      setCompletedCrop(convertToPixelCrop(percentCrop, width, height));
      setImageReady(true);
      setLoadError(false);
    },
    [aspect],
  );

  // Reset state saat modal dibuka / sumber gambar berubah.
  // Jika gambar sudah ter-cache (img.complete), onLoad mungkin tidak fire lagi —
  // inisialisasi crop secara manual.
  useEffect(() => {
    if (!open || !imageSrc) return;

    setCrop(undefined);
    setCompletedCrop(null);
    setImageReady(false);
    setLoadError(false);
    retryCountRef.current = 0;
    setReloadToken(0);

    const frameId = requestAnimationFrame(() => {
      const img = imgRef.current;
      if (img?.complete && img.naturalWidth > 0) {
        applyInitialCrop(img);
      }
    });

    return () => cancelAnimationFrame(frameId);
  }, [open, imageSrc, applyInitialCrop]);

  const onImageLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      applyInitialCrop(e.currentTarget);
    },
    [applyInitialCrop],
  );

  const remountImage = useCallback(() => {
    setLoadError(false);
    setImageReady(false);
    setCrop(undefined);
    setCompletedCrop(null);
    setReloadToken((token) => token + 1);
  }, []);

  const retryImageLoad = useCallback(() => {
    // Manual retry: izinkan auto-retry kembali dari awal
    retryCountRef.current = 0;
    remountImage();
  }, [remountImage]);

  const onImageError = useCallback(() => {
    if (retryCountRef.current < MAX_IMAGE_RETRIES) {
      retryCountRef.current += 1;
      // Remount <img> — sering berhasil di mobile setelah gagal decode pertama
      remountImage();
      return;
    }
    setLoadError(true);
    setImageReady(false);
    setCompletedCrop(null);
  }, [remountImage]);

  const handleCrop = async () => {
    if (!completedCrop || !imgRef.current || !imageSrc) return;
    setLoading(true);
    const naturalCrop = toNaturalPixelCrop(imgRef.current, completedCrop);
    let blob: Blob;
    try {
      blob = await getCroppedImg(imageSrc, naturalCrop, {
        aspect,
        outputWidth,
        outputHeight,
        webpQuality,
      });
    } catch (err) {
      const message =
        err instanceof Error && err.message === CROP_OUTPUT_TOO_LARGE
          ? CROP_OUTPUT_TOO_LARGE
          : "Gagal memproses gambar hasil crop. Coba lagi atau gunakan gambar lain.";
      toast.error(message);
      setLoading(false);
      return;
    }
    try {
      await Promise.resolve(onCrop(blob));
    } finally {
      setLoading(false);
    }
  };

  // Jangan render dialog tanpa src valid — parent sering mount dengan imageSrc=""
  // saat modal tertutup.
  if (!imageSrc) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className={dialogClass}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div
          className="relative flex w-full items-center justify-center overflow-hidden rounded-md bg-black"
          style={{ height: viewportHeight }}
        >
          {loadError ? (
            <div className="flex max-w-sm flex-col items-center gap-3 px-4 text-center">
              <p className="text-sm text-muted-foreground">
                Preview gambar gagal dimuat. Ini kadang terjadi di perangkat
                mobile — coba muat ulang preview.
              </p>
              <Button type="button" variant="secondary" onClick={retryImageLoad}>
                Muat ulang preview
              </Button>
            </div>
          ) : (
            <ReactCrop
              crop={crop}
              onChange={(c) => setCrop(c)}
              onComplete={(c) => setCompletedCrop(c)}
              aspect={aspect}
              keepSelection
              className="max-h-full"
              style={{ maxHeight: viewportHeight }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- react-image-crop butuh <img> native untuk naturalWidth/naturalHeight via ref */}
              <img
                key={`${imageSrc}-${reloadToken}`}
                ref={imgRef}
                src={imageSrc}
                alt="Crop preview"
                onLoad={onImageLoad}
                onError={onImageError}
                style={{ maxHeight: viewportHeight, width: "auto" }}
              />
            </ReactCrop>
          )}

          {!loadError && !imageReady && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40">
              <p className="text-sm text-muted-foreground">Memuat preview…</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            Batal
          </Button>
          <Button
            onClick={handleCrop}
            disabled={loading || !completedCrop || loadError || !imageReady}
          >
            {loading ? "Memproses..." : "Pakai gambar ini"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
