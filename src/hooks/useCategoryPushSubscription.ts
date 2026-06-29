"use client";

import { useCallback } from "react";
import api from "@/lib/axios";
import { usePushNotification } from "@/hooks/usePushNotification";

const SUBSCRIBED_CATEGORIES_KEY = "arasvara_cat_subs";

function readSubscribedCategories(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SUBSCRIBED_CATEGORIES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((s) => String(s).trim().toLowerCase())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function markCategorySubscribed(categorySlug: string): void {
  const slug = categorySlug.trim().toLowerCase();
  if (!slug) return;
  const current = new Set(readSubscribedCategories());
  current.add(slug);
  localStorage.setItem(
    SUBSCRIBED_CATEGORIES_KEY,
    JSON.stringify([...current]),
  );
}

export function isSubscribedToCategory(categorySlug: string): boolean {
  const slug = categorySlug.trim().toLowerCase();
  if (!slug) return false;
  return readSubscribedCategories().includes(slug);
}

export function categoryPromptSessionKey(categorySlug: string): string {
  return `arasvara_cat_prompt_${categorySlug.trim().toLowerCase()}`;
}

export function useCategoryPushSubscription() {
  const { subscribe } = usePushNotification();

  const subscribeToCategory = useCallback(
    async (categorySlug: string): Promise<{ ok: true } | { ok: false; reason: string }> => {
      const slug = categorySlug.trim().toLowerCase();
      if (!slug) {
        return { ok: false, reason: "Kategori tidak valid." };
      }

      const subscribeResult = await subscribe();
      if (!subscribeResult.ok) {
        return { ok: false, reason: subscribeResult.reason };
      }

      try {
        await api.post("/push-token/category-subscribe", {
          token: subscribeResult.token,
          categorySlug: slug,
        });
        markCategorySubscribed(slug);
        return { ok: true };
      } catch (err: unknown) {
        const axiosErr = err as {
          response?: { data?: { error?: string } };
        };
        const reason =
          axiosErr.response?.data?.error ??
          "Gagal subscribe notifikasi kategori.";
        return { ok: false, reason };
      }
    },
    [subscribe],
  );

  return {
    subscribeToCategory,
    isSubscribedToCategory,
    categoryPromptSessionKey,
  };
}
