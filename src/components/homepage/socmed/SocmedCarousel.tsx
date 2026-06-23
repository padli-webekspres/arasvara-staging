"use client";

import React, { useMemo } from "react";
import { useCombinedSocmedVideos } from "@/hooks/useSocmed";
import { VideoSocmedCarousel } from "../carousel/VideoSocmedCarousel";
import { useHomepageAdsGrouped } from "@/hooks/useAds";

/**
 * Carousel gabungan TikTok + Instagram dengan satu fetch dan order global.
 */
const SocmedCarousel = () => {
  const { data: videos, isLoading, isError } = useCombinedSocmedVideos();
  const { reelsAds, tiktokAds } = useHomepageAdsGrouped();

  const mergedAds = useMemo(() => {
    const combined = [...(reelsAds ?? []), ...(tiktokAds ?? [])];
    return combined.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [reelsAds, tiktokAds]);

  return (
    <VideoSocmedCarousel
      layout="portrait"
      videos={videos}
      isLoading={isLoading}
      isError={isError}
      ads={mergedAds}
    />
  );
};

export default SocmedCarousel;
