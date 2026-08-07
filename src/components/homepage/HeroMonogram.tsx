import { HERO_MONOGRAM_SRC } from "@/lib/homepage-lcp";

/**
 * Logo monogram hero — Server Component (bukan target LCP).
 * Aset w400 WebP (~8 KiB) agar tidak bersaing bandwidth dengan hero poster.
 * Plain <img> eager (bukan next/image lazy default).
 */
export default function HeroMonogram() {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
      {/* eslint-disable-next-line @next/next/no-img-element -- ukuran display kecil; hindari lazy next/image */}
      <img
        src={HERO_MONOGRAM_SRC}
        alt="Arasvara Monogram"
        width={400}
        height={63}
        decoding="async"
        fetchPriority="low"
        draggable={false}
        className="h-12 md:h-20 lg:h-24 w-auto object-contain select-none"
      />
    </div>
  );
}
