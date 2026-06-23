"use client";

import { useState, useCallback, useEffect } from "react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export type CropImageExportOptions = {
  /** Rasio tampilan crop (lebar ÷ tinggi). */
  aspect?: number;
  /** Jika diisi keduanya, hasil diskalakan ke ukuran tetap (mis. featured 1280×800). */
  outputWidth?: number;
  outputHeight?: number;
  /** Kualitas WebP `canvas.toBlob` (0–1). */
  webpQuality?: number;
  /** Batas ukuran file dalam MB (default: 0.78). */
  maxSizeMB?: number;
};

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

async function getCroppedImg(
  imageSrc: string,
  pixelCrop: Area,
  {
    aspect = 4 / 5,
    outputWidth,
    outputHeight,
    webpQuality = 0.9,
    maxSizeMB = 0.78,
  }: CropImageExportOptions = {},
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    if (/^https?:\/\//i.test(imageSrc)) {
      image.crossOrigin = "anonymous";
    }
    image.onload = async () => {
      try {
        const hasFixedOutput =
          outputWidth != null &&
          outputHeight != null &&
          outputWidth > 0 &&
          outputHeight > 0;

        let baseWidth = 0;
        let baseHeight = 0;

        if (hasFixedOutput) {
          baseWidth = outputWidth;
          baseHeight = outputHeight;
        } else {
          /* Legacy: ukuran mengikuti crop + aspect */
          let canvasWidth = pixelCrop.width;
          let canvasHeight = pixelCrop.height;
          if (canvasWidth / canvasHeight > aspect) {
            canvasWidth = canvasHeight * aspect;
          } else {
            canvasHeight = canvasWidth / aspect;
          }
          baseWidth = Math.round(canvasWidth);
          baseHeight = Math.round(canvasHeight);
        }

        const maxSizeBytes = maxSizeMB * 1024 * 1024;

        // Hybrid scaling & quality configuration list
        const attempts = [
          { scale: 1.0, quality: webpQuality || 0.85 },
          { scale: 1.0, quality: 0.8 },
          { scale: 0.85, quality: 0.8 },
          { scale: 0.85, quality: 0.75 },
          { scale: 0.7, quality: 0.75 },
          { scale: 0.6, quality: 0.7 },
        ];

        let finalBlob: Blob | null = null;

        for (const attempt of attempts) {
          const targetWidth = Math.round(baseWidth * attempt.scale);
          const targetHeight = Math.round(baseHeight * attempt.scale);

          const canvas = document.createElement("canvas");
          canvas.width = targetWidth;
          canvas.height = targetHeight;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            throw new Error("No canvas context");
          }

          ctx.drawImage(
            image,
            pixelCrop.x,
            pixelCrop.y,
            pixelCrop.width,
            pixelCrop.height,
            0,
            0,
            targetWidth,
            targetHeight,
          );

          finalBlob = await new Promise<Blob | null>((res) =>
            canvas.toBlob((b) => res(b), "image/webp", attempt.quality),
          );

          if (finalBlob && finalBlob.size <= maxSizeBytes) {
            break;
          }
        }

        if (finalBlob) {
          resolve(finalBlob);
        } else {
          reject(new Error("Failed to create blob"));
        }
      } catch (err) {
        reject(err);
      }
    };
    image.onerror = () => reject(new Error("Failed to load image"));
    image.src = imageSrc;
  });
}

function cropModalChrome(aspect: number, layout?: "portrait" | "landscape") {
  const isLandscape = layout === "landscape" || (layout == null && aspect >= 1);
  return {
    dialogClass: isLandscape ? "max-w-2xl gap-4" : "max-w-sm gap-4",
    viewportHeight: isLandscape ? 280 : 480,
  };
}

export default function CropImageModal({
  open,
  imageSrc,
  aspect = 4 / 5,
  title = "Crop Image",
  onCrop,
  onCancel,
  outputWidth,
  outputHeight,
  webpQuality = 0.9,
  layout,
}: CropImageModalProps) {
  const { dialogClass, viewportHeight } = cropModalChrome(aspect, layout);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
    }
  }, [open, imageSrc]);

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleCrop = async () => {
    if (!croppedAreaPixels) return;
    setLoading(true);
    let blob: Blob;
    try {
      blob = await getCroppedImg(imageSrc, croppedAreaPixels, {
        aspect,
        outputWidth,
        outputHeight,
        webpQuality,
      });
    } catch {
      toast.error(
        "Gagal memproses gambar hasil crop. Coba lagi atau gunakan gambar lain.",
      );
      return;
    }
    try {
      await Promise.resolve(onCrop(blob));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className={dialogClass}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div
          className="relative w-full overflow-hidden rounded-md bg-black"
          style={{ height: viewportHeight }}
        >
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        <div className="space-y-1 px-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Zoom</span>
            <span>{zoom.toFixed(1)}×</span>
          </div>
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleCrop} disabled={loading || !croppedAreaPixels}>
            {loading ? "Processing..." : "Use This Image"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
