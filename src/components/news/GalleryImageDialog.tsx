"use client";

import React, { useRef, useEffect, useState } from "react";
import gsap from "gsap";
import { GalleryItem } from "@/types/article";
import Image from "next/image";
import { X } from "lucide-react";
import { shouldUnoptimizeNewsCardImage } from "@/lib/utils";

interface GalleryImageDialogProps {
  isOpen: boolean;
  galleryItem: GalleryItem | null;
  triggerElement?: HTMLElement | null;
  onClose: () => void;
}

/**
 * GalleryImageDialog Component
 *
 * Fullscreen modal untuk preview image gallery dengan:
 * - Backdrop transparan hitam (fixed fullscreen)
 * - Card center dengan image, credit, dan caption (responsive sizing)
 * - Close button di pojok kanan atas
 * - GSAP animation: card muncul/hilang dari/ke image yang diklik
 * - Animasi keluar smooth sebelum dialog ditutup
 * - Tutup otomatis ketika click outside card atau Escape
 */
const GalleryImageDialog: React.FC<GalleryImageDialogProps> = ({
  isOpen,
  galleryItem,
  triggerElement,
  onClose,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);

  // State untuk track apakah sedang animate keluar
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);

  // GSAP Animation: card appear dengan scale & position
  // Jalankan saat dialog dibuka
  useEffect(() => {
    if (!cardRef.current || !dialogRef.current) return;

    // Jika dialog baru dibuka (isOpen true dan tidak sedang animate out)
    if (isOpen && !isAnimatingOut && triggerElement) {
      // Get posisi image awal
      const triggerRect = triggerElement.getBoundingClientRect();
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;

      // Set initial state: card berada di posisi image dengan scale kecil
      gsap.set(cardRef.current, {
        opacity: 0,
        scale: 0.3,
        x: triggerRect.left - centerX + triggerRect.width / 2,
        y: triggerRect.top - centerY + triggerRect.height / 2,
      });

      // Animate card dari posisi image ke center dengan scale normal
      if (timelineRef.current) {
        timelineRef.current.kill();
      }

      timelineRef.current = gsap.timeline();
      timelineRef.current.to(cardRef.current, {
        opacity: 1,
        scale: 1,
        x: 0,
        y: 0,
        duration: 0.4,
        ease: "power2.inOut",
      });
    }

    return () => {
      if (timelineRef.current) {
        timelineRef.current.kill();
      }
    };
  }, [isOpen, isAnimatingOut, triggerElement]);

  // GSAP Animation: card disappear dengan scale & position
  // Jalankan saat dialog ditutup (animasi keluar)
  useEffect(() => {
    if (!cardRef.current || !isAnimatingOut || !triggerElement) return;

    // Get posisi image untuk animasi keluar
    const triggerRect = triggerElement.getBoundingClientRect();
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;

    // Kill timeline sebelumnya jika ada
    if (timelineRef.current) {
      timelineRef.current.kill();
    }

    // Animate card kembali ke posisi image & scale kecil
    timelineRef.current = gsap.timeline({
      onComplete: () => {
        // Setelah animasi selesai, panggil parent onClose()
        onClose();
      },
    });

    timelineRef.current.to(cardRef.current, {
      opacity: 0,
      scale: 0.3,
      x: triggerRect.left - centerX + triggerRect.width / 2,
      y: triggerRect.top - centerY + triggerRect.height / 2,
      duration: 0.4,
      ease: "power2.inOut",
    });

    return () => {
      if (timelineRef.current) {
        timelineRef.current.kill();
      }
    };
  }, [isAnimatingOut, triggerElement, onClose]);

  // Handler internal untuk close: trigger animasi keluar
  const handleCloseInternal = () => {
    setIsAnimatingOut(true);
  };

  // Handle click outside card untuk close dialog
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      // Jika click pada backdrop (dialogRef) tapi bukan pada card (cardRef), maka close
      if (
        dialogRef.current &&
        cardRef.current &&
        e.target === dialogRef.current
      ) {
        handleCloseInternal();
      }
    };

    // Tambah event listener pada backdrop
    if (dialogRef.current) {
      dialogRef.current.addEventListener("click", handleClickOutside);
    }

    return () => {
      if (dialogRef.current) {
        dialogRef.current.removeEventListener("click", handleClickOutside);
      }
    };
  }, [isOpen]);

  // Handle keyboard escape untuk close dialog
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

  // Reset isAnimatingOut saat dialog ditutup (isOpen false)
  useEffect(() => {
    if (!isOpen && isAnimatingOut) {
      setIsAnimatingOut(false);
    }
  }, [isOpen, isAnimatingOut]);

  // Return null hanya saat dialog tidak open dan tidak sedang animate out
  if (!isOpen && !isAnimatingOut) return null;

  // Return null jika tidak ada gallery item yang dipilih
  if (!galleryItem) return null;

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 bg-black/60 z-199 flex items-center justify-center p-4"
    >
      {/* Card Container - Responsive Sizing */}
      <div
        ref={cardRef}
        className="bg-white rounded-lg overflow-hidden flex flex-col relative w-full max-w-full sm:max-w-xl md:max-w-2xl lg:max-w-4xl max-h-[85vh] sm:max-h-[85vh] md:max-h-[90vh]"
      >
        {/* Close Button */}
        <button
          onClick={handleCloseInternal}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/90 hover:bg-white transition-colors"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5 text-black" />
        </button>

        {/* Image Container */}
        <div className="relative w-full aspect-video">
          {(() => {
            const src =
              galleryItem.media?.url || galleryItem.url || "/placeholder.jpg";
            return (
              <Image
                src={src}
                alt={galleryItem.caption || "Gallery Image"}
                fill
                className="object-cover w-full m-0"
                priority
                unoptimized={shouldUnoptimizeNewsCardImage(src)}
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 85vw, 90vw"
              />
            );
          })()}
        </div>

        {/* Info Container - Scrollable */}
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
