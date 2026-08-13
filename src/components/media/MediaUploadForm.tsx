"use client";

import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useDropzone } from "react-dropzone";
import { Upload, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import CropImageModal from "@/components/media/CropImageModal";
import {
  CONTENT_CROP_ASPECT,
  CONTENT_CROP_HEIGHT,
  CONTENT_CROP_WIDTH,
  CONTENT_WEBP_QUALITY,
} from "@/lib/media/cropPresets";
import { prepareImageForCrop } from "@/lib/image/prepareImageForCrop";
import api from "@/lib/axios";
import type { Media, TempMediaUploadResult } from "@/types/media";
import Image from "next/image";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MediaUploadFormProps {
  /** Called with the uploaded Media object on success. */
  onSuccess: (media: Media) => void;
  /** Called when the user clicks Cancel (optional). */
  onCancel?: () => void;
  /** Label for the submit button. Defaults to "Upload". */
  submitLabel?: string;
}

const metadataSchema = z.object({
  caption: z.string().max(200).optional(),
  takenBy: z.string().max(100).optional(),
  watermark: z.boolean().optional(),
});

type MetadataFormValues = z.infer<typeof metadataSchema>;

/**
 * Alur upload media library (server-side temp + promote):
 * 1. Pilih file → CropImageModal
 * 2. Hasil crop → POST /api/media/process-temp (Sharp WebP di server)
 * 3. Isi metadata + preview temp URL
 * 4. Submit → POST /api/media/promote-temp (ke folder media-library)
 */
export default function MediaUploadForm({
  onSuccess,
  onCancel,
  submitLabel = "Upload",
}: MediaUploadFormProps) {
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [tempMediaId, setTempMediaId] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [processingTemp, setProcessingTemp] = useState(false);
  const [preparingCrop, setPreparingCrop] = useState(false);

  const form = useForm<MetadataFormValues>({
    resolver: zodResolver(metadataSchema),
    defaultValues: {
      caption: "",
      takenBy: "",
      watermark: false,
    },
  });

  const resetUploadFlow = useCallback(() => {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
    setCropOpen(false);
    setTempMediaId(null);
    setPreview(null);
    form.reset({ caption: "", takenBy: "", watermark: false });
  }, [cropSrc, form]);

  useEffect(() => {
    return () => {
      if (cropSrc) URL.revokeObjectURL(cropSrc);
    };
  }, [cropSrc]);

  const onDrop = useCallback(
    async (accepted: File[]) => {
      if (!accepted.length || preparingCrop) return;
      const file = accepted[0];

      setPreparingCrop(true);
      try {
        // Decode + normalisasi (JPEG/HEIC downscale) agar crop preview Safari stabil.
        const objectUrl = await prepareImageForCrop(file);
        if (cropSrc) URL.revokeObjectURL(cropSrc);
        setCropSrc(objectUrl);
        setCropOpen(true);
      } catch {
        toast.error(
          "Gambar tidak dapat dimuat. Coba lagi atau gunakan format JPEG/PNG/WebP.",
        );
      } finally {
        setPreparingCrop(false);
      }
    },
    [cropSrc, preparingCrop],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [] },
    maxFiles: 1,
    disabled: tempMediaId !== null || preparingCrop || processingTemp,
  });

  /** Upload hasil crop ke /temp via server Sharp. */
  const handleCropDone = useCallback(
    async (blob: Blob) => {
      setCropOpen(false);
      if (cropSrc) {
        URL.revokeObjectURL(cropSrc);
        setCropSrc(null);
      }

      setProcessingTemp(true);
      try {
        const file = new File([blob], "image.webp", { type: "image/webp" });
        const fd = new FormData();
        fd.append("file", file);
        fd.append("watermark", String(form.getValues("watermark") ?? false));

        const res = await api.post<TempMediaUploadResult>(
          "/media/process-temp",
          fd,
        );

        if (!res.data?.tempMediaId) {
          throw new Error("Gagal memproses gambar temporary di server");
        }

        setTempMediaId(res.data.tempMediaId);
        setPreview(res.data.tempUrl);
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : "Gagal memproses gambar di server",
        );
      } finally {
        setProcessingTemp(false);
      }
    },
    [cropSrc, form],
  );

  const handleCropCancel = useCallback(() => {
    setCropOpen(false);
    if (cropSrc) {
      URL.revokeObjectURL(cropSrc);
      setCropSrc(null);
    }
  }, [cropSrc]);

  const onSubmit = async (values: MetadataFormValues) => {
    if (!tempMediaId) {
      toast.error("Pilih dan potong gambar terlebih dahulu.");
      return;
    }

    setUploading(true);
    try {
      const res = await api.post<{ success: boolean; media: Media }>(
        "/media/promote-temp",
        {
          tempMediaId,
          folder: "media-library",
          caption: values.caption,
          credit: values.takenBy,
          watermark: values.watermark ?? false,
        },
      );

      if (!res.data?.media) throw new Error("Gagal mempromosikan media");

      resetUploadFlow();
      toast.success("Gambar berhasil di-upload ke media library");
      onSuccess(res.data.media);
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || (err instanceof Error ? err.message : "Upload failed");
      toast.error(message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="w-full sm:w-1/2">
              <FormItem>
                <FormLabel>Image</FormLabel>
                <FormControl>
                  {processingTemp ? (
                    <div className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center gap-2 aspect-video">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      <p className="text-sm text-muted-foreground text-center">
                        Memproses & menyimpan temp di server...
                      </p>
                    </div>
                  ) : preview && tempMediaId ? (
                    <div className="relative aspect-video rounded-lg overflow-hidden border border-border">
                      <Image
                        unoptimized
                        src={preview}
                        width={640}
                        height={480}
                        alt="Preview"
                        className="object-cover w-full h-full"
                      />
                      <button
                        type="button"
                        onClick={resetUploadFlow}
                        className="absolute top-2 right-2 p-1 bg-black/50 rounded-full text-white hover:bg-black/70 transition-colors"
                        title="Remove image"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div
                      {...getRootProps()}
                      className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors aspect-video ${
                        preparingCrop
                          ? "pointer-events-none border-border opacity-60"
                          : isDragActive
                            ? "border-accent bg-accent/5"
                            : "border-border hover:border-muted-foreground"
                      }`}
                    >
                      <input {...getInputProps()} />
                      {preparingCrop ? (
                        <>
                          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                          <p className="text-sm text-muted-foreground text-center">
                            Menyiapkan gambar...
                          </p>
                        </>
                      ) : (
                        <>
                          <Upload className="h-8 w-8 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground text-center">
                            {isDragActive
                              ? "Drop the image here..."
                              : "Drag & drop or click to select — crop required"}
                          </p>
                        </>
                      )}
                    </div>
                  )}
                </FormControl>
              </FormItem>
            </div>

            <div className="flex-1 flex flex-col gap-3">
              <FormField
                control={form.control}
                name="caption"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Caption</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Caption (optional)" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="takenBy"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Taken By</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Photographer (optional)" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="watermark"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <FormLabel className="mb-0">Watermark</FormLabel>
                    <FormControl>
                      <Switch
                        checked={field.value ?? false}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            {onCancel && (
              <Button type="button" variant="ghost" onClick={onCancel}>
                Cancel
              </Button>
            )}
            <Button
              type="submit"
              disabled={uploading || !tempMediaId || processingTemp}
            >
              {uploading ? "Uploading..." : submitLabel}
            </Button>
          </div>
        </form>
      </Form>

      <CropImageModal
        open={cropOpen && Boolean(cropSrc)}
        imageSrc={cropSrc ?? ""}
        aspect={CONTENT_CROP_ASPECT}
        outputWidth={CONTENT_CROP_WIDTH}
        outputHeight={CONTENT_CROP_HEIGHT}
        webpQuality={CONTENT_WEBP_QUALITY}
        title="Potong gambar"
        onCrop={handleCropDone}
        onCancel={handleCropCancel}
      />
    </>
  );
}
