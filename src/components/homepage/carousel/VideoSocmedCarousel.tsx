"use client";

import React, { useRef } from "react";
import "@/styles/swiper";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Scrollbar, Mousewheel, FreeMode } from "swiper/modules";
import type { Swiper as SwiperType } from "swiper";
import { useCarouselShiftScroll } from "@/hooks/carousel/useCarouselShiftScroll";
import { useIsLgUp } from "@/hooks/useIsLgUp";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SectionVideoItem } from "@/types/articleSection";
import VideoCarouselItem from "./VideoCarouselItem";
import { AdsCard } from "@/components/ads/card/adsCard";
import { AdsCardVariant, HomepageAdItem } from "@/types/ads";
import {
  getSocmedMaxVisibleVideos,
  getSocmedSlideWidthClasses,
  getSocmedVideoAspectClass,
  type SocmedVideoLayout,
} from "@/lib/socmed-video-layout";

interface VideoSocmedCarouselProps {
  videos?: SectionVideoItem[];
  isLoading?: boolean;
  isError?: boolean;
  ads?: HomepageAdItem[];
  layout: SocmedVideoLayout;
}

function VideoCarouselSkeleton({
  layout,
  count,
}: {
  layout: SocmedVideoLayout;
  count: number;
}) {
  const slideClass = getSocmedSlideWidthClasses(layout, 1);
  const aspectClass = getSocmedVideoAspectClass(layout);

  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <SwiperSlide key={`skeleton-${index}`} className={slideClass}>
          <div
            className={`w-full rounded-2xl bg-muted animate-pulse ${aspectClass}`}
          />
        </SwiperSlide>
      ))}
    </>
  );
}

/**
 * Carousel video sosial media — semua video masuk Swiper;
 * lebar slide / jumlah terlihat per viewport mengikuti layout + iklan.
 */
export const VideoSocmedCarousel = ({
  videos = [],
  isLoading = false,
  isError = false,
  ads = [],
  layout,
}: VideoSocmedCarouselProps) => {
  const swiperRef = useRef<SwiperType | null>(null);
  const containerRef = useCarouselShiftScroll(swiperRef);
  const isLgUp = useIsLgUp();

  // maxVisible hanya untuk skeleton, bukan membatasi data carousel
  const maxVisibleLg = getSocmedMaxVisibleVideos(layout, ads);
  const skeletonCount = isLgUp ? maxVisibleLg : 4;

  const span1Classes = getSocmedSlideWidthClasses(layout, 1);
  const span2Classes = getSocmedSlideWidthClasses(layout, 2);
  const errorAspectClass = getSocmedVideoAspectClass(layout);

  return (
    <div ref={containerRef} className="w-full relative">
      <Swiper
        onSwiper={(swiper) => (swiperRef.current = swiper)}
        className="w-full swiper swiper-background"
        loop={false}
        watchOverflow
        freeMode={true}
        grabCursor={true}
        modules={[Navigation, Scrollbar, Mousewheel, FreeMode]}
        direction="horizontal"
        spaceBetween={20}
        slidesPerView="auto"
        navigation={{
          nextEl: ".swiper-button-next-custom",
          prevEl: ".swiper-button-prev-custom",
        }}
        mousewheel={{ forceToAxis: true }}
        scrollbar={{ draggable: true, hide: false, dragSize: 100 }}
      >
        {isLoading && (
          <VideoCarouselSkeleton layout={layout} count={skeletonCount} />
        )}

        {isError && (
          <SwiperSlide className={span1Classes}>
            <div
              className={`w-full rounded-2xl bg-muted flex items-center justify-center ${errorAspectClass}`}
            >
              <p className="text-muted-foreground text-sm text-center px-4">
                Gagal memuat video. Coba refresh halaman.
              </p>
            </div>
          </SwiperSlide>
        )}

        {ads.length > 0 &&
          ads.map((ad) => (
            <SwiperSlide
              className={
                (ad.span as number) === 2 ? span2Classes : span1Classes
              }
              key={ad._id}
            >
              <AdsCard
                variant={AdsCardVariant.VIDEO}
                span={ad.span}
                position={ad.position}
                bannerUrl={ad.banner.url}
              />
            </SwiperSlide>
          ))}

        {!isLoading &&
          !isError &&
          videos.map((video) => (
            <SwiperSlide key={video._id} className={span1Classes}>
              <VideoCarouselItem
                video={video}
                span={1}
                layout={layout}
                showPlatformBadge
              />
            </SwiperSlide>
          ))}
      </Swiper>

      <div className="swiper-button-prev-custom swiper-button-custom">
        <ChevronLeft className="w-5 h-5" />
      </div>
      <div className="swiper-button-next-custom swiper-button-custom">
        <ChevronRight className="w-5 h-5" />
      </div>
    </div>
  );
};
