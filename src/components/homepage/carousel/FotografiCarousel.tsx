"use client";

import React, { useRef } from "react";
import "@/styles/swiper";
import Link from "next/link";
import { ResponsiveMediaImage } from "@/components/ui/ResponsiveMediaImage";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Scrollbar, Mousewheel, FreeMode } from "swiper/modules";
import type { Swiper as SwiperType } from "swiper";
import { useCarouselShiftScroll } from "@/hooks/carousel/useCarouselShiftScroll";
import { usePhotographyArticles } from "@/hooks/usePhotography";
import { ImageNotFound } from "@/components/image-notfound/ImageNotFound";
import type { GalleryArticle } from "@/types/article";
import { AdsCard } from "@/components/ads/card/adsCard";
import { AdsCardVariant } from "@/types/ads";
import { ChevronLeft, ChevronRight } from "lucide-react";
import "./carousel.css";
import { useHomepageAdsGrouped } from "@/hooks/useAds";
import { resolvePublicArticleHref } from "@/lib/article-public-path";

export interface FotografiCarouselProps {
  /** Slot iklan pertama di carousel (sama pola dengan NewsCarouselUi) */
  showAds?: boolean;
  adBannerUrl?: string;
  adSpan?: 1 | 2;
  className?: string;
}

function truncateTitle(title: string, max: number = 30): string {
  return title.length > max ? title.slice(0, max - 3) + "..." : title;
}

interface FotografiCardProps {
  article: GalleryArticle;
}

const FotografiCard = ({ article }: FotografiCardProps) => {
  const imageUrl = article.featuredImage?.url?.trim() ?? "";
  const [imageFailed, setImageFailed] = React.useState(false);

  React.useEffect(() => {
    setImageFailed(false);
  }, [imageUrl, article.slug]);

  const showImageFallback = !imageUrl || imageFailed;
  const href = resolvePublicArticleHref(article);
  const categoryLabel = article.category?.name ?? "Galeri";
  const authorLabel = article.author?.name ?? "";

  return (
    <div className="mb-4">
      <Link href={href} className="block group">
        <div className="w-full aspect-4/5 rounded-2xl overflow-hidden cursor-pointer bg-gray-200 shrink-0 relative">
          <div className="absolute inset-0 w-full h-full rounded-2xl transition-transform duration-500 group-hover:scale-105 z-0">
            {showImageFallback ? (
              <ImageNotFound
                fill
                variant="light"
                className="border-0 shadow-none rounded-2xl"
              />
            ) : (
              <ResponsiveMediaImage
                src={imageUrl}
                alt=""
                className="absolute inset-0 h-full w-full object-cover rounded-2xl"
                sizes="(max-width: 640px) 50vw, (max-width: 900px) 33vw, 25vw"
                onError={() => setImageFailed(true)}
              />
            )}
            <div
              className="absolute inset-0 rounded-2xl transition-colors duration-300 z-1"
              style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
            />
          </div>
          <div className="absolute inset-0 rounded-2xl pointer-events-none transition-colors duration-300 group-hover:bg-black/20 z-10" />
          <div className="absolute bottom-0 left-0 w-full p-4 z-20 flex flex-col gap-1 rounded-2xl">
            <span className="text-base lg:text-lg font-medium lg:font-semibold text-white drop-shadow-sm mb-1">
              {categoryLabel}
            </span>
            <span className="text-xl lg:text-2xl font-bold text-white drop-shadow-md">
              {truncateTitle(article.title, 40)}
            </span>
            {authorLabel ? (
              <span className="text-base text-white drop-shadow-sm">
                {authorLabel}
              </span>
            ) : null}
          </div>
        </div>
      </Link>
    </div>
  );
};

/**
 * Carousel fotografi: artikel format GALLERY dari API (React Query).
 * Rasio 4:5, free mode, navigasi & shift+scroll; opsi iklan via AdsCard (variant video).
 */
const FotografiCarousel: React.FC<FotografiCarouselProps> = ({
  className = "",
}) => {
  const swiperRef = useRef<SwiperType | null>(null);
  const containerRef = useCarouselShiftScroll(swiperRef);

  const uniqueId = React.useId().replace(/:/g, "");
  const nextEl = `swiper-next-${uniqueId}`;
  const prevEl = `swiper-prev-${uniqueId}`;

  const {
    data: galleryArticles,
    isLoading,
    error,
  } = usePhotographyArticles({
    limit: 12,
    page: 1,
  });

  const articles = galleryArticles ?? [];

  const { isLoading: isLoadingAds, photographyAds } = useHomepageAdsGrouped();

  const renderPlaceholderSlide = (body: React.ReactNode) => (
    <SwiperSlide key="state">
      <div className="mb-4 flex min-h-[280px] items-center justify-center rounded-2xl bg-gray-100 px-4 text-center text-muted-foreground sm:min-h-[320px]">
        {body}
      </div>
    </SwiperSlide>
  );
  const span1Classes = "!w-[60%] sm:!w-[30%] lg:!w-[18%]";

  return (
    <div
      ref={containerRef}
      className={`w-full relative swiper-terakota ${className}`.trim()}
    >
      <Swiper
        onSwiper={(swiper) => (swiperRef.current = swiper)}
        className="w-full pb-12 swiper "
        loop={false}
        watchOverflow
        freeMode={true}
        grabCursor={true}
        modules={[Navigation, Scrollbar, Mousewheel, FreeMode]}
        direction="horizontal"
        spaceBetween={20}
        slidesPerView={1.5}
        navigation={{
          nextEl: `.${nextEl}`,
          prevEl: `.${prevEl}`,
        }}
        mousewheel={{ forceToAxis: true }}
        scrollbar={{ draggable: true, hide: false, dragSize: 100 }}
        breakpoints={{
          640: {
            slidesPerView: 2,
            spaceBetween: 20,
          },
          900: {
            slidesPerView: 3,
            spaceBetween: 22,
          },
          1280: {
            slidesPerView: 4,
            spaceBetween: 24,
          },
        }}
      >
        {photographyAds.length > 0 &&
          photographyAds.map((ad) => (
            <SwiperSlide key={ad._id}>
              <AdsCard
                variant={AdsCardVariant.VIDEO}
                span={ad.span}
                bannerUrl={ad.banner.url}
              />
            </SwiperSlide>
          ))}

        {isLoading
          ? renderPlaceholderSlide("Memuat…")
          : error
            ? renderPlaceholderSlide(
                error.message || "Gagal memuat galeri fotografi",
              )
            : articles.length === 0
              ? renderPlaceholderSlide("Belum ada galeri fotografi")
              : articles.map((article) => (
                  <SwiperSlide key={article._id ?? article.slug}>
                    <FotografiCard article={article} />
                  </SwiperSlide>
                ))}
      </Swiper>
      <button
        type="button"
        aria-label="Galeri sebelumnya"
        className={`${prevEl} swiper-button-prev-custom swiper-button-custom`}
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
      <button
        type="button"
        aria-label="Galeri selanjutnya"
        className={`${nextEl} swiper-button-next-custom swiper-button-custom`}
      >
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  );
};

export default FotografiCarousel;
