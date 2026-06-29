"use client";
import FotografiCarousel from "@/components/homepage/carousel/FotografiCarousel";

import { useQuery } from "@tanstack/react-query";
import { fetcher } from "@/lib/fetcher";
import Image from "next/image";
import { Loader2 } from "lucide-react";
import HeadlineSlider from "@/components/news/HeadlineSlider";
import HeroCard from "@/components/news/HeroCard";
import SecondaryNewsCard from "@/components/news/SecondaryNewsCard";
import NewsCard from "@/components/news/NewsCard";
import TopicNewsCard from "@/components/news/TopicNewsCard";
import LoadMoreButton from "@/components/ui/LoadMoreButton";

const SELECTED_TOPICS_MOCK = [
  {
    topicName: "Gulf War",
    topicSlug: "gulf-war",
    articles: [
      {
        title:
          "Big Tech is moving data out of the Gulf through Iraqi oil pipelines",
        slug: "big-tech-is-moving-data-out-of-the-gulf-through-iraqi-oil-pipelines",
        author: "INDRANIL GHOSH",
        imageUrl:
          "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?q=80&w=600&auto=format&fit=crop",
      },
      {
        title: "War in the Gulf could tilt the cloud race toward China",
        slug: "war-in-the-gulf-could-tilt-the-cloud-race-toward-china",
        author: "KINLING LO",
        imageUrl:
          "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=600&auto=format&fit=crop",
      },
      {
        title:
          '"Data embassies" and safeguarding digital assets during wartime',
        slug: "data-embassies-and-safeguarding-digital-assets-during-wartime",
        author: "RINA CHANDRAN",
        imageUrl:
          "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?q=80&w=600&auto=format&fit=crop",
      },
    ],
  },
  {
    topicName: "Big Tech pushback",
    topicSlug: "big-tech-pushback",
    articles: [
      {
        title: "Meta's Oversight Board races to govern the AI surge",
        slug: "metas-oversight-board-races-to-govern-the-ai-surge",
        author: "ANANYA BHATTACHARYA",
        imageUrl:
          "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=600&auto=format&fit=crop",
      },
      {
        title:
          "Countries are outlawing online gambling ads. Meta is selling them anyway",
        slug: "countries-are-outlawing-online-gambling-ads-meta-is-selling-them-anyway",
        author: "HAZEL GANDHI",
        imageUrl:
          "https://images.unsplash.com/photo-1596838132731-3301c3fd4317?q=80&w=600&auto=format&fit=crop",
      },
      {
        title:
          "Indigenous creators are clashing with YouTube's and Instagram's sensitive content bans",
        slug: "indigenous-creators-are-clashing-with-youtubes-and-instagrams-sensitive-content-bans",
        author: "GABRIEL DAROS",
        imageUrl:
          "https://images.unsplash.com/photo-1528605248644-14dd04022da1?q=80&w=600&auto=format&fit=crop",
      },
    ],
  },
  {
    topicName: "The AI Race",
    topicSlug: "the-ai-race",
    articles: [
      {
        title: "Silicon Valley keeps misreading China's role in tech",
        slug: "silicon-valley-keeps-misreading-chinas-role-in-tech",
        author: "LEX ZHAO",
        imageUrl:
          "https://images.unsplash.com/photo-1508672019048-805c876b67e2?q=80&w=600&auto=format&fit=crop",
      },
      {
        title:
          'The Filipino virtual assistants behind LinkedIn\'s "thought leadership" content mill',
        slug: "the-filipino-virtual-assistants-behind-linkedins-thought-leadership-content-mill",
        author: "MICHAEL BELTRAN",
        imageUrl:
          "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?q=80&w=600&auto=format&fit=crop",
      },
      {
        title: "What's at stake for tech at the Trump-Xi meeting",
        slug: "whats-at-stake-for-tech-at-the-trump-xi-meeting",
        author: "VIOLA ZHOU and KINLING LO",
        imageUrl:
          "https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=600&auto=format&fit=crop",
      },
    ],
  },
];

import { Article } from "@/types/article";
import { useLatestArticles } from "@/hooks/useLatestArticles";

