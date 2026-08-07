"use client";

import React, { useEffect, useRef, useState } from "react";
import LogoLoader from "./LogoLoader";

interface LoadingOverlayProps {
  isLoading?: boolean;
}

/**
 * Overlay loading ringan. Tidak me-render jika data sudah siap saat mount
 * (hydration homepage) agar tidak memblok LCP/FCP mobile.
 */
const LoadingOverlay = ({ isLoading = true }: LoadingOverlayProps) => {
  const [show, setShow] = useState(isLoading);
  const [animateOut, setAnimateOut] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const everShownRef = useRef(isLoading);

  useEffect(() => {
    if (isLoading) {
      everShownRef.current = true;
      const id = window.setTimeout(() => {
        setShow(true);
        setAnimateOut(false);
      }, 0);
      return () => window.clearTimeout(id);
    }

    if (!everShownRef.current || !show) {
      const id = window.setTimeout(() => setShow(false), 0);
      return () => window.clearTimeout(id);
    }

    setAnimateOut(true);
    const timeout = setTimeout(() => setShow(false), 300);
    return () => clearTimeout(timeout);
  }, [isLoading, show]);

  if (!show) return null;

  return (
    <div
      ref={overlayRef}
      className={`h-screen w-full flex items-center justify-center bg-[#e5e8e5] fixed inset-0 z-9999 transition-transform duration-300 ease-in-out ${
        animateOut ? "translate-y-full" : "translate-y-0"
      }`}
      style={{ willChange: "transform" }}
    >
      <LogoLoader />
    </div>
  );
};

export default LoadingOverlay;
