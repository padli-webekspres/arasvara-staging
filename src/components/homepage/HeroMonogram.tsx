import { HERO_MONOGRAM_SRC } from "@/lib/homepage-lcp";

type HeroMonogramProps = {
  /** true jika monogram kandidat LCP utama (mis. tanpa poster hero). */
  priority?: boolean;
};

/**
 * Logo monogram hero — Server Component, plain <img> eager.
 * `priority` mengatur fetchPriority: high hanya bila ini target LCP utama.
 */
export default function HeroMonogram({ priority = false }: HeroMonogramProps) {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
      {/* eslint-disable-next-line @next/next/no-img-element -- ukuran display kecil; hindari lazy next/image */}
      <img
        src={HERO_MONOGRAM_SRC}
        alt="Arasvara Monogram"
        width={400}
        height={63}
        decoding="async"
        fetchPriority={priority ? "high" : undefined}
        draggable={false}
        className="h-12 md:h-20 lg:h-24 w-auto object-contain select-none"
      />
    </div>
  );
}
