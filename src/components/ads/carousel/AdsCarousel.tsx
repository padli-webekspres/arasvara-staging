"use client";

import React, { useRef } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Scrollbar, Mousewheel, Autoplay } from "swiper/modules";
import type { Swiper as SwiperType } from "swiper";
import { useCarouselShiftScroll } from "@/hooks/carousel/useCarouselShiftScroll";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { AdsCarouselVariant, type HomepageAdItem } from "@/types/ads";
import { trackAdClick } from "@/lib/trackAdClick";

// Card Components
import SquareAdCard from "../card/SquareAdCard";
import VerticalAdCard from "../card/VerticalAdCard";
import VerticalLongAdCard from "../card/VerticalLongAdCard";
import HorizontalAdCard from "../card/HorizontalAdCard";
import HorizontalLongAds from "../card/HorizontalLongAds";

export interface AdsCarouselProps {
  ads: HomepageAdItem[];
  variant: AdsCarouselVariant;
  className?: string;
  autoplay?: boolean;
}

/** @deprecated Gunakan AdsCarouselVariant dari @/types/ads */
export type AdVariant = AdsCarouselVariant;

const AdsCarousel: React.FC<AdsCarouselProps> = ({
  ads,
  variant,
  className = "",
  autoplay = true,
}) => {
  const swiperRef = useRef<SwiperType | null>(null);
  const containerRef = useCarouselShiftScroll(swiperRef);

  const uniqueId = React.useId().replace(/:/g, "");
  const nextEl = `swiper-next-ads-${uniqueId}`;
  const prevEl = `swiper-prev-ads-${uniqueId}`;

  const renderCard = (ad: HomepageAdItem) => {
    const src = ad.banner.url;
    const alt = ad.name;

    switch (variant) {
      case AdsCarouselVariant.SQUARE:
        return <SquareAdCard src={src} alt={alt} className="w-full" />;
      case AdsCarouselVariant.VERTICAL:
        return <VerticalAdCard src={src} alt={alt} className="w-full" />;
      case AdsCarouselVariant.VERTICAL_LONG:
        return <VerticalLongAdCard src={src} alt={alt} className="w-full" />;
      case AdsCarouselVariant.HORIZONTAL:
        return <HorizontalAdCard src={src} alt={alt} className="w-full" />;
      case AdsCarouselVariant.HORIZONTAL_LONG:
        return <HorizontalLongAds src={src} alt={alt} className="w-full" />;
      default:
        return <SquareAdCard src={src} alt={alt} className="w-full" />;
    }
  };

  if (!ads || ads.length === 0) return null;

  const wrapAdLink = (ad: HomepageAdItem, card: React.ReactNode) =>
    ad.linkUrl ? (
      <a
        href={ad.linkUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full h-full"
        onClick={() => trackAdClick(ad._id, "homepage")}
      >
        {card}
      </a>
    ) : (
      card
    );

  if (ads.length === 1) {
    const ad = ads[0];
    return (
      <div className={cn("w-full flex justify-center", className)}>
        <div className="w-full md:w-3/5">
          {wrapAdLink(ad, renderCard(ad))}
        </div>
      </div>
    );
  }

  const breakpoints = {
    320: { slidesPerView: 1, spaceBetween: 12 },
    640: { slidesPerView: 1.2, spaceBetween: 16 },
    1024: { slidesPerView: 1.67, spaceBetween: 20 },
    1280: { slidesPerView: 1.67, spaceBetween: 24 },
  };

  const modules = [Navigation, Scrollbar, Mousewheel];
  if (autoplay) modules.push(Autoplay);

  return (
    <div ref={containerRef} className={cn("w-full relative group", className)}>
      <Swiper
        onSwiper={(swiper) => (swiperRef.current = swiper)}
        className="w-full pb-10"
        grabCursor={true}
        centeredSlides={false}
        modules={modules}
        direction="horizontal"
        spaceBetween={16}
        slidesPerView={1.25}
        navigation={{
          nextEl: `.${nextEl}`,
          prevEl: `.${prevEl}`,
        }}
        mousewheel={{ forceToAxis: true }}
        scrollbar={{ draggable: true, hide: false, dragSize: 100 }}
        breakpoints={breakpoints}
        autoplay={
          autoplay ? { delay: 4000, disableOnInteraction: false } : false
        }
      >
        {ads.map((ad) => (
          <SwiperSlide key={ad._id}>
            {wrapAdLink(ad, renderCard(ad))}
          </SwiperSlide>
        ))}
      </Swiper>

      <div
        className={cn(
          prevEl,
          "absolute left-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-background/90 backdrop-blur rounded-full flex items-center justify-center shadow-md cursor-pointer text-foreground opacity-0 group-hover:opacity-100 transition-opacity",
        )}
        aria-label="Previous Ad"
      >
        <ChevronLeft className="w-5 h-5" />
      </div>
      <div
        className={cn(
          nextEl,
          "absolute right-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-background/90 backdrop-blur rounded-full flex items-center justify-center shadow-md cursor-pointer text-foreground opacity-0 group-hover:opacity-100 transition-opacity",
        )}
        aria-label="Next Ad"
      >
        <ChevronRight className="w-5 h-5" />
      </div>
    </div>
  );
};

export default AdsCarousel;
