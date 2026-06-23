"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  getCurrentPageContext,
  isGaExcludedPath,
  trackPageView,
} from "@/lib/google-analytics";

/**
 * Mengirim page_view GA4 pada setiap perubahan route (initial load + SPA navigation).
 * Metadata artikel dikirim terpisah via useArticleTracking → view_article.
 */
export default function GaRouteTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastTrackedRef = useRef<string | null>(null);

  const search = searchParams.toString();
  const pagePath = search ? `${pathname}?${search}` : pathname;

  useEffect(() => {
    if (isGaExcludedPath(pathname)) return;

    if (lastTrackedRef.current === pagePath) return;

    const ctx = getCurrentPageContext();
    trackPageView({
      pagePath: ctx.pagePath || pagePath,
      pageLocation: ctx.pageLocation,
      pageTitle: ctx.pageTitle,
    });

    lastTrackedRef.current = pagePath;
  }, [pathname, search, pagePath]);

  return null;
}
