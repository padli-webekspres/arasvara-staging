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
import { prepareImageForCrop } from "@/lib/image/prepareImageForCrop";
import api from "@/lib/axios";
import type { PendingMedia, TempMediaUploadResult } from "@/types/media";
import Image from "next/image";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DraftImageUploadFormProps {
  /**
   * Blob hasil crop dari parent. `null` = Fase 1 (hanya dropzone aktif).
   * Non-null = Fase 2 (form metadata + preview blob hasil crop tampil).
   */
  croppedBlob: Blob | null;

  /**
   * Dipanggil saat user memilih file dari dropzone.
   * Parent bertanggung jawab membuka CropModal dengan blobUrl ini.
   */
  onFileSelected: (blobUrl: string) => void;

  /**
   * Dipanggil saat user selesai mengisi metadata dan klik submit.
   * Blob sudah diproses server & disimpan ke /temp — parent menerima PendingMedia.
   */
  onMediaReady: (media: PendingMedia) => void;

  /** Dipanggil saat user membatalkan. */
  onCancel?: () => void;
}

// ─── Schema (fase 2 — metadata saja, file sudah dikelola parent) ──────────────

const metadataSchema = z.object({
  caption: z.string().max(200).optional(),
  credit: z.string().max(100).optional(),
  watermark: z.boolean().optional(),
});

type MetadataFormValues = z.infer<typeof metadataSchema>;

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Form upload gambar dua fase:
 *
 * **Fase 1** (`croppedBlob === null`): Hanya tampilkan dropzone.
 * Saat user memilih file, panggil `onFileSelected(blobUrl)`.
 * Parent akan membuka CropModal, lalu mengisi `croppedBlob` setelah crop selesai.
 *
 * **Fase 2** (`croppedBlob !== null`): Tampilkan preview blob hasil crop
 * beserta form metadata (caption, credit, watermark). Setelah submit,
 * blob dikirim ke `POST /api/media/process-temp` — server yang memproses
 * (HEIC/JPEG/PNG → WebP + kompresi + watermark opsional) dan menyimpannya
 * ke folder `temp/` object storage. `onMediaReady(pendingMedia)` dipanggil
 * dengan PendingMedia berisi `tempMediaId` + `tempUrl`.
 */
