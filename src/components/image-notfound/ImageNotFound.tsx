import Image from "next/image";
import * as React from "react";

import { cn } from "@/lib/utils";

const LOGO_SRC =
  "/logo-arasvara/main-logo/main-logo-hitam-gema.png" as const;

export interface ImageNotFoundProps
  extends Omit<React.ComponentPropsWithoutRef<"div">, "children"> {
  /**
   * Tema placeholder:
   * - `light`: abu-abu terang (default)
   * - `dark`: abu lebih dalam untuk konteks gelap; logo tetap hitam (kontras dijaga)
   */
  variant?: "light" | "dark";
  /** Nilai CSS `aspect-ratio`. Default persegi `1 / 1`. Diabaikan jika `fill`. */
  aspectRatio?: React.CSSProperties["aspectRatio"];
  /**
   * Mengisi parent bertipe `relative` (mis. kotak `aspect-video`).
   * Menyetel `absolute inset-0` dan tidak memakai `aspect-ratio` pada wrapper.
   */
  fill?: boolean;
}

/**
 * Placeholder saat gambar tidak ada / gagal dimuat.
 * Latar abu-abu dengan logo Arasvara hitam di tengah.
 */
export function ImageNotFound({
  className,
  variant = "light",
  aspectRatio = "1 / 1",
  fill = false,
  style,
  ...props
}: ImageNotFoundProps) {
  return (
    <div
      role="img"
      aria-label="Gambar tidak tersedia"
      className={cn(
        "relative isolate flex w-full shrink-0 items-center justify-center overflow-hidden rounded-md border",
        variant === "light" &&
          "border-neutral-200/70 bg-neutral-100",
        variant === "dark" &&
          "border-neutral-500/35 bg-neutral-400",
        fill && "absolute inset-0 size-full min-h-0 rounded-[inherit]",
        className,
      )}
      style={{
        ...(fill ? {} : { aspectRatio }),
        ...style,
      }}
      {...props}
    >
      <Image
        src={LOGO_SRC}
        alt=""
        fill
        className="object-contain p-[min(18%,2.5rem)]"
        sizes="(max-width: 768px) 100vw, 480px"
        priority={false}
      />
    </div>
  );
}
