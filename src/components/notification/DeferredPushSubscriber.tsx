"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { scheduleDeferredWork, type DeferHost } from "@/lib/defer-until-idle";
import { getPushEnvironmentIssue } from "@/lib/firebase-host";
import { shouldMountSilentPush } from "@/lib/silent-push";

/**
 * Wrapper client-only: next/dynamic + ssr:false tidak boleh di Server Component layout.
 * Firebase/FCM hanya di-load jika izin sudah granted, setelah idle.
 */
const PushSubscriber = dynamic(
  () => import("@/components/notification/PushSubscriber"),
  { ssr: false },
);

export default function DeferredPushSubscriber() {
  const [shouldLoad, setShouldLoad] = useState(false);
  const loadedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let stopSchedule: (() => void) | undefined;

    const arm = () => {
      if (cancelled || loadedRef.current) return;
      if (getPushEnvironmentIssue()) return;
      if (typeof Notification === "undefined") return;
      if (!shouldMountSilentPush(Notification.permission)) return;
      if (stopSchedule) return;

      stopSchedule = scheduleDeferredWork(() => {
        if (cancelled || loadedRef.current) return;
        loadedRef.current = true;
        setShouldLoad(true);
      }, window as unknown as DeferHost);
    };

    arm();
    window.addEventListener("focus", arm);
    document.addEventListener("visibilitychange", arm);

    return () => {
      cancelled = true;
      stopSchedule?.();
      window.removeEventListener("focus", arm);
      document.removeEventListener("visibilitychange", arm);
    };
  }, []);

  if (!shouldLoad) return null;
  return <PushSubscriber />;
}
