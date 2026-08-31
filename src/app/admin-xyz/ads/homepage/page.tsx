"use client";

import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { del as idbDel } from "idb-keyval";
import axios from "axios";
import api from "@/lib/axios";
import { resolveDraftImage } from "@/lib/image/draftImageStorage";
import { S3_IMMUTABLE_CACHE_CONTROL } from "@/lib/s3/object-cache";
import AdsHomepageForm, {
  type AdsDraft,
} from "@/components/admin/ads/AdsHomepageForm";
import {
  AdsPosition,
  AdsVariant,
  ADS_HOMEPAGE_SECTION_ORDER,
  adsHomepageEffectiveSpan,
  adsHomepageIsRatioBasedPosition,
  type BulkUpsertAdsItem,
  type HomepageAdsSectionRatio,
} from "@/types/ads";
import type { HomepageAdItem } from "@/types/ads";

function idbBannerKey(id: string): string {
  return `homepage-ad-banner:${id}`;
}

function isAdsPosition(v: string): v is AdsPosition {
  return Object.values(AdsPosition).includes(v as AdsPosition);
}

function serverDocToAdsDraft(doc: HomepageAdItem): AdsDraft {
  const position =
    doc.position && isAdsPosition(doc.position)
      ? doc.position
      : AdsPosition.HEADLINE;

  return {
    _id: doc._id,
    serverId: doc._id,
    name: doc.name?.trim() ? doc.name.trim() : "Tanpa nama",
    position,
    linkUrl: doc.linkUrl,
    order: doc.order,
    startedAt:
      typeof doc.startedAt === "string"
        ? doc.startedAt.slice(0, 16)
        : new Date(doc.startedAt).toISOString().slice(0, 16),
    endedAt:
      typeof doc.endedAt === "string"
        ? doc.endedAt.slice(0, 16)
        : new Date(doc.endedAt).toISOString().slice(0, 16),
    banner: {
      previewUrl: doc.banner.url,
      serverData: {
        url: doc.banner.url,
        filename: doc.banner.filename,
        mimetype: doc.banner.mimetype,
        size: doc.banner.size,
      },
    },
    span: adsHomepageEffectiveSpan(position, doc.span),
    ratio:
      adsHomepageIsRatioBasedPosition(position) &&
      (doc.ratio === "21:9" || doc.ratio === "16:9" || doc.ratio === "4:3")
        ? (doc.ratio as HomepageAdsSectionRatio)
        : undefined,
  };
}

async function buildBulkItemsForPosition(
  group: AdsDraft[],
  uploadBanner: (
    itemId: string,
    memoryBlob?: Blob,
  ) => Promise<HomepageAdItem["banner"]>,
  uploadedFileKeys: string[],
): Promise<BulkUpsertAdsItem[]> {
  const sorted = [...group].sort((a, b) => a.order - b.order);
  return Promise.all(
    sorted.map(async (item, idx) => {
      let banner: HomepageAdItem["banner"];

      if (item.banner.blob) {
        const uploaded = await uploadBanner(item._id, item.banner.blob);
        uploadedFileKeys.push(uploaded.filename);
        banner = uploaded;
      } else if (item.banner.serverData) {
        banner = item.banner.serverData;
      } else {
        throw new Error(`Item "${item.linkUrl}" tidak memiliki data banner`);
      }

      return {
        serverId: item.serverId,
        name: item.name.trim(),
        banner,
        linkUrl: item.linkUrl,
        order: idx,
        startedAt: item.startedAt,
        endedAt: item.endedAt,
        variant: AdsVariant.HORIZONTAL,
        span: adsHomepageEffectiveSpan(item.position, item.span),
        ratio: adsHomepageIsRatioBasedPosition(item.position)
          ? item.ratio
          : undefined,
      };
    }),
  );
}

export default function HomepageAdsPage() {
  const [initialItems, setInitialItems] = useState<AdsDraft[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchExisting = async () => {
      try {
        const response = await api.get("/ads/homepage", {
          params: { isActive: "true", limit: 200 },
        });
        const docs: HomepageAdItem[] = response.data.ads ?? [];
        setInitialItems(docs.map(serverDocToAdsDraft));
      } catch (error) {
        console.error("Gagal memuat iklan homepage:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchExisting();
  }, []);

  const uploadBanner = async (
    itemId: string,
    memoryBlob?: Blob,
  ): Promise<HomepageAdItem["banner"]> => {
    const blob = await resolveDraftImage(idbBannerKey(itemId), memoryBlob);
    if (!blob)
      throw new Error(`Blob tidak ditemukan di IDB untuk item ${itemId}`);

    const presignRes = await api.post<{
      success: boolean;
      uploadUrl: string;
      fileKey: string;
    }>("/ads/media", {
      action: "presign",
      filename: "banner.webp",
      contentType: blob.type || "image/webp",
    });

    const { uploadUrl, fileKey } = presignRes.data;

    await axios.put(uploadUrl, blob, {
      headers: {
        "Content-Type": blob.type || "image/webp",
        "Cache-Control": S3_IMMUTABLE_CACHE_CONTROL,
      },
    });


    const finalizeRes = await api.post<{
      success: boolean;
      banner: HomepageAdItem["banner"];
    }>("/ads/media", {
      action: "finalize",
      fileKey,
    });

    return finalizeRes.data.banner;
  };

  const handleSave = async (items: AdsDraft[]) => {
    toast.info("Menyimpan iklan...");
    const uploadedFileKeys: string[] = [];

    try {
      const mergedDocs: HomepageAdItem[] = [];

      for (const position of ADS_HOMEPAGE_SECTION_ORDER) {
        const group = items.filter((i) => i.position === position);
        const resolvedItems = await buildBulkItemsForPosition(
          group,
          uploadBanner,
          uploadedFileKeys,
        );

        const response = await api.put<{
          success: boolean;
          ads: HomepageAdItem[];
        }>("/ads/homepage", {
          position,
          items: resolvedItems,
        });

        mergedDocs.push(...(response.data.ads ?? []));
      }

      setInitialItems(mergedDocs.map(serverDocToAdsDraft));

      for (const item of items) {
        if (item.banner.blob) {
          await idbDel(idbBannerKey(item._id));
        }
      }

      toast.success("Iklan berhasil disimpan!");
    } catch (error) {
      console.error("Gagal menyimpan iklan homepage:", error);

      if (uploadedFileKeys.length > 0) {
        console.warn(
          "Membersihkan file S3 yang gagal tersimpan ke DB:",
          uploadedFileKeys,
        );
      }

      throw error;
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-sm text-muted-foreground">
          Memuat data iklan...
        </div>
      </div>
    );
  }

  return <AdsHomepageForm initialItems={initialItems} onSave={handleSave} />;
}
