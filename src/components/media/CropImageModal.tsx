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
  const imgRef = useRef<HTMLImageElement>(null);
  const [crop, setCrop] = useState<Crop | undefined>(undefined);
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setCrop(undefined);
      setCompletedCrop(null);
    }
  }, [open, imageSrc]);

  const onImageLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const { width, height } = e.currentTarget;
      const percentCrop = centerCrop(
        makeAspectCrop({ unit: "%", width: 90 }, aspect, width, height),
        width,
        height,
      );
      setCrop(percentCrop);
      // Implikasikan completedCrop langsung agar tombol crop bisa diklik tanpa harus drag dulu
      setCompletedCrop(convertToPixelCrop(percentCrop, width, height));
    },
    [aspect],
  );

  // Jangan render <img> tanpa src valid — komponen ini selalu ter-mount dari parent
  // dengan `imageSrc={cropSrc ?? ""}` meski modal tertutup.
  if (!imageSrc) {
    return null;
  }

  const handleCrop = async () => {
    if (!completedCrop || !imgRef.current) return;
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
    } catch {
      toast.error(
        "Gagal memproses gambar hasil crop. Coba lagi atau gunakan gambar lain.",
      );
      setLoading(false);
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
          className="relative flex w-full items-center justify-center overflow-hidden rounded-md bg-black"
          style={{ height: viewportHeight }}
        >
          <ReactCrop
            crop={crop}
            onChange={(c) => setCrop(c)}
            onComplete={(c) => setCompletedCrop(c)}
            aspect={aspect}
            keepSelection
            className="max-h-full"
            style={{ maxHeight: viewportHeight }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- react-image-crop butuh <img> native untuk mengakses naturalWidth/naturalHeight via ref */}
            <img
              ref={imgRef}
              src={imageSrc}
              alt="Crop preview"
              onLoad={onImageLoad}
              style={{ maxHeight: viewportHeight, width: "auto" }}
            />
          </ReactCrop>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleCrop} disabled={loading || !completedCrop}>
            {loading ? "Processing..." : "Use This Image"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
