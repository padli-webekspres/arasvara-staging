"use client";

import { useEffect, useRef } from "react";
import type { Swiper as SwiperType } from "swiper";

/**
 * Custom hook untuk menambahkan support Shift + Scroll Mouse pada Swiper carousel.
 *
 * Fitur:
 * - Mendeteksi tombol Shift saat user melakukan scroll
 * - Mengkonversi vertical scroll menjadi horizontal scroll pada carousel
 * - Bekerja seamless dengan free mode Swiper
 *
 * Usage:
 * ```tsx
 * const swiperRef = useRef<SwiperType | null>(null);
 * const containerRef = useCarouselShiftScroll(swiperRef);
 *
 * <Swiper onSwiper={(swiper) => (swiperRef.current = swiper)}>
 * ```
 */
export function useCarouselShiftScroll(
  swiperRef: React.MutableRefObject<SwiperType | null | undefined>,
) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Ref untuk debounce agar satu scroll hanya trigger satu slide
    const debounceTimeout = {
      current: null as null | ReturnType<typeof setTimeout>,
    };
    let isScrolling = false;

    /**
     * Handler untuk mendeteksi Shift + Scroll dan mengkonversi ke horizontal scroll
     */
    const handleShiftScroll = (event: WheelEvent) => {
      if (!event.shiftKey) return;
      if (!containerRef.current?.contains(event.target as Node)) return;
      event.preventDefault();
      if (!swiperRef.current) return;

      const threshold = 40;
      if (isScrolling) return; // Debounce: abaikan jika masih dalam jeda

      if (event.deltaY > threshold) {
        swiperRef.current.slideNext();
        isScrolling = true;
      } else if (event.deltaY < -threshold) {
        swiperRef.current.slidePrev();
        isScrolling = true;
      }

      if (isScrolling) {
        // Reset debounce setelah 300ms
        if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
        debounceTimeout.current = setTimeout(() => {
          isScrolling = false;
        }, 300);
      }
    };

    containerRef.current.addEventListener("wheel", handleShiftScroll, {
      passive: false,
    });

    return () => {
      if (containerRef.current) {
        containerRef.current.removeEventListener("wheel", handleShiftScroll);
      }
      if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    };
  }, [swiperRef]);

  return containerRef;
}
