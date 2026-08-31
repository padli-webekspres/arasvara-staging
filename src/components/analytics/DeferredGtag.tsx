"use client";

import { useEffect } from "react";
import { scheduleDeferredWork, type DeferHost } from "@/lib/defer-until-idle";
import { injectGtagScript } from "@/lib/load-gtag";

/**
 * Mengunduh gtag.js setelah idle / interaksi / tab hidden.
 * Stub gtag harus sudah terpasang di HTML agar event tetap mengantri.
 */
export default function DeferredGtag({
  measurementId,
}: {
  measurementId: string;
}) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    return scheduleDeferredWork(() => {
      injectGtagScript(measurementId, document);
    }, window as unknown as DeferHost);
  }, [measurementId]);

  return null;
}
