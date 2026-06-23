"use client";

import React, { useRef } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Scrollbar, Mousewheel, FreeMode } from "swiper/modules";
import type { Swiper as SwiperType } from "swiper";
import { useCarouselShiftScroll } from "@/hooks/carousel/useCarouselShiftScroll";
import { ChevronLeft, ChevronRight } from "lucide-react";
import SecondaryNewsCard from "@/components/news/SecondaryNewsCard";
import { AdsCard } from "@/components/ads/card/adsCard";
import { AdsCardVariant, HomepageAdItem } from "@/types/ads";
import { ArticleListResponse } from "@/types/article";

interface NewsCarouselUiProps {
  articles: ArticleListResponse[];
  isLoading?: boolean;
  error?: boolean | string;
  emptyText?: string;
  loadingText?: string;
  errorText?: string;
  className?: string;
  maxSlidesPerView?: number;
  ads?: HomepageAdItem[];
}

const NewsCarouselUi: React.FC<NewsCarouselUiProps> = ({
  articles,
  isLoading = false,
  error = false,
  emptyText = "Belum ada artikel",
  loadingText = "Memuat...",
  errorText = "Gagal memuat artikel",
  className = "",
  maxSlidesPerView = 4,
  ads = [],
}) => {
  const swiperRef = useRef<SwiperType | null>(null);
  const containerRef = useCarouselShiftScroll(swiperRef);

  const uniqueId = React.useId().replace(/:/g, "");
  const nextEl = `swiper-next-${uniqueId}`;
  const prevEl = `swiper-prev-${uniqueId}`;

  // Siapkan class lebar jika menggunakan slidesPerView="auto"
  const span1Classes = "!w-[70%] sm:!w-[45%] lg:!w-[30%] xl:!w-[22%]";
  const span2Classes = "!w-[90%] sm:!w-[70%] lg:!w-[50%] xl:!w-[45%]";

  return (
    <div ref={containerRef} className={`w-full relative  ${className}`}>
      <Swiper
        onSwiper={(swiper) => (swiperRef.current = swiper)}
        className="w-full pb-12 "
        loop={false}
        watchOverflow
        freeMode={true}
        grabCursor={true}
        modules={[Navigation, Scrollbar, Mousewheel, FreeMode]}
        direction="horizontal"
        spaceBetween={20}
        slidesPerView="auto"
        navigation={{
          nextEl: `.${nextEl}`,
          prevEl: `.${prevEl}`,
        }}
        mousewheel={{ forceToAxis: true }}
        scrollbar={{ draggable: true, hide: false, dragSize: 100 }}
      >
        {ads.length > 0 &&
          ads.map((ad) => (
            <SwiperSlide
              className={
                (ad.span as number) === 2 ? span2Classes : span1Classes
              }
              key={ad._id}
            >
              <AdsCard
                variant={AdsCardVariant.NEWS}
                span={ad.span}
                bannerUrl={ad.banner.url}
              />
            </SwiperSlide>
          ))}

        {isLoading ? (
          <SwiperSlide className={span1Classes}>
            <div className="flex items-center justify-center h-40 w-full">
              <span className="text-muted-foreground">{loadingText}</span>
            </div>
          </SwiperSlide>
        ) : error ? (
          <SwiperSlide className={span1Classes}>
            <div className="flex items-center justify-center h-40 w-full text-red-500">
              {typeof error === "string" ? error : errorText}
            </div>
          </SwiperSlide>
        ) : articles.length === 0 ? (
          <SwiperSlide className={span1Classes}>
            <div className="flex items-center justify-center h-40 w-full text-muted-foreground">
              {emptyText}
            </div>
          </SwiperSlide>
        ) : (
          articles.map((article) => (
            <SwiperSlide key={article._id} className={span1Classes}>
              <SecondaryNewsCard
                article={article}
                showImage={true}
                className="mb-4"
              />
            </SwiperSlide>
          ))
        )}
      </Swiper>
      <div className={`${prevEl} left-2 swiper-button-custom`}>
        <ChevronLeft className="w-5 h-5" />
      </div>
      <div className={`${nextEl} right-2 swiper-button-custom`}>
        <ChevronRight className="w-5 h-5" />
      </div>
    </div>
  );
};

export default NewsCarouselUi;
