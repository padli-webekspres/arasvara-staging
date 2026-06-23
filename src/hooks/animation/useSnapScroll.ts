import { useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

/**
 * Generic GSAP snap scroll hook.
 * Pasang ref ini ke container wrapper, lalu tambahkan class `snap-panel`
 * ke setiap child section yang ingin di-snap.
 *
 * Cocok dipakai di beberapa halaman (homepage, about, dst.) tanpa duplikasi.
 */
export function useSnapScroll() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useGSAP(
    () => {
      if (!containerRef.current) return;

      const panels = gsap.utils.toArray<HTMLElement>(
        ".snap-panel",
        containerRef.current,
      );

      if (panels.length < 2) return;

      const st = ScrollTrigger.create({
        trigger: containerRef.current,
        start: "top top",
        end: "bottom bottom",
        refreshPriority: -1,
        snap: {
          snapTo: 1 / (panels.length - 1),
          duration: { min: 0.3, max: 1 },
          delay: 0,
          ease: "power1.out",
        },
      });

      return () => {
        st.kill();
      };
    },
    { scope: containerRef },
  );

  return containerRef;
}
