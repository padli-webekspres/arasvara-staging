"use client";

import { RefObject, useEffect, useRef } from "react";
import { trackAdImpression } from "@/lib/ga-events";

interface AdImpressionParams {
  ad_id: string;
  ad_position: string;
  ad_size: string;
  ad_sponsor: string;
}

/**
 * Hook untuk mendeteksi banner iklan masuk ke viewport dan mengirim event `ad_impression`.
 *
 * - Menggunakan IntersectionObserver (threshold 0) agar langsung terpicu saat 1 pixel terlihat.
 * - Hanya fire sekali per instance per page load (tidak perlu sessionStorage karena
 *   page refresh = pengguna melihat iklan baru).
 * - Guard: jika `ad_id` kosong, no-op untuk menghindari data sampah.
 * - Cleanup `observer.disconnect()` pada unmount.
 *
 * @param adRef   - Ref ke elemen wrapper banner iklan.
 * @param params  - Parameter event: ad_id, ad_position, ad_size, ad_sponsor.
 */
export function useAdImpressionTracking(
  adRef: RefObject<HTMLElement | null>,
  params: AdImpressionParams,
): void {
  const hasFired = useRef(false);

  useEffect(() => {
    if (!params.ad_id) return;

    const el = adRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !hasFired.current) {
            hasFired.current = true;
            trackAdImpression({
              ...params,
              page_location: typeof window !== "undefined" ? window.location.href : "",
            });
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0 },
    );

    observer.observe(el);

    return () => observer.disconnect();
  }, [adRef, params.ad_id, params.ad_position, params.ad_size, params.ad_sponsor]);
}
