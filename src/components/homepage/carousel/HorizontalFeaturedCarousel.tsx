"use client";

import React, { useRef, useEffect } from "react";
import Image from "next/image";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { Article, ArticleListResponse } from "@/types/article";
import TersierNewsCard from "@/components/news/TersierNewsCard";
import { SectionArticleItem } from "@/types/articleSection";
import { AdsCard } from "@/components/ads/card/adsCard";
import {
  ADS_CARD_DEFAULT_BANNER,
  AdsCardVariant,
} from "@/types/ads";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

/** Wrapper lebar mengikuti slide artikel di strip horizontal (TersierNewsCard). */
const FEATURED_ARTICLE_SLIDE =
  "w-[90vw] md:w-[75vw] lg:w-[60vw] max-w-3xl shrink-0 aspect-3/2";

/** Slide iklan lebih lebar bila adSpan === 2 (setara ide span di NewsCarouselUi). */
const FEATURED_AD_SLIDE_WIDE =
  "w-[94vw] md:w-[85vw] lg:w-[78vw] max-w-6xl shrink-0 aspect-3/2";

function featuredAdSlideClass(adSpan: 1 | 2): string {
  return adSpan === 2 ? FEATURED_AD_SLIDE_WIDE : FEATURED_ARTICLE_SLIDE;
}

/**
 * ScrollTrigger sering dihitung terlalu cepat di production (Vercel):
 * gambar remote/font belum selesai → scrollWidth / spacer pin salah.
 * Double rAF memaksa refresh setelah paint/layout stabil.
 */
function scheduleScrollTriggerRefresh(): void {
  ScrollTrigger.refresh();
  requestAnimationFrame(() => {
    ScrollTrigger.refresh();
    requestAnimationFrame(() => ScrollTrigger.refresh());
  });
}

/**
 * Refresh pin horizontal ketika img dalam track selesai load — penting untuk Next/Image + CDN.
 * MutationObserver menangkap node gambar yang ter-mount belakangan.
 */
function observeImagesForPinRefresh(track: HTMLElement): () => void {
  const refresh = () => scheduleScrollTriggerRefresh();

  const bindImg = (img: HTMLImageElement) => {
    if (img.complete) return;
    img.addEventListener("load", refresh, { once: true });
    img.addEventListener("error", refresh, { once: true });
  };

  track.querySelectorAll("img").forEach((el) => {
    if (el instanceof HTMLImageElement) bindImg(el);
  });

  const mo = new MutationObserver((records) => {
    for (const rec of records) {
      rec.addedNodes.forEach((node) => {
        if (node instanceof HTMLImageElement) bindImg(node);
        else if (node instanceof HTMLElement) {
          node.querySelectorAll("img").forEach((img) => {
            if (img instanceof HTMLImageElement) bindImg(img);
          });
        }
      });
    }
  });
  mo.observe(track, { childList: true, subtree: true });

  return () => mo.disconnect();
}

export interface HorizontalFeaturedSectionProps {
  articles: SectionArticleItem[];
  showAds?: boolean;
  adBannerUrl?: string;
  adSpan?: 1 | 2;
}

const HorizontalFeaturedSection = ({
  articles,
  showAds = false,
  adBannerUrl = ADS_CARD_DEFAULT_BANNER,
  adSpan = 1,
}: HorizontalFeaturedSectionProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const safeAdSpan = adSpan === 2 ? 2 : 1;

  useGSAP(
    () => {
      if (!containerRef.current || !trackRef.current || articles.length === 0)
        return;

      const track = trackRef.current;
      const container = containerRef.current;

      const getScrollAmount = () =>
        Math.max(0, track.scrollWidth - window.innerWidth);

      gsap.to(track, {
        x: () => -getScrollAmount(),
        ease: "none",
        scrollTrigger: {
          trigger: container,
          pin: true,
          scrub: 1,
          start: "top top",
          end: () => `+=${getScrollAmount()}`,
          invalidateOnRefresh: true,
          fastScrollEnd: true,
        },
      });

      scheduleScrollTriggerRefresh();

      const timers: ReturnType<typeof setTimeout>[] = [
        setTimeout(scheduleScrollTriggerRefresh, 120),
        setTimeout(scheduleScrollTriggerRefresh, 400),
        setTimeout(scheduleScrollTriggerRefresh, 1000),
      ];

      const onWindowLoad = () => scheduleScrollTriggerRefresh();
      window.addEventListener("load", onWindowLoad);

      void document.fonts?.ready.then(scheduleScrollTriggerRefresh);

      const ro = new ResizeObserver(scheduleScrollTriggerRefresh);
      ro.observe(track);
      ro.observe(container);

      const unobserveImages = observeImagesForPinRefresh(track);

      return () => {
        window.removeEventListener("load", onWindowLoad);
        timers.forEach(clearTimeout);
        unobserveImages();
        ro.disconnect();
      };
    },
    {
      scope: containerRef,
      dependencies: [articles, showAds, adBannerUrl, safeAdSpan],
    },
  );

  useEffect(() => {
    if (!articles.length) return;
    scheduleScrollTriggerRefresh();
  }, [articles, showAds, adBannerUrl, safeAdSpan]);

  if (!articles || articles.length === 0) return null;

  return (
    <section
      ref={containerRef}
      className="relative w-full h-screen bg-neutral-900 overflow-hidden flex items-center"
    >
      <div className="absolute inset-0 bg-black/40 z-1" />

      <Image
        src="https://images.unsplash.com/photo-1515378791036-0648a3ef77b2"
        width={1920}
        height={1080}
        unoptimized
        className="absolute inset-0 w-full h-full object-cover object-center z-0 blur-sm opacity-50"
        alt="Arasvara Background"
        priority
        onLoad={scheduleScrollTriggerRefresh}
      />

      <div
        ref={trackRef}
        className="relative z-10 flex h-fit w-max items-center gap-8 px-4 md:px-12"
      >
        <div className="w-[10vw] shrink-0" />

        {showAds && (
          <div className={featuredAdSlideClass(safeAdSpan)}>
            <AdsCard
              variant={AdsCardVariant.FEATURED}
              bannerUrl={adBannerUrl}
              alt="Iklan"
            />
          </div>
        )}

        {articles
          .filter((item) => item && item.article)
          .map((item, idx) => {
            const articleData = item.article as Article | ArticleListResponse;
            if (!articleData) return null;
            return (
              <div
                key={item._id || idx}
                className={FEATURED_ARTICLE_SLIDE}
              >
                <TersierNewsCard article={articleData} />
              </div>
            );
          })}

        <div className="w-[10vw] shrink-0" />
      </div>
    </section>
  );
};

export default HorizontalFeaturedSection;
