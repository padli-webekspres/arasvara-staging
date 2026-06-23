"use client";

import React from "react";
import Image from "next/image";
import { useSponsors } from "@/hooks/useSponsor";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SponsoredByCarouselProps {
  className?: string;
}

const SponsoredByCarousel: React.FC<SponsoredByCarouselProps> = ({
  className,
}) => {
  const { data: sponsorsData, isLoading } = useSponsors();
  const logos = sponsorsData || [];

  if (isLoading) {
    return (
      <div className="w-full flex justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (logos.length === 0) {
    return null;
  }

  // LOGIKA ADAPTIF:
  // Jika logo <= 5, jadikan 1 baris. Jika > 5, bagi dua.
  const showTwoRows = logos.length > 5;
  const half = Math.ceil(logos.length / 2);

  const rawRow1 = showTwoRows ? logos.slice(0, half) : logos;
  const rawRow2 = showTwoRows ? logos.slice(half) : [];

  // Fungsi untuk memastikan array cukup panjang agar menutupi layar.
  // Translasi CSS -50% membutuhkan setidaknya setengah div lebih lebar dari layar.
  const getExtendedSet = (arr: typeof logos) => {
    if (arr.length === 0) return [];
    let extended = [...arr];
    // Minimal 8 item dalam 1 set (total nanti akan jadi 16 item saat digabungkan)
    while (extended.length < 8) {
      extended = [...extended, ...arr];
    }
    return extended;
  };

  const finalRow1 = getExtendedSet(rawRow1);
  const finalRow2 = getExtendedSet(rawRow2);

  // Kita gandakan persis 2 kali untuk efek infinite loop (-50%)
  const row1Display = [...finalRow1, ...finalRow1];
  const row2Display = [...finalRow2, ...finalRow2];

  return (
    <section
      className={cn(
        "w-full overflow-hidden bg-white dark:bg-zinc-950 flex flex-col gap-4 sm:gap-6 md:gap-8 hover-pause",
        className,
      )}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes marqueeLeft {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes marqueeRight {
          0% { transform: translateX(-50%); }
          100% { transform: translateX(0); }
        }
        .animate-marquee-left {
          animation: marqueeLeft 30s linear infinite;
        }
        .animate-marquee-right {
          animation: marqueeRight 30s linear infinite;
        }
        /* Opsional: pause saat hover */
        .hover-pause:hover .animate-marquee-left,
        .hover-pause:hover .animate-marquee-right {
          animation-play-state: paused;
        }
      `,
        }}
      />

      {/* Baris 1: Bergerak ke Kiri */}
      <div className="w-full relative flex items-center">
        <div className="flex gap-4 sm:gap-6 md:gap-8 lg:gap-12 w-max px-4 animate-marquee-left">
          {row1Display.map((logo, index) => (
            <div
              key={`row1-${index}`}
              className="w-[25vw] sm:w-[18vw] md:w-[12vw] lg:w-[9vw] shrink-0 flex items-center justify-center relative aspect-square group cursor-pointer"
            >
              <Image
                unoptimized
                src={logo.image_url}
                alt={logo.name}
                fill
                className="object-cover grayscale transition-all duration-300 group-hover:grayscale-0 group-hover:scale-110 group-hover:-rotate-2"
                sizes="(max-width: 640px) 25vw, (max-width: 768px) 18vw, (max-width: 1024px) 12vw, 9vw"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Baris 2: Bergerak ke Kanan (Hanya jika memenuhi syarat showTwoRows) */}
      {showTwoRows && row2Display.length > 0 && (
        <div className="w-full relative flex items-center mt-2 md:mt-4">
          <div className="flex gap-4 sm:gap-6 md:gap-8 lg:gap-12 w-max px-4 animate-marquee-right">
            {row2Display.map((logo, index) => (
              <div
                key={`row2-${index}`}
                className="w-[25vw] sm:w-[18vw] md:w-[12vw] lg:w-[9vw] shrink-0 flex items-center justify-center relative aspect-square group cursor-pointer"
              >
                <Image
                  unoptimized
                  src={logo.image_url}
                  alt={logo.name}
                  fill
                  className="object-cover bg-amber-200 grayscale transition-all duration-300 group-hover:grayscale-0 group-hover:scale-110 group-hover:rotate-2"
                  sizes="(max-width: 640px) 25vw, (max-width: 768px) 18vw, (max-width: 1024px) 12vw, 9vw"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};

export default SponsoredByCarousel;
