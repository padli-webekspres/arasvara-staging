"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import useSWRInfinite from "swr/infinite";
import axios from "@/lib/axios";
import { Notification } from "@/types/notification";

// ─── Constants ────────────────────────────────────────────────────────────────

const LIMIT = 7;
const POLL_INTERVAL = 30_000; // 30 detik
const IDLE_TIMEOUT = 3 * 60 * 1000; // 3 menit

// ─── Fetcher ──────────────────────────────────────────────────────────────────

async function fetcher(url: string) {
  const res = await axios.get(url);
  return res.data;
}

// ─── Key Generator untuk useSWRInfinite ───────────────────────────────────────

function getKey(
  pageIndex: number,
  previousPageData: any,
  isIdle: boolean,
): string | null {
  // Hentikan polling jika user idle (tab tidak aktif >3 menit)
  if (isIdle) return null;
  // Hentikan infinite scroll jika tidak ada data lagi
  if (previousPageData && !previousPageData.hasMore) return null;
  return `/notification?limit=${LIMIT}&skip=${pageIndex * LIMIT}`;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface UseNotificationsReturn {
  notifications: Notification[];
  unreadCount: number;
  hasMore: boolean;
  isLoading: boolean;
  isIdle: boolean;
  loadMore: () => void;
  markOneRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  refresh: () => void;
  reload: () => void;
  isReloading: boolean;
}

export function useNotifications(): UseNotificationsReturn {
  const [isIdle, setIsIdle] = useState(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Idle detection: jika tab tersembunyi >3 menit, hentikan polling ────────
  useEffect(() => {
    const clearIdleTimer = () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab tidak aktif: mulai timer idle
        clearIdleTimer();
        idleTimerRef.current = setTimeout(() => {
          setIsIdle(true);
        }, IDLE_TIMEOUT);
      } else {
        // Tab aktif lagi: reset idle state
        clearIdleTimer();
        setIsIdle(false);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearIdleTimer();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // ─── SWR Infinite ────────────────────────────────────────────────────────────
  const { data, size, setSize, mutate, isLoading, isValidating } =
    useSWRInfinite(
      (pageIndex, previousPageData) =>
        getKey(pageIndex, previousPageData, isIdle),
      fetcher,
      {
        revalidateOnFocus: true,
        revalidateOnReconnect: true,
        refreshInterval: isIdle ? 0 : POLL_INTERVAL,
        revalidateFirstPage: false,
        dedupingInterval: 5_000,
      },
    );

  // ─── Derived state ────────────────────────────────────────────────────────────
  const notifications: Notification[] = data
    ? data.flatMap((page) => page.notifications ?? [])
    : [];

  const unreadCount: number = data?.[0]?.unreadCount ?? 0;
  const hasMore: boolean = data?.[data.length - 1]?.hasMore ?? false;

  // ─── Actions ──────────────────────────────────────────────────────────────────
  const loadMore = useCallback(() => {
    if (hasMore) setSize((s) => s + 1);
  }, [hasMore, setSize]);

  const markOneRead = useCallback(
    async (id: string) => {
      // Optimistic update: langsung update readAt di local data
      mutate(
        (pages) =>
          pages?.map((page) => ({
            ...page,
            notifications: page.notifications.map((n: Notification) =>
              n._id === id ? { ...n, readAt: new Date() } : n,
            ),
            unreadCount: Math.max(0, (page.unreadCount ?? 0) - 1),
          })),
        false,
      );
      try {
        await axios.patch(`/notification/${id}/read`);
        mutate(); // revalidasi dari server setelah sukses
      } catch (err) {
        mutate(); // fallback: revalidasi dari server jika error
      }
    },
    [mutate],
  );

  const markAllRead = useCallback(async () => {
    // Optimistic update: tandai semua dibaca secara lokal
    mutate(
      (pages) =>
        pages?.map((page) => ({
          ...page,
          notifications: page.notifications.map((n: Notification) => ({
            ...n,
            readAt: n.readAt ?? new Date(),
          })),
          unreadCount: 0,
        })),
      false,
    );
    try {
      await axios.patch("/notification/read-all");
      mutate();
    } catch (err) {
      mutate();
    }
  }, [mutate]);

  // Manual reload: force revalidate all pages
  const reload = useCallback(() => {
    mutate(undefined, { revalidate: true });
  }, [mutate]);

  const refresh = useCallback(() => {
    mutate();
  }, [mutate]);

  return {
    notifications,
    unreadCount,
    hasMore,
    isLoading,
    isIdle,
    loadMore,
    markOneRead,
    markAllRead,
    refresh,
    reload,
    isReloading: isValidating,
  };
}
