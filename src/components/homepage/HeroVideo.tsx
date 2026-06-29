"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import Image from "next/image";

interface HeroVideoProps {
  videoUrl: string;
  posterUrl?: string;
  className?: string;
}

const HeroVideo = ({ videoUrl, posterUrl, className }: HeroVideoProps) => {
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [videoPreload, setVideoPreload] = useState<"metadata" | "auto">(
    "metadata",
  );
  const videoRef = useRef<HTMLVideoElement>(null);
  const hasVideo = Boolean(videoUrl?.trim());

  useEffect(() => {
    if (!hasVideo) return;
    if (videoRef.current && videoRef.current.readyState >= 3) {
      setIsVideoLoaded(true);
    }
  }, [videoUrl, hasVideo]);

  useEffect(() => {
    if (!hasVideo) {
      setIsVideoLoaded(false);
    }
  }, [hasVideo]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(min-width: 768px)");
    const applyPreload = () => {
      setVideoPreload(mediaQuery.matches ? "auto" : "metadata");
    };

    applyPreload();
    mediaQuery.addEventListener("change", applyPreload);

    return () => {
      mediaQuery.removeEventListener("change", applyPreload);
    };
  }, []);

  return (
    <div
      className={cn(
        "relative h-screen w-full overflow-hidden bg-black",
        className,
      )}
    >
      <div
        className={cn(
          "absolute inset-0 z-0 transition-opacity duration-1000 ease-in-out",
          isVideoLoaded ? "opacity-0 pointer-events-none" : "opacity-100",
        )}
      >
        {posterUrl && (
          <Image
            src={posterUrl}
            alt="Hero Background Poster"
            fill
            className="object-cover"
          />
        )}
      </div>

      {hasVideo && (
        <video
          ref={videoRef}
          key={videoUrl}
          autoPlay
          loop
          muted
          playsInline
          preload={videoPreload}
          onCanPlay={() => setIsVideoLoaded(true)}
          className={cn(
            "absolute inset-0 h-full w-full object-cover z-0 transition-opacity duration-1000 ease-in-out",
            isVideoLoaded ? "opacity-100" : "opacity-0",
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
