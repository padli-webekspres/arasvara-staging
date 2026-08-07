"use client";

import { useState, useEffect, useCallback, useRef, type CSSProperties } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import HeroCard from "./HeroCard";
import { SectionArticleItem } from "@/types/articleSection";
import { ArticleListResponse } from "@/types/article";

interface HeadlineSliderProps {
  articles: SectionArticleItem[];
}

/**
 * Headline slider tanpa GSAP di critical path.
 * Posisi slide memakai CSS transform/opacity agar mobile tidak layout-thrash.
 */
const HeadlineSlider = ({ articles }: HeadlineSliderProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartX = useRef<number | null>(null);
  const dragEndX = useRef<number | null>(null);

  const total = articles.length;

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % total);
  }, [total]);

  const goToPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + total) % total);
  }, [total]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const apply = () => setIsDesktop(mediaQuery.matches);
    apply();
    mediaQuery.addEventListener("change", apply);
    return () => mediaQuery.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (!isAutoPlaying || total <= 1 || isDragging) return;
    const interval = setInterval(goToNext, 5000);
    return () => clearInterval(interval);
  }, [isAutoPlaying, total, goToNext, isDragging]);

  /**
   * Desktop: posisi pakai `left` (relatif container), bukan translateX(%).
   * translateX(%) dihitung dari lebar elemen sendiri — kartu 40% hanya
   * bergeser ~24% container → overlapping (bug di ~1280px).
   */
  const getSlideStyle = (index: number): CSSProperties => {
    const rel = (index - currentIndex + total) % total;

    if (isDesktop) {
      if (rel === 0) {
        return {
          left: "0",
          width: "calc(60% - 8px)",
          transform: "translateX(0)",
          opacity: 1,
          zIndex: 10,
        };
      }
      if (rel === 1) {
        return {
          // Card 60% + gap 16px
          left: "calc(60% + 8px)",
          width: "calc(40% - 8px)",
          transform: "translateX(0)",
          opacity: 1,
          zIndex: 10,
        };
      }
      if (rel === 2) {
        return {
          left: "calc(100% + 16px)",
          width: "calc(40% - 8px)",
          transform: "translateX(0)",
          opacity: 0,
          zIndex: 5,
        };
      }
      if (rel === total - 1) {
        return {
          left: "0",
          width: "calc(60% - 8px)",
          transform: "translateX(calc(-100% - 16px))",
          opacity: 0,
          zIndex: 5,
        };
      }
      return {
        left: "100%",
        width: "40%",
        transform: "translateX(0)",
        opacity: 0,
        zIndex: 1,
      };
    }

    // Mobile: width 100% → translateX(%) = lebar container (aman)
    if (rel === 0) {
      return {
        left: "0",
        transform: "translateX(0%)",
        width: "100%",
        opacity: 1,
        zIndex: 10,
      };
    }
    if (rel === total - 1) {
      return {
        left: "0",
        transform: "translateX(-100%)",
        width: "100%",
        opacity: 0,
        zIndex: 5,
      };
    }
    return {
      left: "0",
      transform: "translateX(100%)",
      width: "100%",
      opacity: 0,
      zIndex: 1,
    };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    setIsAutoPlaying(false);
    dragStartX.current = e.clientX;
    dragEndX.current = e.clientX;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || dragStartX.current === null) return;
    dragEndX.current = e.clientX;
  };

  const handlePointerUpOrLeave = () => {
    if (!isDragging) return;

    setIsDragging(false);
    setIsAutoPlaying(true);

    if (dragStartX.current !== null && dragEndX.current !== null) {
      const deltaX = dragStartX.current - dragEndX.current;
      const SWIPE_THRESHOLD = 50;

      if (deltaX > SWIPE_THRESHOLD) {
        goToNext();
      } else if (deltaX < -SWIPE_THRESHOLD) {
        goToPrev();
      }
    }

    dragStartX.current = null;
    dragEndX.current = null;
  };

  if (!articles || total === 0) return null;

  return (
    <section
      className="relative w-full overflow-hidden rounded-xl bg-background"
      onMouseEnter={() => setIsAutoPlaying(false)}
      onMouseLeave={() => setIsAutoPlaying(true)}
    >
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUpOrLeave}
        onPointerCancel={handlePointerUpOrLeave}
        onPointerLeave={handlePointerUpOrLeave}
        className={`relative w-full h-[400px] lg:h-[500px] overflow-hidden select-none touch-pan-y ${
          isDragging ? "cursor-grabbing" : "cursor-grab"
        }`}
      >
        {articles.map((article, index) => (
          <div
            key={article._id || index}
            id={`headline-card-${index}`}
            className="absolute top-0 left-0 h-full pointer-events-none transition-[transform,opacity,width,left] duration-700 ease-in-out will-change-transform"
            style={getSlideStyle(index)}
          >
            <div
              className="w-full h-full pointer-events-auto"
              onDragStart={(e) => e.preventDefault()}
            >
              <HeroCard
                article={article.article as ArticleListResponse}
                variant="dark"
                size="full"
              />
            </div>
          </div>
        ))}
      </div>

      {articles.length > 1 && (
        <>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Headline sebelumnya"
            className="absolute left-1 md:left-2 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 text-white z-50 rounded-full h-11 w-11"
            onClick={goToPrev}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            aria-label="Headline selanjutnya"
            className="absolute right-1 md:right-2 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 text-white z-50 rounded-full h-11 w-11"
            onClick={goToNext}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>

          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 z-50">
            {articles.map((_, index) => (
              <button
                key={index}
                type="button"
                aria-label={`Headline ${index + 1} dari ${articles.length}`}
                onClick={() => setCurrentIndex(index)}
                className="min-w-11 min-h-11 flex items-center justify-center rounded-full transition-all duration-300"
              >
                <span
                  className={`block h-2 rounded-full transition-all ${
                    index === currentIndex
                      ? "w-6 bg-white"
                      : index === (currentIndex + 1) % total
                        ? "w-2 bg-white/70"
                        : "w-2 bg-white/40"
                  }`}
                />
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
};

export default HeadlineSlider;
