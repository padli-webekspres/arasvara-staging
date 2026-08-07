"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ResponsiveMediaImage } from "@/components/ui/ResponsiveMediaImage";

interface HeroVideoProps {
  videoUrl: string;
  posterUrl?: string;
  /** Server-rendered poster (preferensi LCP — hindari double img). */
  lcpPoster?: ReactNode;
  className?: string;
}

/**
 * Hero video: di mobile hanya poster (LCP) sampai user scroll/gesture.
 * Tidak auto-load via idle timeout — Lighthouse lab tanpa scroll tidak boleh
 * mengunduh .webm/.mp4 (yang sebelumnya mencuri LCP setelah poster di-fade).
 */
const HeroVideo = ({
  videoUrl,
  posterUrl,
  lcpPoster,
  className,
}: HeroVideoProps) => {
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [shouldLoadVideo, setShouldLoadVideo] = useState(false);
  const [videoPreload, setVideoPreload] = useState<"metadata" | "auto">(
    "metadata",
  );
  const videoRef = useRef<HTMLVideoElement>(null);
  const hasVideo = Boolean(videoUrl?.trim());

  useEffect(() => {
    if (!hasVideo) {
      const reset = window.setTimeout(() => setIsVideoPlaying(false), 0);
      return () => window.clearTimeout(reset);
    }
    return undefined;
  }, [hasVideo]);

  useEffect(() => {
    if (typeof window === "undefined" || !hasVideo) return;

    const mediaQuery = window.matchMedia("(min-width: 768px)");
    const apply = () => {
      const desktop = mediaQuery.matches;
      setVideoPreload(desktop ? "auto" : "metadata");
      if (desktop) {
        setShouldLoadVideo(true);
      }
    };

    apply();
    mediaQuery.addEventListener("change", apply);

    // Mobile: hanya setelah interaksi nyata (bukan idle timeout).
    // Skip Save-Data / koneksi lambat agar tidak menghabiskan kuota.
    const enableMobileVideo = () => {
      if (mediaQuery.matches) return;
      const connection = (
        navigator as Navigator & {
          connection?: { saveData?: boolean; effectiveType?: string };
        }
      ).connection;
      if (connection?.saveData) return;
      if (
        connection?.effectiveType === "slow-2g" ||
        connection?.effectiveType === "2g"
      ) {
        return;
      }
      setShouldLoadVideo(true);
    };

    if (!mediaQuery.matches) {
      let cleaned = false;
      const cleanupInteraction = () => {
        if (cleaned) return;
        cleaned = true;
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("touchstart", onPointer);
        window.removeEventListener("pointerdown", onPointer);
      };
      const onScroll = () => {
        enableMobileVideo();
        cleanupInteraction();
      };
      const onPointer = () => {
        enableMobileVideo();
        cleanupInteraction();
      };

      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("touchstart", onPointer, { passive: true });
      window.addEventListener("pointerdown", onPointer, { passive: true });

      return () => {
        mediaQuery.removeEventListener("change", apply);
        cleanupInteraction();
      };
    }

    return () => {
      mediaQuery.removeEventListener("change", apply);
    };
  }, [hasVideo]);

  return (
    <div
      className={cn(
        "relative h-screen w-full overflow-hidden bg-black",
        className,
      )}
    >
      {/* Poster tetap di bawah video (tidak di-unmount) agar LCP tidak pindah ke monogram */}
      <div
        className={cn(
          "absolute inset-0 z-0 transition-opacity duration-1000 ease-in-out",
          isVideoPlaying ? "opacity-0 pointer-events-none" : "opacity-100",
        )}
      >
        {lcpPoster ??
          (posterUrl ? (
            <ResponsiveMediaImage
              src={posterUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              priority
              sizes="100vw"
            />
          ) : null)}
      </div>

      {hasVideo && shouldLoadVideo && (
        <video
          aria-hidden="true"
          ref={videoRef}
          key={videoUrl}
          autoPlay
          loop
          muted
          playsInline
          preload={videoPreload}
          onPlaying={() => setIsVideoPlaying(true)}
          className={cn(
            "absolute inset-0 h-full w-full object-cover z-0 transition-opacity duration-1000 ease-in-out",
            isVideoPlaying ? "opacity-100" : "opacity-0",
          )}
        >
          <source src={videoUrl} />
          Your browser does not support the video tag.
        </video>
      )}

      <div className="absolute inset-0 bg-black/40 z-0" />
    </div>
  );
};

export default HeroVideo;
