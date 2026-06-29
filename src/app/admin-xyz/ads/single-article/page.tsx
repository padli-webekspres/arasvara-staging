"use client";

import React, { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { get as idbGet, del as idbDel } from "idb-keyval";
import axios from "axios";
import api from "@/lib/axios";
import { S3_IMMUTABLE_CACHE_CONTROL } from "@/lib/s3/object-cache";
import AdsSingleArticleForm, {
  type SingleArticleDraft,
  type AdsServerBanner,
} from "@/components/admin/ads/AdsSIngleArticleForm";
import {
  ADS_SINGLE_ARTICLE_SECTION_ORDER,
  AdsSingleArticlePlacement,
  type AdsArticleCategory,
  type BulkUpsertAdsArticleItem,
  type SingleArticleAdItem,
} from "@/types/ads";
import type { option } from "@/types/general";
import type { CategoryListResult } from "@/types/category";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function idbBannerKey(id: string): string {
  return `single-article-ad-banner:${id}`;
}

function serverDocToSingleArticleDraft(
  doc: SingleArticleAdItem,
): SingleArticleDraft {
  const placement = Object.values(AdsSingleArticlePlacement).includes(
    doc.placement,
  )
    ? doc.placement
    : AdsSingleArticlePlacement.VERTICAL;

  return {
    _id: doc._id,
    serverId: doc._id,
    name: doc.name?.trim() ? doc.name.trim() : "Tanpa nama",
    placement,
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
  };
}

/**
 * Upload blob ke S3 via presign → PUT → finalize, kembalikan banner metadata.
 * Alur identik dengan homepage ads page.
 */
async function uploadBanner(itemId: string): Promise<AdsServerBanner> {
  const blob = await idbGet<Blob>(idbBannerKey(itemId));
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
    banner: AdsServerBanner;
  }>("/ads/media", {
    action: "finalize",
    fileKey,
  });

  return finalizeRes.data.banner;
}

async function buildBulkItemsForPlacement(
  group: SingleArticleDraft[],
  uploadedFileKeys: string[],
): Promise<BulkUpsertAdsArticleItem[]> {
  const sorted = [...group].sort((a, b) => a.order - b.order);

  return Promise.all(
    sorted.map(async (item, idx) => {
      let banner: AdsServerBanner;

      if (item.banner.blob) {
        banner = await uploadBanner(item._id);
        uploadedFileKeys.push(banner.filename);
      } else if (item.banner.serverData) {
        banner = item.banner.serverData;
      } else {
        throw new Error(`Item "${item.name}" tidak memiliki data banner`);
      }

      const bulkItem: BulkUpsertAdsArticleItem = {
        name: item.name.trim(),
        banner,
        linkUrl: item.linkUrl,
        order: idx,
        startedAt: item.startedAt,
        endedAt: item.endedAt,
        isActive: true,
      };

      if (item.serverId) bulkItem.serverId = item.serverId;

      return bulkItem;
    }),
  );
}

// ─── Page component ───────────────────────────────────────────────────────────

