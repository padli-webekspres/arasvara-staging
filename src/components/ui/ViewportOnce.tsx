"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

const DEFAULT_ROOT_MARGIN = "600px 0px";
const DEFAULT_TIMEOUT_MS = 8000;

/**
 * Mount children once the placeholder mendekati viewport.
 * Tanpa IntersectionObserver atau jika timeout, children tetap di-mount.
 */
export default function ViewportOnce({
  children,
  fallback,
  rootMargin = DEFAULT_ROOT_MARGIN,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: {
  children: ReactNode;
  fallback: ReactNode;
  rootMargin?: string;
  timeoutMs?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (show) return;
    const el = ref.current;
    if (!el) return;

    if (typeof IntersectionObserver === "undefined") {
      // Tanpa IO: mount di tick berikutnya (jangan setState sync di body effect).
      const id = window.setTimeout(() => setShow(true), 0);
      return () => window.clearTimeout(id);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShow(true);
        }
      },
      { rootMargin, threshold: 0 },
    );
    observer.observe(el);
    const timer = window.setTimeout(() => setShow(true), timeoutMs);

    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, [show, rootMargin, timeoutMs]);

  return <div ref={ref}>{show ? children : fallback}</div>;
}
