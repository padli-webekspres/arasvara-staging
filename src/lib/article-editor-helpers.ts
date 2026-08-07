/**
 * Helper client-side untuk operasi artikel di ArticleEditorForm.
 *
 * File ini HANYA berisi fungsi yang aman dijalankan di browser.
 * Jangan impor dependensi server (mongoose, mongodb, dst.) di sini.
 */

import type { ArticleMedia } from "@/types/article";
import type { Editor } from "@tiptap/react";
import { buildTempMediaViewUrl } from "@/lib/media/tempMedia";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Metadata yang disimpan bersama setiap media temp di editorImageKeys. */
interface EditorImageKeyEntry {
  tempMediaId: string;
  meta: {
    caption?: string;
    credit?: string;
    watermark?: boolean;
  };
}

/** Node Tiptap yang sudah di-serialize ke JSON. */
interface TiptapJsonNode {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: TiptapJsonNode[];
}

/** Hasil promote satu media — dikirim sebagai Map dari tempUrl ke data final. */
export interface UploadedMediaEntry {
  mediaId: string;
  url: string;
  filename: string;
}

// ─── Helper: Extract ContentMedia dari Editor ────────────────────────────────

/**
 * Mengekstrak daftar `ArticleMedia` dari semua node `imageFigure` di editor Tiptap.
 *
 * Dipanggil SETELAH `uploadAllPendingMedia` selesai sehingga:
 * - Gambar yang baru di-promote: tempUrl-nya ada di `uploadedMediaMap` → gunakan mediaId final
 * - Gambar existing dari galeri: mediaKey berisi filename → gunakan sebagai mediaId
 *
 * @param editor         Instance Tiptap Editor (bisa null jika belum siap)
 * @param editorImageKeys Daftar tempMediaId untuk gambar pending
 * @param uploadedMediaMap Map dari tempUrl → data media setelah promote selesai
 */
export function extractContentMediaFromEditor(
  editor: Editor | null,
  editorImageKeys: EditorImageKeyEntry[],
  uploadedMediaMap: Map<string, UploadedMediaEntry> = new Map(),
): ArticleMedia[] {
  if (!editor) return [];

  const json = editor.getJSON();
  const result: ArticleMedia[] = [];

  // Traversal rekursif seluruh node di JSON editor
  const traverse = (nodes: TiptapJsonNode[]) => {
    for (const node of nodes) {
      if (node.type === "imageFigure" && node.attrs) {
        const src = String(node.attrs.src ?? "");
        const caption = String(node.attrs.caption ?? "");
        const credit = String(node.attrs.credit ?? "");
        const tempMediaId = String(node.attrs.tempMediaId ?? "");
        const mediaKey = String(node.attrs.mediaKey ?? "");

        // ── Kasus 1: gambar pending yang sudah terupload ──────────────────
        // Lookup via tempUrl yang tersimpan di node saat insert
        const uploaded = uploadedMediaMap.get(src);
        if (uploaded) {
          result.push({
            mediaId: uploaded.mediaId,
            url: uploaded.url,
            caption,
            credit,
          });

        // ── Kasus 2: gambar pending yang belum/tidak terupload ────────────
        // tempMediaId ada tapi tidak ada di uploadedMediaMap — cari di editorImageKeys
        } else if (tempMediaId) {
          const keyEntry = editorImageKeys.find(
            (e) => e.tempMediaId === tempMediaId,
          );
          // Jika ada di uploadedMediaMap via tempUrl (sebelum replace HTML)
          const uploadedByTempUrl = keyEntry
            ? uploadedMediaMap.get(buildTempMediaViewUrl(tempMediaId))
            : undefined;

          if (uploadedByTempUrl) {
            result.push({
              mediaId: uploadedByTempUrl.mediaId,
              url: uploadedByTempUrl.url,
              caption,
              credit,
            });
          } else {
            // Masih pending — simpan dengan tempMediaId sementara
            // (seharusnya tidak terjadi jika uploadAllPendingMedia berhasil)
            result.push({
              mediaId: keyEntry?.tempMediaId ?? tempMediaId,
              url: src,
              caption,
              credit,
            });
          }

        // ── Kasus 3: gambar existing dari galeri ──────────────────────────
        // mediaKey berisi filename — digunakan sebagai mediaId di backend
        } else if (mediaKey || src) {
          result.push({
            mediaId: mediaKey || src,
            url: src,
            caption,
            credit,
          });
        }
      }

      // Rekursi ke child nodes
      if (node.content && node.content.length > 0) {
        traverse(node.content);
      }
    }
  };

  if (json.content) {
    traverse(json.content);
  }

  return result;
}

