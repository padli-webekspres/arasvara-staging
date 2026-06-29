"use client";

import React, { useEffect, useRef, useState, memo } from "react";
import LogoLoader from "./LogoLoader";

interface LoadingOverlayProps {
  isLoading?: boolean;
}

/**
 * LoadingOverlay akan slide ke bawah keluar layar ketika isLoading berubah dari true ke false.
 */
const LoadingOverlay = ({ isLoading = true }: LoadingOverlayProps) => {
  const [show, setShow] = useState(isLoading);
  const [animateOut, setAnimateOut] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isLoading) {
      setShow(true);
      setAnimateOut(false);
      return;
    }

    if (!show) return;

    setAnimateOut(true);
    const timeout = setTimeout(() => setShow(false), 1000);
    return () => clearTimeout(timeout);
  }, [isLoading, show]);

  if (!show) return null;

  // Gunakan memoized LogoLoader agar tidak re-render tanpa perlu
  const MemoLogoLoader = memo(LogoLoader);

  return (
    <div
      ref={overlayRef}
      className={`h-screen w-full flex items-center justify-center bg-[#e5e8e5] fixed inset-0 z-9999 transition-transform duration-1000 ease-in-out ${
        animateOut ? "translate-y-full" : "translate-y-0"
      }`}
      style={{ willChange: "transform" }}
    >
      <MemoLogoLoader onComplete={() => {}} />
    </div>
  );
};

export default LoadingOverlay;
