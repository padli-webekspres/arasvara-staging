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
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Apabila video sudah termuat dan siap diputar sejak awal (cache), langsung update state
    if (videoRef.current && videoRef.current.readyState >= 3) {
      setIsVideoLoaded(true);
    }
  }, [videoUrl]);

  return (
    <div className={cn("relative h-screen w-full overflow-hidden bg-black", className)}>
      {/* Optimized Poster Image (Prioritas utama LCP) */}
      <div 
        className={cn(
          "absolute inset-0 z-0 transition-opacity duration-1000 ease-in-out", 
          isVideoLoaded ? "opacity-0 pointer-events-none" : "opacity-100"
        )}
      >
        {posterUrl && (
        <Image
          src={posterUrl}
            alt="Hero Background Poster"
            fill
            priority
            className="object-cover"
          />
        )}
      </div>

      <video
        ref={videoRef}
        key={videoUrl}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        onCanPlay={() => setIsVideoLoaded(true)}
        className={cn(
          "absolute inset-0 h-full w-full object-cover z-0 transition-opacity duration-1000 ease-in-out",
          isVideoLoaded ? "opacity-100" : "opacity-0"
        )}
      >
        <source src={videoUrl} />
        Your browser does not support the video tag.
      </video>

      <div className="absolute inset-0 bg-black/40 z-0" />
      
      {/* Monogram Arasvara putih di tengah, responsif */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
        <Image
          src="/logo-arasvara/main-logo/main-logo-putih-naskah.png"
          alt="Arasvara Monogram"
          className="h-12 md:h-20 lg:h-24 object-contain select-none"
          draggable={false}
          priority={true}
          width={500}
          height={500}
        />
      </div>
    </div>
  );
};

export default HeroVideo;
