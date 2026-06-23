"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import HeroVideo from "./HeroVideo";
import HeadlineSlider from "@/components/news/HeadlineSlider";
import type { Article } from "@/types/article";
import { useSnapScroll } from "@/hooks/animation/useSnapScrollHomepage";
import PopularNewsCarousel from "./carousel/PopularNewsCarousel";
// import { VideoSocmedCarousel } from "./carousel/VideoSocmedCarousel";
import TitleHomepage from "@/components/homepage/TitleHomepage";
import Link from "next/link";
import { SectionArticleItem } from "@/types/articleSection";
import Image from "next/image";
import AdsCarousel from "../ads/carousel/AdsCarousel";
import { AdsCarouselVariant, type HomepageAdItem } from "@/types/ads";
import SectionText from "../aboutUs/SectionText";

interface SnapWrapperProps {
  heroVideoUrl: string;
  heroVideoPosterUrl?: string;
  headlines: SectionArticleItem[];
  videoSectionBgUrl?: string; // Tambahkan prop untuk background video section
  /** Data carousel iklan headline dari GET /api/ads/homepage */
  headlineCarouselAds: HomepageAdItem[];
}

const SnapWrapper = ({
  heroVideoUrl,
  heroVideoPosterUrl,
  headlines,
  videoSectionBgUrl,
  headlineCarouselAds,
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
    // Pasang ref di container paling luar
    <div ref={wrapperRef} className="w-full relative">
      {/* SECTION 1: Hero */}
      <section className="snap-panel h-screen w-full  top-0 z-0">
        <HeroVideo videoUrl={heroVideoUrl} posterUrl={heroVideoPosterUrl} />
      </section>

      {/* snap-panel 2: About Us */}
      {/* <SectionText
        title="About us"
        snapPanel
        hideIconMouseBouncing
        variant="light"
      >
        <p className="text-base md:text-lg leading-relaxed">
          Seiring dengan pesatnya perkembangan zaman dan kemajuan teknologi,
          industri media massa mengalami transformasi yang signifikan. Di tengah
          dinamika tersebut serta kompetisi yang semakin kompetitif, khususnya
          pada sektor media portal di Indonesia, Arasvara hadir sebagai entitas
          media baru yang berkomitmen menjawab tantangan dan kebutuhan industri.
        </p>
        <p className="text-base md:text-lg leading-relaxed">
          Nama Arasvara lahir dari diskusi internal yang melibatkan talenta
          muda. Media ini awalnya dirancang dengan nama Arah Suara, kemudian
          dikembangkan menjadi Arasvara agar memiliki identitas yang lebih
          modern, kuat, dan relevan bagi generasi digital. Kata
          &ldquo;Svara&rdquo;, yang berasal dari bahasa Sanskerta dan bermakna
          &ldquo;nada&rdquo; atau &ldquo;suara&rdquo;, merepresentasikan
          aspirasi untuk menghadirkan informasi yang mendengar serta memantulkan
          suara generasi muda Milenial dan Gen Z.
        </p>
      </SectionText> */}

      {/* SECTION 2: Headlines Slider */}
      {/* Ubah min-h-screen menjadi h-screen agar ukurannya pas 1 viewport */}
      <section className="snap-panel h-screen w-full flex items-center bg-background relative z-10">
        <div className="container mx-auto px-4 py-6 md:px-0">
          <form
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
          </form>
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

          {/* banner carousel iklan headline berita */}
          <div className="w-full mt-8">
            <AdsCarousel
              variant={AdsCarouselVariant.HORIZONTAL_LONG}
              ads={headlineCarouselAds}
            />
          </div>
        </div>

        <div className="contai"></div>
      </section>

      {/* SECTION 3: Terpopuler News */}
    </div>
  );
};

export default SnapWrapper;
