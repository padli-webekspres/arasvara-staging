import { useEffect, useRef } from "react";

/**
 * GSAP snap scroll — plugin di-import dinamis, dilewati di mobile /
 * prefers-reduced-motion. Import gagal = scroll biasa (bukan CSS snap baru).
 */
export function useSnapScroll() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof window === "undefined") return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    if (prefersReducedMotion || isMobile) return;

    let killed = false;
    let st: { kill: () => void } | null = null;
    let cancelDeferred: (() => void) | undefined;

    const setup = async () => {
      try {
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
      } catch {
        // ponytail: snap opsional; gagal unduh GSAP = scroll native.
      }
    };

    if (typeof window.requestIdleCallback === "function") {
      const idle = window.requestIdleCallback(() => {
        void setup();
      });
      cancelDeferred = () => window.cancelIdleCallback(idle);
    } else {
      const timeout = window.setTimeout(() => {
        void setup();
      }, 1200);
      cancelDeferred = () => window.clearTimeout(timeout);
    }

    return () => {
      killed = true;
      cancelDeferred?.();
      st?.kill();
    };
  }, []);

  return containerRef;
}
