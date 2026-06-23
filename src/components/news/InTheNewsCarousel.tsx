import React, { useCallback, useEffect, useState } from "react";
import { Article } from "@/types/article";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import FeaturedCard from "./FeaturedCard";

interface InTheNewsCarouselProps {
  articles: Article[];
}

const InTheNewsCarousel = ({ articles }: InTheNewsCarouselProps) => {
  // Tambahkan tipe props
  const typedArticles: Article[] = articles;
  // Responsive slidesToScroll
  const getSlidesToScroll = () => {
    if (typeof window === "undefined") return 1;
    if (window.innerWidth >= 1024) return 2;
    return 1;
  };

  const [slidesToScroll, setSlidesToScroll] = useState(getSlidesToScroll());
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: false,
    align: "start",
    slidesToScroll,
    containScroll: "trimSnaps", // mencegah scroll lebih dari jumlah artikel
    dragFree: true, // smooth scroll
    // speed: 10,
  });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  // Responsive slides per view
  const getSlidesToShow = () => {
    if (typeof window === "undefined") return 1;
    if (window.innerWidth >= 1024) return 4;
    if (window.innerWidth >= 640) return 2;
    return 2;
  };
  const [slidesToShow, setSlidesToShow] = useState(getSlidesToShow());

  // Update navigation state
  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
    setCanScrollPrev(emblaApi.canScrollPrev());
    setCanScrollNext(emblaApi.canScrollNext());
  }, [emblaApi]);

  // Autoplay
  useEffect(() => {
    if (!emblaApi || !isAutoPlaying) return;
    const interval = setInterval(() => {
      if (emblaApi.canScrollNext()) {
        emblaApi.scrollNext();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [emblaApi, isAutoPlaying]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on("select", onSelect);
    onSelect();
    // Responsive: update slidesToScroll & slidesToShow on resize
    const handleResize = () => {
      setSlidesToScroll(getSlidesToScroll());
      setSlidesToShow(getSlidesToShow());
      emblaApi.reInit();
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [emblaApi, onSelect]);

  if (!articles || articles.length === 0) return null;

  // Custom Scrollbar State
  const [scrollProgress, setScrollProgress] = useState(0);
  const [scrollbarWidth, setScrollbarWidth] = useState(0);
  const [scrollbarLeft, setScrollbarLeft] = useState(0);
  const trackRef = React.useRef<HTMLDivElement | null>(null);
  const thumbRef = React.useRef<HTMLDivElement | null>(null);

  // Update progress bar
  useEffect(() => {
    if (!emblaApi) return;
    let rafId: any;
    const updateProgress = () => {
      //   const progress = emblaApi.scrollProgress();
      const progress = Math.max(0, Math.min(1, emblaApi.scrollProgress()));
      setScrollProgress(Math.round(progress * 100));
      const totalSlides = articles.length;
      const thumbW = slidesToShow / totalSlides;
      setScrollbarWidth(thumbW);
      setScrollbarLeft(Math.round(progress * (100 - thumbW * 100)));
      rafId = requestAnimationFrame(updateProgress);
    };
    rafId = requestAnimationFrame(updateProgress);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [emblaApi, articles.length, slidesToShow]);

  // Drag thumb
  useEffect(() => {
    if (!emblaApi) return;
    const track = trackRef.current;
    const thumb = thumbRef.current;
    if (!track || !thumb) return;
    let isDragging = false;
    let startX = 0;
    let startScroll = 0;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      isDragging = true;
      startX =
        e.type === "touchstart"
          ? (e as TouchEvent).touches[0].clientX
          : (e as MouseEvent).clientX;
      startScroll = emblaApi.scrollProgress();
      document.addEventListener("mousemove", onPointerMove as EventListener);
      document.addEventListener("touchmove", onPointerMove as EventListener);
      document.addEventListener("mouseup", onPointerUp);
      document.addEventListener("touchend", onPointerUp);
    };
    const onPointerMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging) return;
      const clientX =
        e.type === "touchmove"
          ? (e as TouchEvent).touches[0].clientX
          : (e as MouseEvent).clientX;
      const trackW = track.offsetWidth;
      const thumbW = thumb.offsetWidth;
      let newLeft = Math.min(
        Math.max(scrollbarLeft + clientX - startX, 0),
        trackW - thumbW,
      );
      let progress = newLeft / (trackW - thumbW);
      emblaApi.scrollTo(progress, false);
    };
    const onPointerUp = () => {
      isDragging = false;
      document.removeEventListener("mousemove", onPointerMove as EventListener);
      document.removeEventListener("touchmove", onPointerMove as EventListener);
      document.removeEventListener("mouseup", onPointerUp);
      document.removeEventListener("touchend", onPointerUp);
    };
    thumb.addEventListener("mousedown", onPointerDown as EventListener);
    thumb.addEventListener("touchstart", onPointerDown as EventListener);
    return () => {
      thumb.removeEventListener("mousedown", onPointerDown as EventListener);
      thumb.removeEventListener("touchstart", onPointerDown as EventListener);
      document.removeEventListener("mousemove", onPointerMove as EventListener);
      document.removeEventListener("touchmove", onPointerMove as EventListener);
      document.removeEventListener("mouseup", onPointerUp);
      document.removeEventListener("touchend", onPointerUp);
    };
  }, [emblaApi, scrollbarLeft]);

  return (
    <div
      className="relative group"
      onMouseEnter={() => setIsAutoPlaying(false)}
      onMouseLeave={() => setIsAutoPlaying(true)}
    >
      <div className="embla">
        <div className="embla__viewport overflow-hidden" ref={emblaRef}>
          <div className="embla__container flex gap-6">
            {typedArticles.map((article, idx) => {
              // Map featuredImage ke string
              const featuredImage = article.featuredImage && typeof article.featuredImage === "object" && article.featuredImage.url
                ? article.featuredImage.url
                : undefined;
              return (
                <div className="embla__slide shrink-0" key={article._id || idx}>
                  <FeaturedCard
                    article={{
                      slug: article.slug,
                      featuredImage,
                      title: article.title,
                      category: article.category,
                      excerpt: article.excerpt,
                      authorName: article.author?.name,
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {/* Arrow Navigation */}
      <button
        className="absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-white/80 hover:bg-white text-gray-800 rounded-full p-2 shadow transition disabled:opacity-40"
        onClick={() => emblaApi && emblaApi.scrollPrev()}
        disabled={!canScrollPrev}
        aria-label="Previous"
      >
        <ChevronLeft className="h-6 w-6" />
      </button>
      <button
        className="absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-white/80 hover:bg-white text-gray-800 rounded-full p-2 shadow transition disabled:opacity-40"
        onClick={() => emblaApi && emblaApi.scrollNext()}
        disabled={!canScrollNext}
        aria-label="Next"
      >
        <ChevronRight className="h-6 w-6" />
      </button>

      {/* scrollbar */}
      <div
        className="w-full bg-primary/10 mt-4 h-2 rounded-full relative block"
        ref={trackRef}
      >
        <div
          className="block bg-primary h-2 rounded-full absolute top-0"
          style={{
            width: `${scrollbarWidth * 100}%`,
            left: `${scrollbarLeft}%`,
            transition: "width 0.2s, left 0.2s",
          }}
        ></div>
      </div>

      <style jsx>{`
        .embla__container {
          display: flex;
        }
        .embla__slide {
          min-width: 50%;
          max-width: 50%;
        }
        @media (min-width: 640px) {
          .embla__slide {
            min-width: 50%;
            max-width: 50%;
          }
        }
        @media (min-width: 1024px) {
          .embla__slide {
            min-width: 25%;
            max-width: 25%;
          }
        }
      `}</style>
    </div>
  );
};
export default InTheNewsCarousel;
