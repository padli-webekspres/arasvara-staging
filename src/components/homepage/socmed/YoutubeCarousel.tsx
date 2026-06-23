"use client";

import React from "react";
import { useYoutubeVideos } from "@/hooks/useSocmed";
import { VideoSocmedCarousel } from "../carousel/VideoSocmedCarousel";
import { useHomepageAdsGrouped } from "@/hooks/useAds";

interface YoutubeCarouselProps {}

/**
 * Komponen Container untuk Carousel Video YouTube.
 * Menangani pengambilan data (logic) dan merender UI Carousel.
 */
const YoutubeCarousel = ({}: YoutubeCarouselProps) => {
  const { data: videos, isLoading, isError } = useYoutubeVideos();

  const { isLoading: isLoadingAds, youtubeAds } = useHomepageAdsGrouped();

  return (
    <VideoSocmedCarousel
      layout="landscape"
      videos={videos}
      isLoading={isLoading}
      isError={isError}
      ads={youtubeAds}
    />
  );
};

export default YoutubeCarousel;
