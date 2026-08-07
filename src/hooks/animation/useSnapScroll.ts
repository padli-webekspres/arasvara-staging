import { useRef } from "react";
import { useGSAP } from "@gsap/react";

/**
 * Generic GSAP snap scroll hook.
 * GSAP/ScrollTrigger di-load dinamis dan dinonaktifkan di mobile /
 * prefers-reduced-motion agar tidak memicu long task + forced reflow.
 */
export function useSnapScroll() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useGSAP(
    () => {
      if (!containerRef.current) return;
      if (typeof window === "undefined") return;

      const prefersReducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      const isMobile = window.matchMedia("(max-width: 767px)").matches;
      if (prefersReducedMotion || isMobile) return;

      let killed = false;
      let st: { kill: () => void } | null = null;
      let cancelDeferred: (() => void) | undefined;

      const setup = async () => {
        const [{ gsap }, { ScrollTrigger }] = await Promise.all([
          import("gsap"),
          import("gsap/ScrollTrigger"),
        ]);
        if (killed || !containerRef.current) return;

        gsap.registerPlugin(ScrollTrigger);

        const panels = gsap.utils.toArray<HTMLElement>(
          ".snap-panel",
          containerRef.current,
        );
        if (panels.length < 2) return;

        st = ScrollTrigger.create({
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
      };

      if (typeof window.requestIdleCallback === "function") {
        const idle = window.requestIdleCallback(() => {
          void setup();
        });
        cancelDeferred = () => window.cancelIdleCallback(idle);
      } else {
        const timeout = setTimeout(() => {
          void setup();
        }, 1200);
        cancelDeferred = () => clearTimeout(timeout);
      }

      return () => {
        killed = true;
        cancelDeferred?.();
        st?.kill();
      };
    },
    { scope: containerRef },
  );

  return containerRef;
}
