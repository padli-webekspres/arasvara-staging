"use client";

import React, { useMemo, useRef, useState } from "react";
import "@/styles/swiper";
import { GalleryItem } from "@/types/article";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Scrollbar, Mousewheel } from "swiper/modules";
import type { Swiper as SwiperType } from "swiper";
import { useCarouselShiftScroll } from "@/hooks/carousel/useCarouselShiftScroll";
import { ChevronLeft, ChevronRight, ZoomIn } from "lucide-react";
import GalleryImageDialog from "./GalleryImageDialog";
import ArticleContent from "./ArticleContent";
import type { Media } from "@/types/media";
import type { ArticleMedia } from "@/types/article";
import { ResponsiveMediaImage } from "@/components/ui/ResponsiveMediaImage";

interface GalleryContentProps {
  /** Featured image bisa berupa ArticleMedia (skema baru) atau Media legacy. */
  featuredImage?: ArticleMedia | Media | null;
  galleryItems: GalleryItem[];
  content: string;
}

function findMatchingGalleryItem(
  featuredImage: ArticleMedia | Media,
  galleryItems: GalleryItem[],
): GalleryItem | undefined {
  const featuredId =
    "_id" in featuredImage
      ? String((featuredImage as Media)._id ?? "").trim()
      : String((featuredImage as ArticleMedia).mediaId ?? "").trim();
  const featuredUrl = featuredImage.url?.trim() ?? "";

  return galleryItems.find((item) => {
    const itemMediaId = String(item.mediaId ?? "").trim();
    const itemMediaDocId = String(item.media?._id ?? "").trim();
    const itemUrl = (item.media?.url || item.url || "").trim();
    if (featuredId && (itemMediaId === featuredId || itemMediaDocId === featuredId)) {
      return true;
    }
    return Boolean(featuredUrl && itemUrl && featuredUrl === itemUrl);
  });
}

/** Bangun satu `GalleryItem` sintetis agar zoom/dialog sama dengan slide galeri. */
function featuredToGalleryItem(
  featuredImage: ArticleMedia | Media,
  fallbackItem?: GalleryItem,
): GalleryItem {
  const caption =
    featuredImage.caption?.trim() ||
    fallbackItem?.caption?.trim() ||
    "";
  const credit =
    featuredImage.credit?.trim() ||
    fallbackItem?.credit?.trim() ||
    "";
  const url = featuredImage.url;

  // Legacy Media (punya _id) → pakai langsung sebagai media.
  // ArticleMedia (skema baru, punya mediaId) → ambil .media jika sudah di-populate.
  const media: Media | null | undefined =
    "_id" in featuredImage
      ? (featuredImage as Media)
      : ((featuredImage as ArticleMedia).media ?? undefined);

  const rawMediaId =
    "_id" in featuredImage
      ? (featuredImage as Media)._id
      : String((featuredImage as ArticleMedia).mediaId ?? "");

  return {
    mediaId: String(rawMediaId || "featured-gallery-slide"),
    url,
    media: media ?? undefined,
    caption,
    credit,
    order: 0,
  };
}

