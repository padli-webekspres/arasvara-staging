import Image from "next/image";
import { HERO_MONOGRAM_SRC } from "@/lib/homepage-lcp";

/**
 * Logo monogram hero — Server Component untuk LCP.
 * Di-render dari page.tsx agar preload + fetchPriority masuk dokumen awal.
 */
export default function HeroMonogram() {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
      <Image
        src={HERO_MONOGRAM_SRC}
        alt="Arasvara Monogram"
        className="h-12 md:h-20 lg:h-24 object-contain select-none"
        draggable={false}
        priority
        fetchPriority="high"
        width={500}
        height={500}
      />
    </div>
  );
}
