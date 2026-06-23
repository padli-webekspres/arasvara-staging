"use client";

import React, { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MIN_QUERY_LENGTH = 2;

function buildArticleSearchUrl(query: string) {
  return `/search?type=ARTICLES&q=${encodeURIComponent(query.trim())}`;
}

/**
 * Floating search control for the homepage.
 * Mirrors navbar search: expand input right→left, Enter/search navigates when ≥2 chars,
 * second click while empty closes the bubble.
 */
export default function FloatingSearchButton() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const executeSearch = useCallback(() => {
    const trimmed = value.trim();
    if (trimmed.length >= MIN_QUERY_LENGTH) {
      router.push(buildArticleSearchUrl(trimmed));
      setIsOpen(false);
      setValue("");
    } else {
      setIsOpen(false);
      setValue("");
    }
  }, [value, router]);

  const handleButtonClick = () => {
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
      setIsOpen(false);
      setValue("");
    }
  };

  const hasQuery = value.trim().length > 0;

  return (
    <div
      className="fixed bottom-6 right-4 sm:right-6 z-50 flex items-center flex-row-reverse gap-2 pointer-events-none"
      aria-label="Pencarian berita"
    >
      <Button
        type="button"
        size="icon"
        variant="default"
        onClick={handleButtonClick}
        className={cn(
          "pointer-events-auto h-12 w-12 rounded-full shadow-lg",
          "bg-background hover:bg-background/90 text-primary-foreground",
          "transition-transform duration-200 active:scale-95",
          "touch-manipulation",
          isOpen &&
            hasQuery &&
            "ring-2 ring-background/50 ring-offset-2 ring-offset-background",
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
            "h-8 w-8 transition-transform duration-300 text-hijauSawah",
            isOpen && "scale-110",
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
          onChange={(e) => setValue(e.target.value)}
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
