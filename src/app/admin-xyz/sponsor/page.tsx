"use client";

import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import api from "@/lib/axios";
import SponsorForm from "@/components/admin/sponsor/SponsorForm";
import { SponsorItem } from "@/types/sponsor";

interface SponsorSectionPageProps {}

const SponsorSectionPage = ({}: SponsorSectionPageProps) => {
  // ── State: Existing sponsor items ────────────────────────────────────
  const [existingItems, setExistingItems] = useState<SponsorItem[]>([]);

  // ── Effect: Fetch existing sponsor items from API on mount ────────────
  useEffect(() => {
    const fetchExistingSponsors = async () => {
      try {
        const response = await api.get("/sponsor");
        const sponsors = response.data.data || [];

        setExistingItems(sponsors);
        if (sponsors.length > 0) {
          toast.success("Data Sponsor berhasil dimuat");
        }
      } catch (error) {
        console.error("Error fetching sponsors:", error);
      }
    };

    fetchExistingSponsors();
  }, []);

  // ── Handle save to backend ────────────────────────────────────────
  const handleSaveSponsors = async (items: SponsorItem[]) => {
    try {
      const payload = {
        sponsors: items.map((item) => ({
          name: item.name,
          image_url: item.image_url,
        })),
      };

      const response = await api.post("/sponsor", payload);

      const savedItems: SponsorItem[] = response.data.data || [];
      setExistingItems(savedItems);
    } catch (error) {
      console.error("Error saving sponsors:", error);
      throw error;
    }
  };

  return (
    <SponsorForm
      existingItems={existingItems}
      onSave={handleSaveSponsors}
    />
  );
};

export default SponsorSectionPage;