export default function SingleArticleAdsPage() {
  const [categoryOptions, setCategoryOptions] = useState<option[]>([]);
  const [initialItems, setInitialItems] = useState<SingleArticleDraft[]>([]);
  const [initialCategories, setInitialCategories] = useState<
    AdsArticleCategory[]
  >([]);
  const [isLoadingCats, setIsLoadingCats] = useState(true);
  const [isLoadingAds, setIsLoadingAds] = useState(false);

  // ── Fetch categories saat mount ──────────────────────────────────────────

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await api.get<CategoryListResult>("/categories", {
          params: { limit: 200 },
        });
        const cats = res.data.categories ?? [];
        const opts: option[] = cats.map((c) => ({
          id: c.slug,
          label: c.name,
          value: String(c._id),
        }));
        setCategoryOptions(opts);
      } catch (error) {
        console.error("Gagal memuat daftar kategori:", error);
        toast.error("Gagal memuat daftar kategori");
      } finally {
        setIsLoadingCats(false);
      }
    };

    fetchCategories();
  }, []);

  // ── Fetch ads untuk scope kategori tertentu ──────────────────────────────

  const loadAdsForScope = useCallback(
    async (cats: AdsArticleCategory[]) => {
      if (cats.length === 0) return;
      setIsLoadingAds(true);
      try {
        const slugParams = cats
          .map((c) => {
            const opt = categoryOptions.find((o) => o.value === String(c._id));
            return opt?.id ?? c.slug ?? "";
          })
          .filter(Boolean);

        // Fetch per slug (API hanya support satu categorySlug per request)
        // Gabungkan hasilnya dan deduplicate by _id
        const allDocs: SingleArticleAdItem[] = [];
        const seenIds = new Set<string>();

        for (const slug of slugParams) {
          const res = await api.get<{
            success: boolean;
            ads: SingleArticleAdItem[];
          }>("/ads/single-article", {
            params: { categorySlug: slug, limit: 200 },
          });
          for (const doc of res.data.ads ?? []) {
            if (!seenIds.has(doc._id)) {
              seenIds.add(doc._id);
              allDocs.push(doc);
            }
          }
        }

        setInitialItems(allDocs.map(serverDocToSingleArticleDraft));
        setInitialCategories(cats);
      } catch (error) {
        console.error("Gagal memuat iklan single article:", error);
        toast.error("Gagal memuat iklan untuk kategori yang dipilih");
      } finally {
        setIsLoadingAds(false);
      }
    },
    [categoryOptions],
  );

  // ── Handle save ──────────────────────────────────────────────────────────

  const handleSave = async (
    items: SingleArticleDraft[],
    categories: AdsArticleCategory[],
  ) => {
    if (categories.length === 0) {
      toast.error("Tidak ada kategori yang dipilih");
      return;
    }

    toast.info("Menyimpan iklan...");
    const uploadedFileKeys: string[] = [];

    try {
      const mergedDocs: SingleArticleAdItem[] = [];

      for (const placement of ADS_SINGLE_ARTICLE_SECTION_ORDER) {
        const group = items.filter((i) => i.placement === placement);

        const resolvedItems = await buildBulkItemsForPlacement(
          group,
          uploadedFileKeys,
        );

        const response = await api.put<{
          success: boolean;
          ads: SingleArticleAdItem[];
        }>("/ads/single-article", {
          categories,
          placement,
          items: resolvedItems,
        });

        mergedDocs.push(...(response.data.ads ?? []));
      }

      setInitialItems(mergedDocs.map(serverDocToSingleArticleDraft));

      // Bersihkan IDB untuk item yang sudah berhasil diupload
      for (const item of items) {
        if (item.banner.blob) {
          await idbDel(idbBannerKey(item._id));
        }
      }

      toast.success("Iklan berhasil disimpan!");
    } catch (error) {
      console.error("Gagal menyimpan iklan single article:", error);

      if (uploadedFileKeys.length > 0) {
        console.warn(
          "File S3 yang terupload sebelum error (perlu dibersihkan manual):",
          uploadedFileKeys,
        );
      }

      throw error;
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────

  if (isLoadingCats) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-sm text-muted-foreground">
          Memuat daftar kategori...
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-w-0 max-w-full">
      {isLoadingAds && (
        <div className="absolute inset-0 z-20 flex items-start justify-center bg-background/60 pt-20 backdrop-blur-sm">
          <div className="rounded-lg border border-border bg-card px-6 py-4 text-sm text-muted-foreground shadow-md">
            Memuat iklan...
          </div>
        </div>
      )}
      <AdsSingleArticleForm
        initialItems={initialItems}
        initialCategories={initialCategories}
        categoryOptions={categoryOptions}
        onLoadScope={loadAdsForScope}
        onSave={handleSave}
      />
    </div>
  );
}