export default function DraftImageUploadForm({
  croppedBlob,
  onFileSelected,
  onMediaReady,
  onCancel,
}: DraftImageUploadFormProps) {
  const [processing, setProcessing] = useState(false);
  /** True saat file sedang di-decode/dinormalisasi sebelum crop modal dibuka. */
  const [preparingCrop, setPreparingCrop] = useState(false);

  // Preview URL untuk blob hasil crop (fase 2)
  const [croppedPreviewUrl, setCroppedPreviewUrl] = useState<string | null>(null);
  const croppedPreviewRef = useRef<string | null>(null);

  const form = useForm<MetadataFormValues>({
    resolver: zodResolver(metadataSchema),
    defaultValues: {
      caption: "",
      credit: "",
      watermark: false,
    },
  });

  // Buat preview URL saat croppedBlob berubah
  useEffect(() => {
    // Revoke URL lama untuk mencegah memory leak
    if (croppedPreviewRef.current) {
      URL.revokeObjectURL(croppedPreviewRef.current);
      croppedPreviewRef.current = null;
    }

    if (croppedBlob) {
      const url = URL.createObjectURL(croppedBlob);
      croppedPreviewRef.current = url;
      setCroppedPreviewUrl(url);
    } else {
      setCroppedPreviewUrl(null);
    }
  }, [croppedBlob]);

  // Cleanup saat unmount
  useEffect(() => {
    return () => {
      if (croppedPreviewRef.current) {
        URL.revokeObjectURL(croppedPreviewRef.current);
      }
    };
  }, []);

  // ─── Fase 1: Dropzone ────────────────────────────────────────────────────

  const onDrop = useCallback(
    async (accepted: File[]) => {
      if (!accepted.length || preparingCrop) return;
      const file = accepted[0];

      setPreparingCrop(true);
      try {
        // Decode + normalisasi (JPEG, downscale bila perlu) agar preview crop
        // di mobile tidak intermittent broken.
        const objectUrl = await prepareImageForCrop(file);
        onFileSelected(objectUrl);
      } catch {
        toast.error(
          "Gambar tidak dapat dimuat. Coba lagi atau gunakan format JPEG/PNG/WebP.",
        );
      } finally {
        setPreparingCrop(false);
      }
    },
    [onFileSelected, preparingCrop],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [] },
    maxFiles: 1,
    // Hanya aktif di fase 1 saat belum ada blob crop / sedang prepare
    disabled: croppedBlob !== null || preparingCrop,
  });

  // ─── Fase 2: Submit metadata ──────────────────────────────────────────────

  const onSubmitMetadata = async (values: MetadataFormValues) => {
    if (!croppedBlob) return;

    console.time("DraftImageUploadForm.onSubmitMetadata total");
    setProcessing(true);
    try {
      // Kirim hasil crop ke server — server decode & kompres ke WebP
      // (termasuk HEIC), terapkan watermark bila diminta, lalu simpan ke /temp.
      const formData = new FormData();
      formData.append("file", croppedBlob, "image.webp");
      formData.append("watermark", values.watermark ? "true" : "false");

      const res = await api.post<TempMediaUploadResult>(
        "/media/process-temp",
        formData,
        {
          // Upload + pemrosesan server bisa lebih lama di jaringan seluler
          timeout: 120_000,
        },
      );
      const { tempMediaId, tempUrl, filename, size } = res.data;

      const pendingMedia: PendingMedia = {
        _id: null,
        tempMediaId,
        tempUrl,
        filename,
        size,
        mimetype: "image/webp",
        url: tempUrl,
        caption: values.caption || undefined,
        credit: values.credit || undefined,
        watermark: values.watermark ?? false,
      };

      // Revoke internal preview — preview baru memakai tempUrl dari server
      if (croppedPreviewRef.current) {
        URL.revokeObjectURL(croppedPreviewRef.current);
        croppedPreviewRef.current = null;
        setCroppedPreviewUrl(null);
      }

      onMediaReady(pendingMedia);
      console.timeEnd("DraftImageUploadForm.onSubmitMetadata total");
    } catch (err) {
      console.timeEnd("DraftImageUploadForm.onSubmitMetadata total");
      const message =
        err instanceof Error ? err.message : "Gagal memproses gambar";
      toast.error(message);
    } finally {
      setProcessing(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  // Fase 1 — hanya dropzone
  if (!croppedBlob) {
    return (
      <div className="flex flex-col gap-4">
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center gap-3 transition-colors aspect-video ${
            preparingCrop
              ? "cursor-wait border-hijauSawah/60 bg-hijauSawah/5 opacity-80"
              : isDragActive
                ? "cursor-pointer border-hijauSawah bg-hijauSawah/5"
                : "cursor-pointer border-border hover:border-muted-foreground"
          }`}
        >
          <input {...getInputProps()} />
          <Upload className="h-10 w-10 text-muted-foreground" />
          <div className="text-center">
            <p className="text-sm font-medium">
              {preparingCrop
                ? "Menyiapkan gambar…"
                : isDragActive
                  ? "Lepaskan gambar di sini…"
                  : "Seret & lepas gambar"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {preparingCrop
                ? "Mohon tunggu sebentar"
                : "atau klik untuk memilih dari komputer"}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Setelah memilih, Anda akan memotong gambar terlebih dahulu.
          </p>
        </div>

        {onCancel && (
          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onCancel}
              disabled={preparingCrop}
            >
              Batal
            </Button>
          </div>
        )}
      </div>
    );
  }

  // Fase 2 — preview hasil crop + form metadata
  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmitMetadata)}
        className="flex flex-col gap-4"
      >
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Preview hasil crop */}
          <div className="w-full sm:w-1/2">
            <p className="text-sm font-medium mb-2">Hasil Pemotongan</p>
            {croppedPreviewUrl && (
              <div className="relative aspect-video rounded-lg overflow-hidden border border-border">
                <Image
                  unoptimized
                  src={croppedPreviewUrl}
                  width={640}
                  height={480}
                  alt="Preview hasil crop"
                  className="object-cover w-full h-full"
                />
                {/* Tombol untuk membatalkan dan kembali ke dropzone */}
                <button
                  type="button"
                  onClick={onCancel}
                  className="absolute top-2 right-2 p-1 bg-black/50 rounded-full text-white hover:bg-black/70 transition-colors"
                  title="Pilih gambar lain"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {/* Form metadata */}
          <div className="w-full sm:w-1/2 flex flex-col gap-3">
            <FormField
              control={form.control}
              name="caption"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Caption Media</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Deskripsi gambar di perpustakaan media"
                      className="focus-visible:border-hijauSawah focus-visible:ring-hijauSawah/25"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="credit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Credit / Taken By</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Nama fotografer atau sumber"
                      className="focus-visible:border-hijauSawah focus-visible:ring-hijauSawah/25"
                      {...field}
                    />
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
                  <FormLabel className="cursor-pointer">Watermark</FormLabel>
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
            <Button type="button" variant="outline" onClick={onCancel}>
              Batal
            </Button>
          )}
          <Button type="submit" disabled={processing}>
            {processing ? "Memproses…" : "Gunakan Gambar Ini"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
