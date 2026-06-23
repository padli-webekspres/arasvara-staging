"use client";

import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import api from "@/lib/axios";
import VideoSocmedForm from "@/components/admin/articles/VideoSocmedForm";
import { SectionVideoItem } from "@/types/articleSection";
import { parseSocmedVideoListResponse } from "@/hooks/useSocmed";

const SocmedSectionPage = () => {
  const [existingItems, setExistingItems] = useState<SectionVideoItem[]>([]);

  useEffect(() => {
    const fetchExistingVideos = async () => {
      try {
        const response = await api.get("/articles/socmed/combined");
        const videos = parseSocmedVideoListResponse(response.data);
        setExistingItems(videos);
        if (videos.length > 0) {
          toast.success("Data socmed berhasil dimuat");
        }
      } catch (error) {
        console.error("Error fetching combined socmed videos:", error);
        toast.error("Gagal memuat data socmed");
      }
    };

    fetchExistingVideos();
  }, []);

  const handleSaveVideos = async (items: SectionVideoItem[]) => {
    const payload = {
      videos: items.map((item) => ({
        video_url: item.video_url,
        title: item.title,
        thumbnail_url: item.thumbnail_url,
        type: item.type,
      })),
    };

    const response = await api.post("/articles/socmed/combined", payload);
    const savedItems = parseSocmedVideoListResponse(response.data);
    setExistingItems(savedItems);
    toast.success("Video socmed berhasil disimpan!");
  };

  return (
    <VideoSocmedForm
      mode="combined"
      customTitle="Feed Socmed (TikTok & Instagram)"
      existingItems={existingItems}
      onSave={handleSaveVideos}
    />
  );
};

export default SocmedSectionPage;
