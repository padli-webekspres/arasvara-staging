"use client";

import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import api from "@/lib/axios";
import VideoSocmedForm from "@/components/admin/articles/VideoSocmedForm";
import { SectionVideoItem } from "@/types/articleSection";
import { parseSocmedVideoListResponse } from "@/hooks/useSocmed";

interface YoutubeSectionPageProps {}

const YoutubeSectionPage = ({}: YoutubeSectionPageProps) => {
  // ── State: Existing video items ────────────────────────────────────
  const [existingItems, setExistingItems] = useState<SectionVideoItem[]>([]);

  // ── Effect: Fetch existing video items from API on mount ────────────
  useEffect(() => {
    const fetchExistingVideos = async () => {
      try {
        const response = await api.get("/articles/socmed/youtube");
        const videos = parseSocmedVideoListResponse(response.data);

        setExistingItems(videos);
        if (videos.length > 0) {
          toast.success("Data YouTube berhasil dimuat");
        }
      } catch (error) {
        console.error("Error fetching YouTube videos:", error);
        // Silent fail - VideoSocmedForm will handle empty state
      }
    };

    fetchExistingVideos();
  }, []);

  // ── Handle save to backend ────────────────────────────────────────
  const handleSaveVideos = async (items: SectionVideoItem[]) => {
    try {
      // Build payload with thumbnail URLs (already server URLs from media upload)
      const payload = {
        videos: items.map((item) => ({
          video_url: item.video_url,
          title: item.title,
          thumbnail_url: item.thumbnail_url,
        })),
      };

      // POST to /api/articles/socmed/youtube
      const response = await api.post("/articles/socmed/youtube", payload);

      // Update existing items with response
      const savedItems = parseSocmedVideoListResponse(response.data);
      setExistingItems(savedItems);
      toast.success("YouTube video berhasil disimpan!");
    } catch (error) {
      console.error("Error saving YouTube videos:", error);
      throw error;
    }
  };

  return (
    <VideoSocmedForm
      mode="platform"
      socialPlatform="youtube"
      existingItems={existingItems}
      onSave={handleSaveVideos}
    />
  );
};

export default YoutubeSectionPage;
