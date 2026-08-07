/**
 * Ekstensi Tiptap: ImageFigure
 *
 * Custom block node yang merender satu gambar beserta captionnya sebagai satu
 * unit atom (`<figure>`). Karena bersifat atom, menghapus node ini akan
 * menghapus gambar DAN captionnya sekaligus.
 *
 * Struktur HTML output:
 * ```html
 * <figure data-image-figure="true">
 *   <img src="..." alt="..." />
 *   <figcaption>Caption teks…</figcaption>
 * </figure>
 * ```
 *
 * Node ini HANYA dipakai saat insert baru via toolbar/picker.
 * Gambar lama dengan tag `<img>` biasa di konten artikel tetap dirender
 * oleh ekstensi TiptapImage standar (kompatibilitas backward).
 */

import { Node, mergeAttributes } from "@tiptap/core";

// ─── Atribut Node ─────────────────────────────────────────────────────────────

export interface ImageFigureAttrs {
  /** URL gambar — blob URL (pending) atau URL CDN/server (existing). */
  src: string;
  /** Caption khusus artikel yang ditampilkan sebagai figcaption. */
  caption: string;
  /** Credit / sumber gambar (tidak ditampilkan di figcaption, disimpan di data atribut). */
  credit: string;
  /**
   * Filename media di server — digunakan saat submit untuk memetakan
   * gambar ini ke objek `ArticleMedia` yang tepat.
   * Untuk pending media, ini berisi tempMediaId sementara.
   */
  mediaKey: string;
  /**
   * ID media temp di object storage (`temp/`) untuk gambar yang belum
   * dipromosikan. Akan dikosongkan setelah promote berhasil.
   */
  tempMediaId: string;
}

// ─── Command Declaration ──────────────────────────────────────────────────────

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    imageFigure: {
      /**
       * Menyisipkan node ImageFigure ke posisi kursor saat ini.
       * @param attrs Atribut gambar dan caption
       */
      setImageFigure: (attrs: Partial<ImageFigureAttrs>) => ReturnType;
    };
  }
}

// ─── Extension ────────────────────────────────────────────────────────────────

export const ImageFigure = Node.create({
  name: "imageFigure",
  group: "block",

  /**
   * Atom = true berarti seluruh node diperlakukan sebagai satu unit.
   * Cursor tidak bisa masuk ke dalam node, dan menghapus node
   * akan menghapus seluruh isinya (img + figcaption).
   */
  atom: true,

  // ─── Atribut ──────────────────────────────────────────────────────────────

  addAttributes() {
    return {
      src: {
        default: "",
        parseHTML: (element) =>
          element.querySelector("img")?.getAttribute("src") ?? "",
      },
      caption: {
        default: "",
        parseHTML: (element) =>
          element.querySelector("figcaption")?.textContent?.trim() ?? "",
      },
      credit: {
        default: "",
        parseHTML: (element) =>
          element.getAttribute("data-credit") ?? "",
      },
      mediaKey: {
        default: "",
        parseHTML: (element) =>
          element.getAttribute("data-media-key") ?? "",
      },
      tempMediaId: {
        default: "",
        parseHTML: (element) =>
          element.getAttribute("data-temp-media-id") ?? "",
      },
    };
  },

  // ─── Parse dari HTML ──────────────────────────────────────────────────────

  parseHTML() {
    return [
      {
        tag: 'figure[data-image-figure="true"]',
      },
    ];
  },

  // ─── Render ke HTML ───────────────────────────────────────────────────────

  renderHTML({ HTMLAttributes }) {
    const attrs = HTMLAttributes as ImageFigureAttrs;

    const figureAttrs = mergeAttributes({
      "data-image-figure": "true",
      "data-credit": attrs.credit || "",
      "data-media-key": attrs.mediaKey || "",
      "data-temp-media-id": attrs.tempMediaId || "",
    });

    const imgAttrs = {
      src: attrs.src,
      alt: attrs.caption || "",
      class: "rounded-lg max-w-full w-full",
    };

    // Figcaption hanya dirender jika caption tidak kosong
    if (attrs.caption && attrs.caption.trim()) {
      return ["figure", figureAttrs, ["img", imgAttrs], ["figcaption", {}, attrs.caption]];
    }

    return ["figure", figureAttrs, ["img", imgAttrs]];
  },

  // ─── Commands ─────────────────────────────────────────────────────────────

  addCommands() {
    return {
      setImageFigure:
        (attrs: Partial<ImageFigureAttrs>) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              src: attrs.src ?? "",
              caption: attrs.caption ?? "",
              credit: attrs.credit ?? "",
              mediaKey: attrs.mediaKey ?? "",
              tempMediaId: attrs.tempMediaId ?? "",
            },
          });
        },
    };
  },
});

export default ImageFigure;
