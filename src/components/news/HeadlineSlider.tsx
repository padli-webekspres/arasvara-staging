"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import HeroCard from "./HeroCard";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import TitleHomepage from "../homepage/TitleHomepage";
import { SectionArticleItem } from "@/types/articleSection";
import { ArticleListResponse } from "@/types/article";

if (typeof window !== "undefined") {
  gsap.registerPlugin(useGSAP);
}

interface HeadlineSliderProps {
  articles: SectionArticleItem[];
}

const HeadlineSlider = ({ articles }: HeadlineSliderProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [isDragging, setIsDragging] = useState(false); // State visual untuk kursor
  const containerRef = useRef<HTMLDivElement>(null);

  // Refs untuk menghitung jarak swipe tanpa memicu re-render
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
    if (!isAutoPlaying || total <= 1 || isDragging) return;
    const interval = setInterval(goToNext, 5000);
    return () => clearInterval(interval);
  }, [isAutoPlaying, total, goToNext, isDragging]);

  // Logika Utama GSAP Slider (Tetap sama, tidak ada yang diubah)
  useGSAP(
    () => {
      if (!containerRef.current || total === 0) return;

      let mm = gsap.matchMedia();

      // 1. DESKTOP LOGIC
      mm.add("(min-width: 1024px)", () => {
        articles.forEach((_, i) => {
          const card = containerRef.current!.querySelector(
            `#headline-card-${i}`,
          );
          if (!card) return;

          const rel = (i - currentIndex + total) % total;

          let left = "100%";
          let width = "40%";
          let opacity = 0;
          let zIndex = 1;

          if (rel === 0) {
            left = "0%";
            width = "calc(60% - 8px)";
            opacity = 1;
            zIndex = 10;
          } else if (rel === 1) {
            left = "calc(60% + 8px)";
            width = "calc(40% - 8px)";
            opacity = 1;
            zIndex = 10;
          } else if (rel === 2) {
            left = "calc(100% + 16px)";
            width = "calc(40% - 8px)";
            opacity = 0;
            zIndex = 5;
          } else if (rel === total - 1) {
            left = "calc(-60% - 16px)";
            width = "calc(60% - 8px)";
            opacity = 0;
            zIndex = 5;
          }

          gsap.to(card, {
            left,
            width,
            opacity,
            zIndex,
            duration: 0.8,
            ease: "power3.inOut",
          });
        });
      });

      // 2. MOBILE LOGIC
      mm.add("(max-width: 1023px)", () => {
        articles.forEach((_, i) => {
          const card = containerRef.current!.querySelector(
            `#headline-card-${i}`,
          );
          if (!card) return;

          const rel = (i - currentIndex + total) % total;
          let left = "100%";
          let opacity = 0;

          if (rel === 0) {
            left = "0%";
            opacity = 1;
          } else if (rel === total - 1) {
            left = "-100%";
            opacity = 0;
          }

          gsap.to(card, {
            left,
            width: "100%",
            opacity,
            duration: 0.7,
            ease: "power3.inOut",
          });
        });
      });

      return () => mm.revert();
    },
    { scope: containerRef, dependencies: [currentIndex, total] },
  );

  // === FUNGSI DRAG / SWIPE ===
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
      const SWIPE_THRESHOLD = 50; // Minimal geser 50px untuk memicu pindah kartu

      if (deltaX > SWIPE_THRESHOLD) {
        goToNext(); // Geser ke kiri (Next)
      } else if (deltaX < -SWIPE_THRESHOLD) {
        goToPrev(); // Geser ke kanan (Prev)
      }
    }

    // Reset
    dragStartX.current = null;
    dragEndX.current = null;
  };

  if (!articles || total === 0) return null;

  return (
    <>
      <section
        className="relative w-full overflow-hidden rounded-xl bg-background"
        onMouseEnter={() => setIsAutoPlaying(false)}
        onMouseLeave={() => setIsAutoPlaying(true)}
      >
        <div
          ref={containerRef}
          // Tambahkan pointer events dan kursor visual di sini
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
              className="absolute top-0 h-full pointer-events-none"
              style={{
                left: "100%",
                opacity: 0,
              }}
            >
              {/* Tambahkan onDragStart di sini */}
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

        {/* Navigation Buttons */}
        {articles.length > 1 && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 text-white z-50 rounded-full"
              onClick={goToPrev}
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 text-white z-50 rounded-full"
              onClick={goToNext}
            >
              <ChevronRight className="h-6 w-6" />
            </Button>

            {/* Indicators */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 z-50">
              {articles.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentIndex(index)}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${
                    index === currentIndex
                      ? "bg-white w-6"
                      : index === (currentIndex + 1) % total
                        ? "bg-white/70"
                        : "bg-white/40"
                  }`}
                />
              ))}
            </div>
          </>
        )}

        {/* Advertisement indicator */}
        {/* <div className="absolute top-4 right-4 text-xs text-white z-10 pointer-events-none">
          <span className="bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-md font-medium tracking-wide">
            Headlines — Updated hourly
          </span>
        </div> */}
      </section>
    </>
  );
};

export default HeadlineSlider;