/**
 * Secara otomatis menyisipkan penanda page break (<div data-page-break="true">)
 * setelah maksimal 11 paragraf (<p>) per halaman.
 *
 * @param html String HTML dari editor
 * @returns HTML baru yang sudah disisipkan page break otomatis
 */
export function autoInsertPageBreaks(html: string): string {
  if (!html) return html;

  // Jika dijalankan di lingkungan server, bypass (hanya untuk keamanan,
  // karena fungsi ini dipanggil dari client-side form)
  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    return html;
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const body = doc.body;

  let paragraphCount = 0;
  // Ambil salinan array children agar iterasi tidak terpengaruh oleh penambahan elemen baru
  const children = Array.from(body.children);

  for (const child of children) {
    if (child.tagName === "P") {
      paragraphCount++;
      if (paragraphCount > 11) {
        // Buat penanda page break yang sama persis strukturnya dengan renderHTML() di PageBreak.ts
        const pageBreak = doc.createElement("div");
        pageBreak.setAttribute("data-page-break", "true");
        pageBreak.className =
          "page-break-marker relative flex items-center my-6 gap-3 select-none";

        const leftDash = doc.createElement("div");
        leftDash.className =
          "flex-1 border-t-2 border-dashed border-muted-foreground/40";

        const label = doc.createElement("span");
        label.className =
          "shrink-0 text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 px-2";
        label.textContent = "Page Break";

        const rightDash = doc.createElement("div");
        rightDash.className =
          "flex-1 border-t-2 border-dashed border-muted-foreground/40";

        pageBreak.appendChild(leftDash);
        pageBreak.appendChild(label);
        pageBreak.appendChild(rightDash);

        // Sisipkan page break tepat sebelum paragraf ke-12
        body.insertBefore(pageBreak, child);

        // Reset hitungan ke 1 karena paragraf saat ini adalah paragraf pertama di halaman baru
        paragraphCount = 1;
      }
    } else if (child.getAttribute("data-page-break") === "true") {
      // Jika menemukan page break manual (baik buatan user atau buatan sistem sebelumnya),
      // reset hitungan paragraf halaman saat ini menjadi 0
      paragraphCount = 0;
    }
  }

  return body.innerHTML;
}

// ─── Helper: resolve featured image existing (submit) ────────────────────────

/**
 * Ambil mediaId + url dari featured image yang sudah ada di form.
 * Mendukung ArticleMedia ({ mediaId }), Media ({ _id }), atau string id/url.
 */
export function resolveExistingFeaturedImageForSubmit(
  featuredImage: unknown,
): { mediaId: string; url: string } | null {
  if (!featuredImage) return null;

  if (typeof featuredImage === "string") {
    const trimmed = featuredImage.trim();
    if (!trimmed) return null;
    const url =
      trimmed.startsWith("http") || trimmed.startsWith("/")
        ? trimmed
        : `/api/media/view?key=${encodeURIComponent(trimmed)}`;
    return { mediaId: trimmed, url };
  }

  if (typeof featuredImage === "object" && featuredImage !== null) {
    const obj = featuredImage as Record<string, unknown>;
    const mediaIdRaw = obj.mediaId ?? obj._id;
    const mediaId =
      typeof mediaIdRaw === "string"
        ? mediaIdRaw.trim()
        : mediaIdRaw != null
          ? String(mediaIdRaw).trim()
          : "";
    if (!mediaId) return null;

    const urlFromObj = typeof obj.url === "string" ? obj.url.trim() : "";
    const url =
      urlFromObj ||
      (typeof obj.filename === "string" && obj.filename
        ? `/api/media/view?key=${encodeURIComponent(obj.filename)}`
        : `/api/media/view?key=${encodeURIComponent(mediaId)}`);

    return { mediaId, url };
  }

  return null;
}