import HeroVideo from "@/components/homepage/HeroVideo";
import TitleHomepage from "@/components/homepage/TitleHomepage";
import EditorChoiceCarousel from "@/components/homepage/carousel/EditorChoiceCarousel";
import BreakingNewsCarousel from "@/components/homepage/carousel/PopularNewsCarousel";
import DividerHorizontal from "@/components/homepage/DividerHorizontal";
import SnapWrapper from "@/components/homepage/SnapWrapper";
import HorizontalFeaturedSection from "@/components/homepage/carousel/HorizontalFeaturedCarousel";
import SnapWrapperBottom from "@/components/homepage/SnapWrapperBottom";
import LoadingOverlay from "@/components/loading/LoadingOverlay";
import { type ReactNode } from "react";
import {
  useCarouselSection,
  useGridSection,
  useFeaturedCategoriesSection,
} from "@/hooks/useSectionsHomepage";
import SponsoredByCarousel from "@/components/homepage/carousel/SponsoredByCarousel";
import PopularNewsCarousel from "@/components/homepage/carousel/PopularNewsCarousel";
import { useConfiguration } from "@/hooks/useConfiguration";
import { useHeadlineArticles } from "@/hooks/useSectionArticles";
import { useHomepageAdsGrouped } from "@/hooks/useAds";
import type { HomepageAdItem } from "@/types/ads";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import SocmedCarousel from "@/components/homepage/socmed/SocmedCarousel";
import YoutubeCarousel from "@/components/homepage/socmed/YoutubeCarousel";
import HorizontalAdCard from "@/components/ads/card/HorizontalAdCard";
import VerticalAdCard from "@/components/ads/card/VerticalAdCard";
import FloatingSearchButton from "@/components/search/FloatingSearchButton";
import SectionText from "@/components/aboutUs/SectionText";

/**
 * Komponen Client utama untuk halaman beranda.
 *
 * Komponen ini menangani semua logika interaktif seperti:
 * - Fetching data via React Query (dengan hydration dari Server Component parent)
 * - State management (loading overlay, dll.)
 * - Semua UI dan interaksi pengguna
 *
 * Data krusial (konfigurasi, headline, artikel terbaru) sudah di-prefetch
 * di Server Component (`page.tsx`) melalui HydrationBoundary, sehingga
 * komponen ini tidak perlu menunggu network request ulang untuk data tersebut.
 */
