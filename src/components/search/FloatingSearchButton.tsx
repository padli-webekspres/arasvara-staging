"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MIN_QUERY_LENGTH = 2;
/** Delay setelah mount sebelum auto-demo buka (sekali per kunjungan). */
const AUTO_OPEN_DELAY_MS = 4000;
/** Durasi terbuka sebelum auto-tutup jika tidak ada interaksi. */
const AUTO_CLOSE_DELAY_MS = 3500;
/** Interval nudge ikon saat tertutup. */
const ICON_NUDGE_INTERVAL_MS = 7000;

function buildArticleSearchUrl(query: string) {
  return `/search?type=ARTICLES&q=${encodeURIComponent(query.trim())}`;
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Floating search control for the homepage.
 * Mirrors navbar search: expand input right→left, Enter/search navigates when ≥2 chars,
 * second click while empty closes the bubble.
 *
 * Auto-demo sekali per mount: buka tanpa focus setelah ~4s, tutup setelah ~3.5s
 * jika tidak ada interaksi (klik / fokus / hover).
 */
export default function FloatingSearchButton() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [value, setValue] = useState("");
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [iconNudge, setIconNudge] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const userEngagedRef = useRef(false);
  const autoDemoDoneRef = useRef(false);
  const openTimerRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const nudgeIntervalRef = useRef<number | null>(null);
  const nudgeTimeoutRef = useRef<number | null>(null);
  const scrollIdleTimerRef = useRef<number | null>(null);
  const isOpenRef = useRef(false);

  isOpenRef.current = isOpen;

  const clearOpenTimer = useCallback(() => {
    if (openTimerRef.current != null) {
      window.clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
  }, []);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current != null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const clearNudgeTimers = useCallback(() => {
    if (nudgeIntervalRef.current != null) {
      window.clearInterval(nudgeIntervalRef.current);
      nudgeIntervalRef.current = null;
    }
    if (nudgeTimeoutRef.current != null) {
      window.clearTimeout(nudgeTimeoutRef.current);
      nudgeTimeoutRef.current = null;
    }
    setIconNudge(false);
  }, []);

  const markEngaged = useCallback(() => {
    userEngagedRef.current = true;
    clearOpenTimer();
    clearCloseTimer();
  }, [clearOpenTimer, clearCloseTimer]);

  // Hide on scroll down, show on scroll up or after 3s idle
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // Clear idle timer on any scroll
      if (scrollIdleTimerRef.current != null) {
        window.clearTimeout(scrollIdleTimerRef.current);
        scrollIdleTimerRef.current = null;
      }
      
      // Show if scrolling up or at top
      if (currentScrollY < lastScrollY || currentScrollY < 100) {
        setIsVisible(true);
      } 
      // Hide if scrolling down and past threshold
      else if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setIsVisible(false);
        
        // Show again after 3s idle
        scrollIdleTimerRef.current = window.setTimeout(() => {
          console.log('[FloatingSearch] 3s idle - showing button');
          setIsVisible(true);
          scrollIdleTimerRef.current = null;
        }, 3000);
        console.log('[FloatingSearch] Scroll down - timer set, isVisible=false');
      }
      
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollIdleTimerRef.current != null) {
        window.clearTimeout(scrollIdleTimerRef.current);
      }
    };
  }, [lastScrollY]);

  const scheduleAutoClose = useCallback(() => {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      if (userEngagedRef.current) return;
      setIsOpen(false);
    }, AUTO_CLOSE_DELAY_MS);
  }, [clearCloseTimer]);

  // Auto-demo: sekali, tanpa focus, skip jika reduced-motion / tab hidden / sudah engage
  useEffect(() => {
    if (prefersReducedMotion()) {
      autoDemoDoneRef.current = true;
      return;
    }

    openTimerRef.current = window.setTimeout(() => {
      openTimerRef.current = null;
      if (userEngagedRef.current || autoDemoDoneRef.current) return;
      if (document.visibilityState === "hidden") {
        autoDemoDoneRef.current = true;
        return;
      }
      autoDemoDoneRef.current = true;
      setIsOpen(true);
      scheduleAutoClose();
    }, AUTO_OPEN_DELAY_MS);

    return () => {
      clearOpenTimer();
      clearCloseTimer();
    };
  }, [clearOpenTimer, clearCloseTimer, scheduleAutoClose]);

  // Nudge ikon tiap ~7s saat tertutup; pause saat open / reduced-motion / tab hidden
  useEffect(() => {
    if (prefersReducedMotion()) return;

    const runNudge = () => {
      if (isOpenRef.current) return;
      if (document.visibilityState === "hidden") return;
      setIconNudge(true);
      if (nudgeTimeoutRef.current != null) {
        window.clearTimeout(nudgeTimeoutRef.current);
      }
      nudgeTimeoutRef.current = window.setTimeout(() => {
        nudgeTimeoutRef.current = null;
        setIconNudge(false);
      }, 450);
    };

    nudgeIntervalRef.current = window.setInterval(
      runNudge,
      ICON_NUDGE_INTERVAL_MS,
    );

    return () => {
      clearNudgeTimers();
    };
  }, [clearNudgeTimers]);

  // Saat terbuka (manual), hentikan nudge class
  useEffect(() => {
    if (isOpen) setIconNudge(false);
  }, [isOpen]);

  const executeSearch = useCallback(() => {
    markEngaged();
    const trimmed = value.trim();
    if (trimmed.length >= MIN_QUERY_LENGTH) {
      router.push(buildArticleSearchUrl(trimmed));
    }
    setIsOpen(false);
    setValue("");
  }, [value, router, markEngaged]);

  const handleButtonClick = () => {
    markEngaged();
    if (!isOpen) {
      setIsOpen(true);
      window.setTimeout(() => inputRef.current?.focus(), 100);
      return;
    }
    executeSearch();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      executeSearch();
    } else if (e.key === "Escape") {
      markEngaged();
      setIsOpen(false);
      setValue("");
    }
  };

  const hasQuery = value.trim().length > 0;

  return (
    <div className="fixed bottom-6 right-4 sm:right-6 z-50 flex items-center flex-row-reverse gap-2 pointer-events-none">
      <Button
        type="button"
        size="icon"
        variant="default"
        onClick={handleButtonClick}
        onPointerEnter={markEngaged}
        onFocus={markEngaged}
        className={cn(
          "pointer-events-auto h-12 w-12 rounded-full shadow-lg",
          "bg-hijauSawah hover:bg-hijauSawah/90 text-white",
          "transition-all duration-300 active:scale-95",
          "touch-manipulation",
          isVisible ? "translate-y-0 opacity-100" : "translate-y-32 opacity-0 pointer-events-none",
          isOpen &&
            hasQuery &&
            "ring-2 ring-hijauSawah/40 ring-offset-2 ring-offset-background",
        )}
        aria-label={
          isOpen
            ? hasQuery
              ? "Jalankan pencarian"
              : "Tutup pencarian"
            : "Buka kolom pencarian"
        }
        aria-expanded={isOpen}
      >
        <Search
          className={cn(
            "h-8 w-8 text-white transition-transform duration-300",
            isOpen && "scale-110",
            !isOpen && iconNudge && "floating-search-icon-nudge",
          )}
          aria-hidden
        />
      </Button>

      <div
        className={cn(
          "pointer-events-auto overflow-hidden rounded-full bg-background/95 backdrop-blur-md",
          "border border-foreground/15 shadow-lg",
          "transition-all duration-300 ease-out",
          isOpen
            ? "w-[min(calc(100vw-6rem),16rem)] sm:w-56 md:w-64 opacity-100"
            : "w-0 opacity-0 border-transparent shadow-none",
        )}
        onPointerEnter={markEngaged}
        onFocusCapture={markEngaged}
      >
        <label htmlFor="floating-home-search" className="sr-only">
          Cari berita
        </label>
        <input
          id="floating-home-search"
          ref={inputRef}
          type="search"
          placeholder="Cari berita..."
          value={value}
          onChange={(e) => {
            markEngaged();
            setValue(e.target.value);
          }}
          onKeyDown={handleKeyDown}
          tabIndex={isOpen ? 0 : -1}
          className={cn(
            "w-full min-w-0 bg-transparent px-4 py-3.5 text-sm",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-hijauSawah/40 rounded-full",
            "placeholder:text-muted-foreground",
            !isOpen && "invisible",
          )}
          enterKeyHint="search"
        />
      </div>
    </div>
  );
}
