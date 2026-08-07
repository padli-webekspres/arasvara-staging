// useHeroCardSplitText.ts
import { useRef, useEffect } from "react";

const MIN_TITLE_WIDTH_PX = 160;

/**
 * Animasi masuk judul HeroCard — GSAP/SplitText di-import dinamis
 * dan hanya di desktop (mobile skip untuk hemat main thread).
 */
export function useHeroCardSplitText(titleKey?: string) {
  const parentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!parentRef.current) return;
    if (typeof window === "undefined") return;

    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (isMobile || prefersReducedMotion) return;

    const title =
      parentRef.current.querySelector<HTMLElement>(".titleHeroCard");
    if (!title) return;

    let split: { revert: () => void; words: Element[] } | null = null;
    let anim: { kill: () => void } | null = null;
    let observer: IntersectionObserver | null = null;
    let cancelled = false;

    const cleanupSplit = () => {
      if (anim) {
        anim.kill();
        anim = null;
      }
      if (split) {
        split.revert();
        split = null;
      }
    };

    const runSplitAnimation = async () => {
      if (cancelled || !title.isConnected) return false;
      if (title.offsetWidth < MIN_TITLE_WIDTH_PX) return false;

      cleanupSplit();

      const [{ gsap }, { SplitText }] = await Promise.all([
        import("gsap"),
        import("gsap/SplitText"),
      ]);
      if (cancelled || !title.isConnected) return false;

      gsap.registerPlugin(SplitText);
      const nextSplit = new SplitText(title, { type: "words" });
      split = nextSplit;
      gsap.set(nextSplit.words, { y: 28, opacity: 0 });

      anim = gsap.to(nextSplit.words, {
        y: 0,
        opacity: 1,
        duration: 0.55,
        ease: "power3.out",
        stagger: 0.06,
        overwrite: "auto",
      });

      return true;
    };

    const tryStartWhenReady = (attempt = 0) => {
      void runSplitAnimation().then((ok) => {
        if (ok || attempt >= 8) return;
        requestAnimationFrame(() => tryStartWhenReady(attempt + 1));
      });
    };

    if ("IntersectionObserver" in window) {
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            requestAnimationFrame(() => tryStartWhenReady());
            observer?.unobserve(entry.target);
          });
        },
        { threshold: 0.2 },
      );
      observer.observe(title);
    } else {
      tryStartWhenReady();
    }

    return () => {
      cancelled = true;
      observer?.disconnect();
      cleanupSplit();
    };
  }, [titleKey]);

  return parentRef;
}