export default function HomePageClient({
  lcpMonogram,
}: {
  lcpMonogram: ReactNode;
}) {
  // Fetch semua konfigurasi situs
  // Data ini sudah tersedia dari prefetch server — tidak ada loading delay
  const {
    isLoading: isLoadingConfig,
    getMediaUrl,
    getStringValue,
    getConfig,
    getConfigValue,
    getBooleanValue,
  } = useConfiguration();

  // Fetch artikel headline
  // Data ini sudah tersedia dari prefetch server — tidak ada loading delay
  const { data: headlinesData, isLoading: isLoadingHeadlines } =
    useHeadlineArticles();
  const headlines = headlinesData || [];

  // Semua iklan homepage (aktif, dalam rentang tanggal, semua posisi)
  const { isLoading: isLoadingAds, headlineAds } = useHomepageAdsGrouped();

  const { data: gridSectionData, isLoading: isLoadingGridSection } =
    useGridSection();
  const featuredArticles = gridSectionData || [];

  const gridSectionCategorySlug =
    getStringValue("grid_section_category_slug", "lifestyle").trim() ||
    "lifestyle";

  const { data: carouselArticles, isLoading: isLoadingCarousel } =
    useCarouselSection();

  const { data: featuredCategories, isLoading: isLoadingFeaturedCategories } =
    useFeaturedCategoriesSection();

  // Fetch artikel terbaru (infinite scroll)
  // Halaman pertama sudah di-prefetch di server — tampil instan tanpa skeleton
  const {
    data: latestPages,
    isLoading: isLoadingLatest,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useLatestArticles();

  const latestArticles =
    latestPages?.pages?.flatMap((p: { articles: Article[] }) => p.articles) ||
    [];
  const hasMore = hasNextPage;
  const isLoadingMore = isFetchingNextPage;

  // Kumpulkan semua state loading yang mempengaruhi tampilan utama
  const isLoadingAll = [
    isLoadingConfig,
    isLoadingHeadlines,
    isLoadingLatest,
    isLoadingAds,
    isLoadingFeaturedCategories,
  ].some(Boolean);

  // --- Ambil konfigurasi URL gambar/video dari konfigurasi situs ---
  const heroVideoUrl = getMediaUrl("hero_video_config");
  const heroVideoPosterUrl = getMediaUrl("hero_video_poster_bg");
  const fotografiSectionBgUrl = getMediaUrl("fotografi_section_bg");
  const legacyVideoSectionBgUrl = getMediaUrl("video_section_bg");
  const videoSectionBgUrl = legacyVideoSectionBgUrl;
  const youtubeSectionBgUrl =
    getMediaUrl("youtube_section_bg") || legacyVideoSectionBgUrl;
  const socmedSectionBgUrl =
    getMediaUrl("socmed_section_bg") ||
    getMediaUrl("tiktok_section_bg") ||
    getMediaUrl("instagram_section_bg") ||
    legacyVideoSectionBgUrl;

  // --- Ambil konfigurasi judul seksi ---
  const SectionSponsorTitle = getConfigValue("section_sponsor_title");
  const SectionYoutubeTitle = getConfigValue("section_youtube_title");
  const SectionSocmedTitle =
    getConfigValue("section_socmed_title") ||
    getConfigValue("section_tiktok_title") ||
    getConfigValue("section_instagram_title");
  const SectionFotografiTitle = getConfigValue("section_fotografi_title");
  const aboutUsText = getConfigValue("about_us_text") as string | null;

  // --- Ambil konfigurasi visibilitas seksi ---
  const SectionSponsorIsActive = getBooleanValue(
    "section_sponsor_active",
    false,
  );
  const SectionYoutubeIsActive = getBooleanValue(
    "section_youtube_active",
    true,
  );
  const SectionSocmedIsActive = getConfig("section_socmed_active")
    ? getBooleanValue("section_socmed_active", true)
    : getBooleanValue("section_tiktok_active", true) ||
      getBooleanValue("section_instagram_active", false);

  const handleLoadMore = () => fetchNextPage();

  return (
    <>
      <LoadingOverlay isLoading={isLoadingAll} />
      {!isLoadingAll && <FloatingSearchButton />}
      <main>
        <SnapWrapper
          heroVideoUrl={heroVideoUrl}
          heroVideoPosterUrl={heroVideoPosterUrl}
          headlines={headlines}
          videoSectionBgUrl={videoSectionBgUrl}
          headlineCarouselAds={headlineAds}
          lcpMonogram={lcpMonogram}
        />

        {!isLoadingAll && (
          <>
            {/* Seksi Berita Terpopuler */}
            <section className="bg-background py-16 lg:py-24 relative z-10 container mx-auto px-4 md:px-0">
              <div className="flex flex-col justify-center flex-1">
                <TitleHomepage title="Berita Terpopuler" />
                <PopularNewsCarousel />
              </div>

              {/* Advertisement Banner (tersembunyi - placeholder) */}
              <div className="bg-muted rounded-lg p-4 text-center mt-16 hidden">
                <p className="text-xs text-muted-foreground mb-2">
                  ADVERTISEMENT
                </p>
                <div className="bg-linear-to-r from-amber-100 to-amber-200 dark:from-amber-900/30 dark:to-amber-800/30 rounded-lg p-8">
                  <p className="text-lg font-medium">Your Ad Here</p>
                  <p className="text-sm text-muted-foreground">
                    Contact advertising@arasvara.id
                  </p>
                </div>
              </div>
            </section>

            {/* Seksi Kategori Unggulan */}
            {featuredCategories && featuredCategories.length > 0 && (
              <section className="container mx-auto px-4 md:px-0 py-8 lg:py-12 relative z-10 bg-background border-t border-border">
                {featuredCategories.map((topic) => {
                  const topicName = topic.nickname?.trim() || topic.name;
                  const topicSlug = topic.slug;
                  const articles = (topic.articles || []).slice(0, 3);

                  if (articles.length === 0) return null;

                  return (
                    <div
                      key={topicSlug}
                      className="grid grid-cols-1 lg:grid-cols-12 gap-8 py-12 border-b border-border last:border-b-0 items-start"
                    >
                      {/* Kolom Kiri: Judul Topik */}
                      <div className="lg:col-span-3">
                        <Link
                          href={`/search?type=ARTICLES&category=${topicSlug}`}
                          className="group inline-flex items-center gap-1.5"
                        >
                          <h2 className="text-2xl lg:text-3xl font-extrabold text-foreground group-hover:text-hijauSawah transition-colors duration-300 tracking-tight capitalize">
                            {topicName}
                            <span className="text-hijauSawah font-semibold ml-1.5 transition-transform duration-300 group-hover:translate-x-1 inline-block">
                              &gt;
                            </span>
                          </h2>
                        </Link>
                      </div>

                      {/* Kolom Kanan: Grid 3 Artikel */}
                      <div className="lg:col-span-9 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                        {articles.map((article, index) => (
                          <SecondaryNewsCard
                            key={article.slug}
                            article={article}
                            gaClickLocation="homepage_card"
                            gaPosition={index + 1}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </section>
            )}

            {/* Seksi Socmed (TikTok + Instagram) */}
            {SectionSocmedIsActive && (
              <section
                className="relative bg-cover bg-center bg-no-repeat bg-fixed py-16 lg:py-24 z-10 flex justify-center items-center"
                style={{
                  backgroundImage: socmedSectionBgUrl
                    ? `url('${socmedSectionBgUrl}')`
                    : undefined,
                }}
              >
                {socmedSectionBgUrl && (
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 z-0 pointer-events-none"
                    style={{
                      backgroundImage: `url('${socmedSectionBgUrl}')`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                      backgroundRepeat: "no-repeat",
                      filter: "blur(8px) brightness(0.7)",
                      WebkitFilter: "blur(8px) brightness(0.7)",
                    }}
                  />
                )}
                <div className="absolute inset-0 bg-black/60 z-0 pointer-events-none" />
                <div className="container relative z-10 px-4 py-8">
                  <TitleHomepage
                    title={
                      SectionSocmedTitle?.toString() ||
                      "Lihat Socmed Terbaru"
                    }
                    variant="dark"
                  />
                  <SocmedCarousel />
                </div>
              </section>
            )}

            {/* Seksi Featured Grid (Style-Z) */}
            {featuredArticles.length > 0 && (
              <section className="container mx-auto px-4 md:px-0 py-16 lg:py-24">
                <TitleHomepage
                  title={gridSectionCategorySlug}
                  variant="light"
                  className="capitalize"
                />
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Artikel Unggulan Besar */}
                  {featuredArticles[0].article && (
                    <div className="lg:col-span-2">
                      <HeroCard
                        article={featuredArticles[0].article}
                        variant="dark"
                        size="large"
                        gaClickLocation="homepage_card"
                        gaPosition={1}
                      />
                    </div>
                  )}

                  {/* Artikel Samping */}
                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-1 gap-4">
                    {/* Index 1: SecondaryNewsCard */}
                    {featuredArticles[1] && featuredArticles[1].article && (
                      <div className="col-span-1">
                        <SecondaryNewsCard
                          article={featuredArticles[1].article}
                          gaClickLocation="homepage_card"
                          gaPosition={2}
                        />
                      </div>
                    )}
                    {/* Index 2 & 3: NewsCard */}
                    <div className="col-span-1 md:col-span-2 lg:col-span-1 space-y-4">
                      {[2, 3].map((idx) =>
                        featuredArticles[idx] &&
                        featuredArticles[idx].article ? (
                          <NewsCard
                            key={idx}
                            showExcerpt={false}
                            article={featuredArticles[idx].article}
                            gaClickLocation="homepage_card"
                            gaPosition={idx + 1}
                          />
                        ) : null,
                      )}
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* Seksi Sponsor / Trusted By */}
            {SectionSponsorIsActive && (
              <section className="container mx-auto px-4 md:px-0 py-16 lg:py-24">
                <TitleHomepage
                  title={SectionSponsorTitle?.toString() || "Sponsored by"}
                  variant="light"
                />
                <SponsoredByCarousel className="mt-8" />
              </section>
            )}

            {/* Divider */}
            <DividerHorizontal />

            {/* Seksi Tentang Kami */}
            <SectionText
              title="Tentang Kami"
              hideIconMouseBouncing
              variant="light"
            >
              {aboutUsText ? (
                aboutUsText
                  .split("\n\n")
                  .filter((para) => para.trim().length > 0)
                  .map((para, i) => (
                    <p key={i} className="text-base md:text-lg leading-relaxed">
                      {para}
                    </p>
                  ))
              ) : (
                <>
                  <p className="text-base md:text-lg leading-relaxed">
                    Seiring dengan pesatnya perkembangan zaman dan kemajuan
                    teknologi, industri media massa mengalami transformasi yang
                    signifikan. Di tengah dinamika tersebut serta kompetisi yang
                    semakin kompetitif, khususnya pada sektor media portal di
                    Indonesia, Arasvara hadir sebagai entitas media baru yang
                    berkomitmen menjawab tantangan dan kebutuhan industri.
                  </p>
                  <p className="text-base md:text-lg leading-relaxed">
                    Nama Arasvara lahir dari diskusi internal yang melibatkan
                    talenta muda. Media ini awalnya dirancang dengan nama Arah
                    Suara, kemudian dikembangkan menjadi Arasvara agar memiliki
                    identitas yang lebih modern, kuat, dan relevan bagi generasi
                    digital. Kata &ldquo;Svara&rdquo;, yang berasal dari bahasa
                    Sanskerta dan bermakna &ldquo;nada&rdquo; atau
                    &ldquo;suara&rdquo;, merepresentasikan aspirasi untuk
                    menghadirkan informasi yang mendengar serta memantulkan
                    suara generasi muda Milenial dan Gen Z.
                  </p>
                </>
              )}
            </SectionText>

            {/* Seksi Fotografi */}
            <section
              className="relative bg-cover bg-center bg-no-repeat bg-fixed py-16 lg:py-24"
              style={{
                backgroundImage: fotografiSectionBgUrl
                  ? `url('${fotografiSectionBgUrl}')`
                  : undefined,
              }}
            >
              {/* Overlay blur untuk background image */}
              {fotografiSectionBgUrl && (
                <div
                  aria-hidden="true"
                  className="absolute inset-0 z-0 pointer-events-none"
                  style={{
                    backgroundImage: `url('${fotografiSectionBgUrl}')`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    backgroundRepeat: "no-repeat",
                    filter: "blur(8px) brightness(0.7)",
                    WebkitFilter: "blur(8px) brightness(0.7)",
                  }}
                />
              )}
              <div className="absolute inset-0 bg-black/60 z-0 pointer-events-none" />
              <div className="container mx-auto relative z-10 px-4 md:px-0">
                <TitleHomepage
                  title={SectionFotografiTitle?.toString() || "Arah Lensa"}
                  seeMoreLink="/search?type=ARTICLES&format=GALLERY"
                  variant="dark"
                />
                <FotografiCarousel />
              </div>
            </section>

            {/* Seksi Pilihan Editor */}
            <section className="container mx-auto px-4 py-16 md:px-0 lg:py-24">
              <TitleHomepage title="Pilihan Editor" variant="light" />
              <EditorChoiceCarousel />
            </section>

            {/* Seksi YouTube */}
            {SectionYoutubeIsActive && (
              <section
                className="relative bg-cover bg-center bg-no-repeat bg-fixed py-16 lg:py-24"
                style={{
                  backgroundImage: youtubeSectionBgUrl
                    ? `url('${youtubeSectionBgUrl}')`
                    : undefined,
                }}
              >
                {/* Overlay blur untuk background image */}
                {youtubeSectionBgUrl && (
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 z-0 pointer-events-none"
                    style={{
                      backgroundImage: `url('${youtubeSectionBgUrl}')`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                      backgroundRepeat: "no-repeat",
                      filter: "blur(8px) brightness(0.7)",
                      WebkitFilter: "blur(8px) brightness(0.7)",
                    }}
                  />
                )}
                <div className="absolute inset-0 bg-black/60 z-0 pointer-events-none" />
                <div className="container mx-auto relative z-10 px-4 md:px-0">
                  <TitleHomepage
                    title={
                      SectionYoutubeTitle?.toString() || "Lihat Youtube Terbaru"
                    }
                    variant="dark"
                  />
                  <YoutubeCarousel />
                </div>
              </section>
            )}

            {/* Seksi Berita Terupdate (Artikel Terbaru) */}
            <section className="container mx-auto px-4 py-8 snap-panel md:py-16 lg:py-24">
              <h2 className="text-2xl lg:text-3xl font-bold text-center mb-8">
                Berita Terupdate
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-y-4 gap-x-8">
                {latestArticles.map((article: Article, index: number) => (
                  <NewsCard
                    key={article._id}
                    article={article}
                    showAuthor={false}
                    showPublishedDate={true}
                    gaClickLocation="homepage_card"
                    gaPosition={index + 1}
                  />
                ))}
              </div>

              <LoadMoreButton
                href="/indeks"
                variant="hijauSawah"
                wrapperClassName="flex justify-center w-full my-8"
              />
            </section>
          </>
        )}
      </main>
    </>
  );
}
