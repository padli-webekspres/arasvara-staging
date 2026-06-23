import { cn } from "@/lib/utils";
import Image from "next/image";

/** Gambar iklan: cegah drag & highlight seperti asset gambar biasa. */
const AD_IMAGE_NO_DRAG_CLASS = "select-none [-webkit-user-drag:none]" as const;

export interface BaseAdCardProps {
  width: number;
  height: number;
  defaultSrc: string;
  src?: string;
  alt?: string;
  className?: string;
  /**
   * Mengisi tinggi/lebar parent (biasanya wrapper dengan aspect-ratio).
   * Gambar memakai `fill`; tidak menyetel inline aspectRatio pada root.
   */
  fill?: boolean;
  /** Saat true (mis. di dalam `<a>`), aktifkan pointer-events untuk bisa diklik. */
  interactive?: boolean;
}

/**
 * Base komponen untuk Ad Card agar kode tetap DRY (Don't Repeat Yourself).
 * Komponen ini menangani styling, layout, dan properti dasar dari semua varian iklan.
 */
export default function BaseAdCard({
  width,
  height,
  defaultSrc,
  src,
  alt = "Advertisement",
  className,
  fill = false,
  interactive = false,
}: BaseAdCardProps) {
  const pointerClass = interactive
    ? "pointer-events-auto"
    : "pointer-events-none";

  if (fill) {
    return (
      <div
        className={cn(
          "relative h-full w-full min-h-0 overflow-hidden rounded-lg bg-muted border border-border/50 shadow-sm transition-all hover:shadow-md",
          pointerClass,
          className,
        )}
      >
        <div className="absolute top-4 -right-8 w-36 transform rotate-45 bg-black/60 backdrop-blur-sm text-white text-center py-1 text-[10px] font-bold uppercase tracking-wider z-20 shadow-sm pointer-events-none">
          Iklan
        </div>
        <Image
          src={src || defaultSrc}
          alt={alt}
          fill
          draggable={false}
          className={cn("object-cover", AD_IMAGE_NO_DRAG_CLASS)}
          sizes={`(max-width: 1024px) min(100vw, 384px), ${width}px`}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg bg-muted flex items-center justify-center border border-border/50 shadow-sm transition-all hover:shadow-md",
        pointerClass,
        className,
      )}
      style={{ aspectRatio: `${width} / ${height}` }}
    >
      <Image
        src={src || defaultSrc}
        alt={alt}
        draggable={false}
        className={cn("object-cover w-full h-full", AD_IMAGE_NO_DRAG_CLASS)}
        width={width}
        height={height}
        sizes={`(max-width: ${width}px) 100vw, ${width}px`}
      />
    </div>
  );
}
