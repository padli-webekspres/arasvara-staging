"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ArticleAttribution {
  caption: string;
  credit: string;
}

interface ArticleAttributionDialogProps {
  open: boolean;
  /** Judul dialog yang ditampilkan — bisa disesuaikan per konteks. */
  title?: string;
  /** Nilai default caption yang diisi dari data media asli. */
  defaultCaption: string;
  /** Nilai default credit yang diisi dari data media asli. */
  defaultCredit: string;
  /** Dipanggil saat user mengklik "Konfirmasi". */
  onConfirm: (attribution: ArticleAttribution) => void;
  /** Dipanggil saat user mengklik "Batal" atau menutup dialog. */
  onCancel: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Dialog untuk mengisi caption dan credit gambar yang spesifik untuk artikel ini.
 *
 * Nilai yang diisi di sini TIDAK mengubah data media asli di koleksi media —
 * hanya disimpan di dokumen artikel sebagai bagian dari objek `ArticleMedia`.
 */
export default function ArticleAttributionDialog({
  open,
  title = "Atribusi Gambar untuk Artikel Ini",
  defaultCaption,
  defaultCredit,
  onConfirm,
  onCancel,
}: ArticleAttributionDialogProps) {
  const [caption, setCaption] = useState(defaultCaption);
  const [credit, setCredit] = useState(defaultCredit);

  // Reset nilai setiap kali dialog dibuka dengan default baru
  useEffect(() => {
    if (open) {
      setCaption(defaultCaption);
      setCredit(defaultCredit);
    }
  }, [open, defaultCaption, defaultCredit]);

  const handleConfirm = () => {
    onConfirm({ caption: caption.trim(), credit: credit.trim() });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && e.ctrlKey) {
      handleConfirm();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="max-w-md" onKeyDown={handleKeyDown}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Isi caption dan credit khusus untuk artikel ini. Nilai ini tidak
            mengubah data media asli di perpustakaan media.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Caption Artikel */}
          <div className="space-y-2">
            <Label htmlFor="article-attr-caption">
              Caption{" "}
              <span className="text-xs text-muted-foreground font-normal">
                (opsional, maks. 300 karakter)
              </span>
            </Label>
            <Textarea
              id="article-attr-caption"
              placeholder="Deskripsi gambar untuk artikel ini…"
              value={caption}
              onChange={(e) => setCaption(e.target.value.slice(0, 300))}
              rows={3}
              className="resize-none focus-visible:border-hijauSawah focus-visible:ring-hijauSawah/25"
            />
            <p className="text-xs text-muted-foreground text-right">
              {caption.length}/300
            </p>
          </div>

          {/* Credit / Taken By Artikel */}
          <div className="space-y-2">
            <Label htmlFor="article-attr-credit">
              Credit / Sumber{" "}
              <span className="text-xs text-muted-foreground font-normal">
                (opsional, maks. 100 karakter)
              </span>
            </Label>
            <Input
              id="article-attr-credit"
              placeholder="Nama fotografer atau sumber gambar…"
              value={credit}
              onChange={(e) => setCredit(e.target.value.slice(0, 100))}
              className="focus-visible:border-hijauSawah focus-visible:ring-hijauSawah/25"
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Lewati
          </Button>
          <Button type="button" onClick={handleConfirm}>
            Konfirmasi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
