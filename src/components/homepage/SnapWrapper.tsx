"use client";

import { useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import HeroVideo from "./HeroVideo";
import HeadlineSlider from "@/components/news/HeadlineSlider";
import { useSnapScroll } from "@/hooks/animation/useSnapScrollHomepage";
import Link from "next/link";
import { SectionArticleItem } from "@/types/articleSection";
import { AdsCarouselVariant, type HomepageAdItem } from "@/types/ads";

const AdsCarousel = dynamic(() => import("../ads/carousel/AdsCarousel"), {
  ssr: false,
  loading: () => <div className="mt-8 min-h-[80px] w-full" aria-hidden="true" />,
});

interface SnapWrapperProps {
  heroVideoUrl: string;
  heroVideoPosterUrl?: string;
  headlines: SectionArticleItem[];
  videoSectionBgUrl?: string;
  headlineCarouselAds: HomepageAdItem[];
  /** Server-rendered monogram — dari page.tsx */
  lcpMonogram: ReactNode;
  /** Server-rendered hero poster untuk LCP */
  lcpPoster?: ReactNode;
}

const SnapWrapper = ({
  heroVideoUrl,
  heroVideoPosterUrl,
  headlines,
  headlineCarouselAds,
  lcpMonogram,
  lcpPoster,
}: SnapWrapperProps) => {
  const wrapperRef = useSnapScroll();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim().length >= 2) {
      router.push(
        `/search?type=ARTICLES&q=${encodeURIComponent(searchQuery.trim())}`,
      );
    }
  };

  return (
    <div ref={wrapperRef} className="w-full relative isolate">
      <section className="snap-panel sticky top-0 h-screen w-full z-0">
        <div className="relative h-screen w-full overflow-hidden">
          <HeroVideo
            videoUrl={heroVideoUrl}
            posterUrl={heroVideoPosterUrl}
            lcpPoster={lcpPoster}
          />
          {lcpMonogram}
        </div>
      </section>

      {/* Tinggi mengikuti konten (bukan h-screen) agar layout aman saat konten pendek/panjang */}
      <section className="relative z-10 w-full bg-background overflow-x-hidden min-h-screen flex items-center">
        <div className="container mx-auto w-full min-w-0 px-4 md:px-6 lg:px-8 py-8 md:py-10 lg:py-12">
          {/* <form
            onSubmit={handleSearchSubmit}
            className="relative flex items-center w-full max-w-xl mx-auto mb-10 bg-foreground/5 backdrop-blur-sm border border-foreground/10 rounded-full shadow-inner focus-within:ring-2 focus-within:ring-hijauSawah/30 focus-within:border-hijauSawah/50 transition-all duration-300 group"
          >
            <Search className="absolute left-4 w-5 h-5 text-foreground/40 group-focus-within:text-hijauSawah transition-colors duration-300 pointer-events-none" />
            <input
              type="text"
              placeholder="Temukan berita, topik hangat, atau kategori..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent pl-12 pr-28 py-3.5 text-sm md:text-base text-foreground placeholder:text-foreground/40 focus:outline-none rounded-full min-h-[44px]"
            />
            <button
              type="submit"
              className="absolute right-1.5 top-1.5 bottom-1.5 px-6 bg-hijauSawah hover:bg-hijauSawah/95 text-white font-medium text-xs md:text-sm rounded-full shadow-sm hover:shadow-md active:scale-95 transition-all duration-200 flex items-center justify-center cursor-pointer"
            >
              Cari
            </button>
          </form> */}
          <div className="flex items-center md:items-end justify-between mb-4 flex-col md:flex-row">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-center w-full md:w-auto text-primary">
              Headline Berita
            </h2>
            <Link
              href={"/indeks"}
              className="text-lg transition-all hover:font-semibold text-hijauSawah"
            >
              Lihat Berita Hari Ini
            </Link>
          </div>
          <HeadlineSlider articles={headlines} />

          <div className="w-full mt-8">
            <AdsCarousel
              variant={AdsCarouselVariant.HORIZONTAL_LONG}
              ads={headlineCarouselAds}
            />
          </div>
        </div>
      </section>
    </div>
  );
};

export default SnapWrapper;
