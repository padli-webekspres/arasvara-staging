"use client";

import React, { useRef, useEffect, useState } from "react";
import { GalleryItem } from "@/types/article";
import { X } from "lucide-react";
import { ResponsiveMediaImage } from "@/components/ui/ResponsiveMediaImage";

interface GalleryImageDialogProps {
  isOpen: boolean;
  galleryItem: GalleryItem | null;
  triggerElement?: HTMLElement | null;
  onClose: () => void;
}

type KillableTimeline = {
  kill: () => void;
  to: (
    target: HTMLElement,
    vars: Record<string, unknown>,
  ) => KillableTimeline;
};

/**
 * Fullscreen gallery preview. GSAP di-import dinamis hanya saat dialog terbuka
 * agar tidak menambah critical path halaman artikel.
 */
const GalleryImageDialog: React.FC<GalleryImageDialogProps> = ({
  isOpen,
  galleryItem,
  triggerElement,
  onClose,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<KillableTimeline | null>(null);

  const [isAnimatingOut, setIsAnimatingOut] = useState(false);

  useEffect(() => {
    if (!cardRef.current || !dialogRef.current) return;
    if (!(isOpen && !isAnimatingOut && triggerElement)) return;

    let cancelled = false;
    const card = cardRef.current;
    const triggerRect = triggerElement.getBoundingClientRect();
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;

    void import("gsap").then(({ default: gsap }) => {
      if (cancelled || !card) return;

      gsap.set(card, {
        opacity: 0,
        scale: 0.3,
        x: triggerRect.left - centerX + triggerRect.width / 2,
        y: triggerRect.top - centerY + triggerRect.height / 2,
      });

      timelineRef.current?.kill();
      timelineRef.current = gsap.timeline() as KillableTimeline;
      timelineRef.current.to(card, {
        opacity: 1,
        scale: 1,
        x: 0,
        y: 0,
        duration: 0.4,
        ease: "power2.inOut",
      });
    });

    return () => {
      cancelled = true;
      timelineRef.current?.kill();
    };
  }, [isOpen, isAnimatingOut, triggerElement]);

  useEffect(() => {
    if (!cardRef.current || !isAnimatingOut || !triggerElement) return;

    let cancelled = false;
    const card = cardRef.current;
    const triggerRect = triggerElement.getBoundingClientRect();
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;

    void import("gsap").then(({ default: gsap }) => {
      if (cancelled || !card) return;

      timelineRef.current?.kill();
      timelineRef.current = gsap.timeline({
        onComplete: () => {
          if (!cancelled) onClose();
        },
      }) as KillableTimeline;

      timelineRef.current.to(card, {
        opacity: 0,
        scale: 0.3,
        x: triggerRect.left - centerX + triggerRect.width / 2,
        y: triggerRect.top - centerY + triggerRect.height / 2,
        duration: 0.4,
        ease: "power2.inOut",
      });
    });

    return () => {
      cancelled = true;
      timelineRef.current?.kill();
    };
  }, [isAnimatingOut, triggerElement, onClose]);

  const handleCloseInternal = () => {
    setIsAnimatingOut(true);
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        dialogRef.current &&
        cardRef.current &&
        e.target === dialogRef.current
      ) {
        handleCloseInternal();
      }
    };

    const dialog = dialogRef.current;
    dialog?.addEventListener("click", handleClickOutside);
    return () => dialog?.removeEventListener("click", handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleCloseInternal();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen && isAnimatingOut) {
      setIsAnimatingOut(false);
    }
  }, [isOpen, isAnimatingOut]);

  if (!isOpen && !isAnimatingOut) return null;
  if (!galleryItem) return null;

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 bg-black/60 z-199 flex items-center justify-center p-4"
    >
      <div
        ref={cardRef}
        className="bg-white rounded-lg overflow-hidden flex flex-col relative w-full max-w-full sm:max-w-xl md:max-w-2xl lg:max-w-4xl max-h-[85vh] sm:max-h-[85vh] md:max-h-[90vh]"
      >
        <button
          onClick={handleCloseInternal}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/90 hover:bg-white transition-colors"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5 text-black" />
        </button>

        <div className="relative w-full aspect-video">
          {(() => {
            const src =
              galleryItem.media?.url || galleryItem.url || "/placeholder.jpg";
            return (
              <ResponsiveMediaImage
                src={src}
                alt={galleryItem.caption || "Gallery Image"}
                className="absolute inset-0 h-full w-full object-cover m-0"
                priority
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 85vw, 90vw"
              />
            );
          })()}
        </div>

        {(galleryItem.credit || galleryItem.caption) && (
          <div className="px-2 md:px-4 py-2 md:py-4 bg-white flex-1 overflow-y-auto">
            {galleryItem.credit && (
              <p className="text-sm font-semibold text-muted-foreground mb-1">
                Oleh: {galleryItem.credit}
              </p>
            )}
            {galleryItem.caption && (
              <p className="text-base text-foreground mb-0 leading-relaxed whitespace-pre-wrap">
                {galleryItem.caption}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default GalleryImageDialog;