const GalleryContent = (props: GalleryContentProps) => {
  const { galleryItems, featuredImage, content } = props;
  const swiperRef = useRef<SwiperType | null>(null);
  const containerRef = useCarouselShiftScroll(swiperRef);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedGalleryItem, setSelectedGalleryItem] =
    useState<GalleryItem | null>(null);
  const [clickedImageElement, setClickedImageElement] =
    useState<HTMLElement | null>(null);

  const slides = useMemo(() => {
    // Tentukan ID kanonik featured image untuk dedup (dukung _id legacy & mediaId baru).
    const featuredId = featuredImage
      ? (
          "_id" in featuredImage
            ? String((featuredImage as Media)._id ?? "")
            : String((featuredImage as ArticleMedia).mediaId ?? "")
        ).trim()
      : "";

    const rest = featuredId
      ? galleryItems.filter((g) => {
          const gMediaId = String(g.mediaId ?? "").trim();
          const gId = String(g.media?._id ?? "").trim();
          return gMediaId !== featuredId && gId !== featuredId;
        })
      : [...galleryItems];

    const first: GalleryItem[] = featuredImage
      ? [featuredToGalleryItem(featuredImage)]
      : [];
    return [...first, ...rest];
  }, [galleryItems, featuredImage]);

  const handleImageClick = (item: GalleryItem, element: HTMLElement | null) => {
    setSelectedGalleryItem(item);
    setClickedImageElement(element);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedGalleryItem(null);
    setClickedImageElement(null);
  };

  const trimmedContent = content?.trim() ?? "";

  return (
    <div className="mb-8">
      <div ref={containerRef} className="w-full relative ">
        <Swiper
          onSwiper={(swiper) => (swiperRef.current = swiper)}
          className="w-full pb-12 swiper-terakota"
          grabCursor={true}
          modules={[Navigation, Scrollbar, Mousewheel]}
          direction="horizontal"
          spaceBetween={20}
          slidesPerView={1}
          navigation={{
            nextEl: ".swiper-button-next-custom",
            prevEl: ".swiper-button-prev-custom",
          }}
          mousewheel={{ forceToAxis: true }}
          scrollbar={{ draggable: true, hide: false, dragSize: 100 }}
          breakpoints={{
            640: {
              slidesPerView: 1,
              spaceBetween: 20,
            },
            1024: {
              slidesPerView: 1,
              spaceBetween: 22,
            },
            1280: {
              slidesPerView: 1,
              spaceBetween: 24,
            },
          }}
        >
          {slides.length === 0 ? (
            <SwiperSlide key="gallery-empty">
              <div className="flex items-center justify-center h-40 w-full text-muted-foreground">
                Tidak ada galeri
              </div>
            </SwiperSlide>
          ) : (
            slides.map((galleryItem, index) => (
              <SwiperSlide key={String(galleryItem.mediaId)}>
                {(() => {
                  const imageUrl =
                    galleryItem.media?.url || galleryItem.url || "/placeholder.jpg";
                  const shouldPrioritize = index === 0;
                  return (
                <div
                  className="relative mb-4 cursor-pointer group"
                  onClick={(e) =>
                    handleImageClick(
                      galleryItem,
                      (e.currentTarget as HTMLElement)?.querySelector(
                        ".gallery-image",
                      ) as HTMLElement | null,
                    )
                  }
                >
                  <div className="gallery-image relative w-full aspect-video overflow-hidden rounded-lg">
                    <ResponsiveMediaImage
                      src={imageUrl}
                      alt={
                        galleryItem.caption?.trim()
                          ? galleryItem.caption
                          : "Gambar galeri"
                      }
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105 m-0"
                      sizes="(max-width: 1280px) 100vw, 1080px"
                      priority={shouldPrioritize}
                      loading={shouldPrioritize ? "eager" : "lazy"}
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-center justify-center rounded-lg">
                      <ZoomIn className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    </div>
                  </div>

                  {(galleryItem.caption || galleryItem.credit) && (
                    <div className="w-full px-4 pb-4 pt-8 md:pt-12 absolute bottom-0 left-0 bg-linear-to-t from-black/80 to-transparent rounded-lg text-white pointer-events-none">
                      {galleryItem.caption ? (
                        <p className="mb-0 text-sm line-clamp-2 leading-snug">
                          {galleryItem.caption}
                        </p>
                      ) : null}
                      {galleryItem.credit ? (
                        <p className="mb-0 text-xs font-semibold mt-1 opacity-90">
                          Oleh: {galleryItem.credit}
                        </p>
                      ) : null}
                    </div>
                  )}
                </div>
                  );
                })()}
              </SwiperSlide>
            ))
          )}
        </Swiper>
        <div className="swiper-button-prev-custom swiper-button-custom">
          <ChevronLeft aria-hidden="true" className="w-5 h-5" />
        </div>
        <div className="swiper-button-next-custom swiper-button-custom">
          <ChevronRight aria-hidden="true" className="w-5 h-5" />
        </div>
      </div>

      <GalleryImageDialog
        isOpen={isDialogOpen}
        galleryItem={selectedGalleryItem}
        triggerElement={clickedImageElement}
        onClose={handleCloseDialog}
      />

      {trimmedContent ? (
        <div className="prose-arasvara text-lg leading-relaxed text-justify mt-8">
          <ArticleContent htmlContent={trimmedContent} />
        </div>
      ) : null}
    </div>
  );
};

export default GalleryContent;
