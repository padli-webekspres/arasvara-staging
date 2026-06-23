import { useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

if (typeof window !== "undefined" && gsap && ScrollTrigger) {
  gsap.registerPlugin(ScrollTrigger);
}

export function useHorizontalScroll() {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!containerRef.current || !trackRef.current) return;

      const track = trackRef.current;

      // Hitung jarak geser: Total lebar seluruh item dikurangi lebar layar saat ini
      const getScrollAmount = () => track.scrollWidth - window.innerWidth;

      const tween = gsap.to(track, {
        x: () => -getScrollAmount(), // Geser ke kiri sebesar sisa lebar elemen
        ease: "none", // Wajib "none" agar pergerakan selaras dengan scroll mouse
        scrollTrigger: {
          trigger: containerRef.current,
          pin: true, // Kunci layar
          scrub: 1, // Efek smooth delay saat scroll. Ubah ke `true` jika ingin instan
          // Durasi pin sama dengan jarak geser agar kecepatannya 1:1 natural
          end: () => `+=${getScrollAmount()}`,
          invalidateOnRefresh: true, // Hitung ulang jika layar di-resize
        },
      });

      // Cleanup
      return () => {
        tween.kill();
      };
    },
    { scope: containerRef },
  );

  return { containerRef, trackRef };
}
