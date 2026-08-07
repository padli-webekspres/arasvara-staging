"use client";

import React, { useMemo } from "react";
import { useCombinedSocmedVideos } from "@/hooks/useSocmed";
import { VideoSocmedCarousel } from "../carousel/VideoSocmedCarousel";
import { useHomepageAdsGrouped } from "@/hooks/useAds";
import type { SectionVideoItem } from "@/types/articleSection";

/**
 * Carousel gabungan TikTok + Instagram, diurutkan terbaru ditambahkan dulu.
 */
const SocmedCarousel = () => {
  const { data: videos, isLoading, isError } = useCombinedSocmedVideos();
  const { reelsAds, tiktokAds } = useHomepageAdsGrouped();

  const sortedVideos = useMemo(() => {
    if (!videos?.length) return videos;

    return [...videos].sort((a: SectionVideoItem, b: SectionVideoItem) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (bTime !== aTime) return bTime - aTime;

      // Tie-break: _id string (ObjectId lebih baru biasanya lebih besar secara lex)
      const aId = a._id ?? "";
      const bId = b._id ?? "";
      return bId.localeCompare(aId);
    });
  }, [videos]);

  const mergedAds = useMemo(() => {
    const combined = [...(reelsAds ?? []), ...(tiktokAds ?? [])];
    return combined.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [reelsAds, tiktokAds]);

  return (
    <VideoSocmedCarousel
      layout="portrait"
      videos={sortedVideos}
      isLoading={isLoading}
      isError={isError}
      ads={mergedAds}
    />
  );
};

export default SocmedCarousel;
