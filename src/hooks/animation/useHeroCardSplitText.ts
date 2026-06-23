// useHeroCardSplitText.ts
import { useRef, useEffect } from "react";
import { gsap } from "gsap";
import { SplitText } from "gsap/SplitText";

if (typeof window !== "undefined" && gsap && SplitText) {
  gsap.registerPlugin(SplitText);
}

const MIN_TITLE_WIDTH_PX = 160;

/**
 * Animasi masuk judul HeroCard — split per kata (bukan per karakter / baris)
 * agar teks tetap melebar mengikuti lebar container (2/3 kartu).
 */
export function useHeroCardSplitText(titleKey?: string) {
  const parentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!parentRef.current) return;

    const title =
      parentRef.current.querySelector<HTMLElement>(".titleHeroCard");
    if (!title) return;

    let split: SplitText | null = null;
    let anim: gsap.core.Tween | null = null;
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

    const runSplitAnimation = () => {
      if (cancelled || !title.isConnected) return false;
      if (title.offsetWidth < MIN_TITLE_WIDTH_PX) return false;

      cleanupSplit();

      // Hanya "words" — hindari konflik layout dengan line-clamp / -webkit-box
      split = new SplitText(title, { type: "words" });
      gsap.set(split.words, { y: 28, opacity: 0 });

      anim = gsap.to(split.words, {
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
      if (runSplitAnimation()) return;
      if (attempt < 8) {
        requestAnimationFrame(() => tryStartWhenReady(attempt + 1));
      }
    };

    if (typeof window !== "undefined" && "IntersectionObserver" in window) {
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
