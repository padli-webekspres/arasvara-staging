"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import BaseAdCard from "@/components/ads/card/BaseAdCard";
import { cn } from "@/lib/utils";

type HomepageAdsRatio = "21:9" | "16:9" | "4:3";

interface HomepageAdsSectionProps {
  ratio?: HomepageAdsRatio;
  items?: HomepageAdsSectionItem[];
  defaultImageSrc?: string;
}

export interface HomepageAdsSectionItem {
  id: string;
  src?: string;
  alt?: string;
  linkUrl?: string;
}

const RATIO_CONFIG: Record<
  HomepageAdsRatio,
  { width: number; height: number; containerWidthClass: string }
> = {
  "21:9": {
    width: 21,
    height: 9,
    containerWidthClass: "w-full lg:w-3/4",
  },
  "16:9": {
    width: 16,
    height: 9,
    containerWidthClass: "w-full lg:w-1/3",
  },
  "4:3": {
    width: 4,
    height: 3,
    containerWidthClass: "w-full lg:w-1/2",
  },
};

export default function HomepageAdsSection({
  ratio = "4:3",
  items = [],
  defaultImageSrc = "/ads-banner/Banner-970x250.png",
}: HomepageAdsSectionProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const total = items.length;
  const config = RATIO_CONFIG[ratio];

  const activeAd = useMemo(() => items[activeIndex], [items, activeIndex]);
  const activeLinkUrl = activeAd?.linkUrl?.trim();
  const isClickable = Boolean(activeLinkUrl);

  if (total === 0 || !activeAd) return null;

  const goPrev = () => {
    setActiveIndex((prev) => (prev - 1 + total) % total);
  };

  const goNext = () => {
    setActiveIndex((prev) => (prev + 1) % total);
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative flex w-full justify-center">
        <div className={cn("mx-auto", config.containerWidthClass)}>
          {isClickable ? (
            <a
              href={activeLinkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <BaseAdCard
                width={config.width}
                height={config.height}
                defaultSrc={defaultImageSrc}
                src={activeAd.src}
                alt={activeAd.alt}
                interactive
              />
            </a>
          ) : (
            <BaseAdCard
              width={config.width}
              height={config.height}
              defaultSrc={defaultImageSrc}
              src={activeAd.src}
              alt={activeAd.alt}
            />
          )}
        </div>

        {total > 1 && (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute -left-1 md:left-2 lg:left-[10%] top-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-background/80 hover:bg-background shadow-sm"
              onClick={goPrev}
              aria-label="Ads sebelumnya"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute -right-1 md:right-2 lg:right-[10%] top-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-background/80 hover:bg-background shadow-sm"
              onClick={goNext}
              aria-label="Ads berikutnya"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>

      {total > 1 && (
        <div className="flex items-center gap-2">
          {items.map((ad, index) => (
            <button
              key={ad.id}
              type="button"
              aria-label={`Pilih ads ${index + 1}`}
              onClick={() => setActiveIndex(index)}
              className="flex min-h-11 min-w-11 items-center justify-center"
            >
              <span
                className={cn(
                  "block h-2 rounded-full transition-all",
                  index === activeIndex
                    ? "w-6 bg-foreground"
                    : "w-2 bg-muted-foreground/40",
                )}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
