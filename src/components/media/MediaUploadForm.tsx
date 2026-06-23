"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useDropzone } from "react-dropzone";
import { Upload, X } from "lucide-react";
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
import { embedWatermarkToImage } from "@/lib/image/embedWatermark";
import { ensureWebpFile } from "@/lib/image/ensureWebpBlob";
import CropImageModal from "@/components/media/CropImageModal";
import {
  CONTENT_CROP_ASPECT,
  CONTENT_CROP_HEIGHT,
  CONTENT_CROP_WIDTH,
  CONTENT_WEBP_QUALITY,
} from "@/lib/media/cropPresets";
import api from "@/lib/axios";
import type { Media } from "@/types/media";
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

// ─── Schema (fase 2 — metadata; file hasil crop dikelola state) ───────────────

const metadataSchema = z.object({
  caption: z.string().max(200).optional(),
  takenBy: z.string().max(100).optional(),
  watermark: z.boolean().optional(),
});

type MetadataFormValues = z.infer<typeof metadataSchema>;

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Alur upload media library (selaras editor artikel — tab Upload):
 * 1. Pilih file → CropImageModal
 * 2. Isi metadata + preview hasil crop
 * 3. POST /api/media (langsung ke server, bukan IndexedDB)
 */
export default function MediaUploadForm({
  onSuccess,
  onCancel,
  submitLabel = "Upload",
}: MediaUploadFormProps) {
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [croppedBlob, setCroppedBlob] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const previewUrlRef = useRef<string | null>(null);

  const form = useForm<MetadataFormValues>({
    resolver: zodResolver(metadataSchema),
    defaultValues: {
      caption: "",
      takenBy: "",
      watermark: false,
    },
  });

  const watermark = form.watch("watermark");

  const revokePreview = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreview(null);
  }, []);

  const resetUploadFlow = useCallback(() => {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
    setCropOpen(false);
    setCroppedBlob(null);
    revokePreview();
    form.reset({ caption: "", takenBy: "", watermark: false });
  }, [cropSrc, form, revokePreview]);

  // Regenerate preview when cropped blob or watermark changes
  useEffect(() => {
    if (!croppedBlob) {
      revokePreview();
      return;
    }

    let active = true;

    const generate = async () => {
      revokePreview();
      try {
        const source = watermark
          ? await embedWatermarkToImage(
              new File([croppedBlob], "image.webp", { type: "image/webp" }),
              { opacity: 0.25 },
            )
          : croppedBlob;
        if (!active) return;
        const url = URL.createObjectURL(source);
        previewUrlRef.current = url;
        setPreview(url);
      } catch {
        if (!active) return;
        const fallback = URL.createObjectURL(croppedBlob);
        previewUrlRef.current = fallback;
        setPreview(fallback);
      }
    };

    void generate();
    return () => {
      active = false;
    };
  }, [croppedBlob, watermark, revokePreview]);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      if (cropSrc) URL.revokeObjectURL(cropSrc);
    };
  }, [cropSrc]);

  const onDrop = useCallback((accepted: File[]) => {
    if (!accepted.length) return;
    const objectUrl = URL.createObjectURL(accepted[0]);
    setCropSrc(objectUrl);
    setCropOpen(true);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [] },
    maxFiles: 1,
    disabled: croppedBlob !== null,
  });

  const handleCropDone = useCallback((blob: Blob) => {
    setCroppedBlob(blob);
    setCropOpen(false);
    setCropSrc((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  const handleCropCancel = useCallback(() => {
    setCropOpen(false);
    setCropSrc((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  const removeCroppedImage = () => {
    resetUploadFlow();
  };

  const onSubmit = async (values: MetadataFormValues) => {
    if (!croppedBlob) {
      toast.error("Pilih dan potong gambar terlebih dahulu.");
      return;
    }

    setUploading(true);
    try {
      let fileToUpload = new File([croppedBlob], "image.webp", {
        type: "image/webp",
      });

      if (values.watermark) {
        fileToUpload = await embedWatermarkToImage(fileToUpload, {
          opacity: 0.25,
        });
      }

      fileToUpload = await ensureWebpFile(fileToUpload);

      const fd = new FormData();
      fd.append("file", fileToUpload);
      if (values.caption) fd.append("caption", values.caption);
      if (values.takenBy) fd.append("takenBy", values.takenBy);
      fd.append("watermark", String(values.watermark ?? false));

      const res = await api.post<{ success: boolean; media: Media }>(
        "/media",
        fd,
      );

      if (!res.data?.media) throw new Error("Invalid response from server");

      revokePreview();
      resetUploadFlow();
      toast.success("Image uploaded successfully");
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
                  {preview && croppedBlob ? (
                    <div className="relative aspect-video rounded-lg overflow-hidden">
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
                        onClick={removeCroppedImage}
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
                        isDragActive
                          ? "border-accent bg-accent/5"
                          : "border-border hover:border-muted-foreground"
                      }`}
                    >
                      <input {...getInputProps()} />
                      <Upload className="h-8 w-8 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground text-center">
                        {isDragActive
                          ? "Drop the image here..."
                          : "Drag & drop or click to select — crop required"}
                      </p>
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
                        disabled={!croppedBlob}
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
            <Button type="submit" disabled={uploading || !croppedBlob}>
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
