"use client";

import dynamic from "next/dynamic";
import { ResponsiveMediaImage } from "@/components/ui/ResponsiveMediaImage";
import HeroCard from "@/components/news/HeroCard";
import SecondaryNewsCard from "@/components/news/SecondaryNewsCard";
import NewsCard from "@/components/news/NewsCard";
import LoadMoreButton from "@/components/ui/LoadMoreButton";
import { Article } from "@/types/article";
import { useLatestArticles } from "@/hooks/useLatestArticles";
import TitleHomepage from "@/components/homepage/TitleHomepage";
import SnapWrapper from "@/components/homepage/SnapWrapper";
import LoadingOverlay from "@/components/loading/LoadingOverlay";
import { type ReactNode } from "react";
import {
  useGridSection,
  useFeaturedCategoriesSection,
} from "@/hooks/useSectionsHomepage";
import { useConfiguration } from "@/hooks/useConfiguration";
import { useHeadlineArticles } from "@/hooks/useSectionArticles";
import { useHomepageAdsGrouped } from "@/hooks/useAds";
import type { HomepageAdItem, HomepageAdsSectionRatio } from "@/types/ads";
import Link from "next/link";
import type { HomepageAdsSectionItem } from "@/components/ads/section/HomepageAdsSection";
import FloatingSearchButton from "@/components/search/FloatingSearchButton";

/** Placeholder ringan untuk komponen below-fold agar layout tidak collapse saat lazy load */
const carouselSectionFallback = (
  <div className="min-h-[280px] w-full" aria-hidden="true" />
);

const adsSectionFallback = (
  <div className="min-h-[120px] w-full" aria-hidden="true" />
);

const sponsorSectionFallback = (
  <div className="min-h-[80px] w-full" aria-hidden="true" />
);

const PopularNewsCarousel = dynamic(
  () => import("@/components/homepage/carousel/PopularNewsCarousel"),
  { ssr: false, loading: () => carouselSectionFallback },
);

const SponsoredByCarousel = dynamic(
  () => import("@/components/homepage/carousel/SponsoredByCarousel"),
  { ssr: false, loading: () => sponsorSectionFallback },
);

const SocmedCarousel = dynamic(
  () => import("@/components/homepage/socmed/SocmedCarousel"),
  { ssr: false, loading: () => carouselSectionFallback },
);

const YoutubeCarousel = dynamic(
  () => import("@/components/homepage/socmed/YoutubeCarousel"),
  { ssr: false, loading: () => carouselSectionFallback },
);

const FotografiCarousel = dynamic(
  () => import("@/components/homepage/carousel/FotografiCarousel"),
  { ssr: false, loading: () => carouselSectionFallback },
);

const EditorChoiceCarousel = dynamic(
  () => import("@/components/homepage/carousel/EditorChoiceCarousel"),
  { ssr: false, loading: () => carouselSectionFallback },
);

const HomepageAdsSection = dynamic(
  () => import("@/components/ads/section/HomepageAdsSection"),
  { ssr: false, loading: () => adsSectionFallback },
);

function toHomepageAdsSectionItems(
  ads: HomepageAdItem[] | undefined,
): HomepageAdsSectionItem[] {
  if (!ads || ads.length === 0) return [];
  return ads.map((ad) => ({
    id: ad._id,
    src: ad.banner?.url,
    alt: ad.name || "Homepage Advertisement",
    linkUrl: ad.linkUrl,
  }));
}

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
  lcpPoster,
}: {
  lcpMonogram: ReactNode;
  /** Server-rendered hero poster untuk LCP (ada di HTML awal). */
  lcpPoster?: ReactNode;
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
  const { headlineAds, abovePhotographyAds } = useHomepageAdsGrouped();
  const abovePhotographyAdsItems = toHomepageAdsSectionItems(
    abovePhotographyAds,
  );
  const abovePhotographyRatio: HomepageAdsSectionRatio =
    abovePhotographyAds?.[0]?.ratio ?? "21:9";

  const { data: gridSectionData } = useGridSection();
  const featuredArticles = gridSectionData || [];

  const gridSectionCategorySlug =
    getStringValue("grid_section_category_slug", "lifestyle").trim() ||
    "lifestyle";

  const { data: featuredCategories } = useFeaturedCategoriesSection();

  // Fetch artikel terbaru (infinite scroll)
  // Halaman pertama sudah di-prefetch di server — tampil instan tanpa skeleton
  const { data: latestPages } = useLatestArticles();

  const latestArticles =
    latestPages?.pages?.flatMap((p: { articles: Article[] }) => p.articles) ||
    [];

  // Overlay hanya menunggu data kritis di atas fold — jangan blok LCP
  // karena fetch latest (sudah di-prefetch; section di bawah fold).
  const isLoadingAll = [isLoadingConfig, isLoadingHeadlines].some(Boolean);

  // --- Ambil konfigurasi URL gambar/video dari konfigurasi situs ---
  const heroVideoUrl = getMediaUrl("hero_video_config");
  const heroVideoPosterUrl = getMediaUrl("hero_video_poster_bg");
  const fotografiSectionBgUrl = getMediaUrl("fotografi_section_bg");
  const legacyVideoSectionBgUrl = getMediaUrl("video_section_bg");
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

  return (
    <>
      <LoadingOverlay isLoading={isLoadingAll} />
      {!isLoadingAll && <FloatingSearchButton />}
      <main>
        <h1 className="sr-only">
          Arasvara — Portal Berita Digital Terkini, Akurat & Terpercaya
        </h1>
        <SnapWrapper
          heroVideoUrl={heroVideoUrl}
          heroVideoPosterUrl={heroVideoPosterUrl}
          headlines={headlines}
          headlineCarouselAds={headlineAds}
          lcpMonogram={lcpMonogram}
          lcpPoster={lcpPoster}
        />

        {!isLoadingAll && (
          <>
            {/* Seksi Berita Terpopuler */}
            <section className="bg-background py-16 lg:py-24 relative z-10 container mx-auto w-full min-w-0 px-4 md:px-6 lg:px-8">
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
              <section className="container mx-auto w-full min-w-0 px-4 md:px-6 lg:px-8 py-8 lg:py-12 relative z-10 bg-background border-t border-border">
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
              <section className="relative overflow-hidden py-16 lg:py-24 z-10 flex justify-center items-center">
                {socmedSectionBgUrl && (
                  <ResponsiveMediaImage
                    src={socmedSectionBgUrl}
                    aria-hidden="true"
                    alt=""
                    loading="lazy"
                    sizes="(max-width: 768px) 100vw, 1280px"
                    className="absolute inset-0 h-full w-full object-cover object-center blur-md brightness-70"
                  />
                )}
                <div className="absolute inset-0 bg-black/60 z-0 pointer-events-none" />
                <div className="container mx-auto relative z-10 w-full min-w-0 px-4 md:px-6 lg:px-8 py-8">
                  <TitleHomepage
                    title={
                      SectionSocmedTitle?.toString() || "Lihat Socmed Terbaru"
                    }
                    variant="dark"
                  />
                  <SocmedCarousel />
                </div>
              </section>
            )}

            {/* Seksi Featured Grid (Style-Z) */}
            {featuredArticles.length > 0 && (
              <section className="container mx-auto w-full min-w-0 px-4 md:px-6 lg:px-8 py-16 lg:py-24">
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
              <section className="container mx-auto w-full min-w-0 px-4 md:px-6 lg:px-8 py-16 lg:py-24">
                <TitleHomepage
                  title={SectionSponsorTitle?.toString() || "Sponsored by"}
                  variant="light"
                />
                <SponsoredByCarousel className="mt-8" />
              </section>
            )}

            {/* ads horizontal */}
            <section className="container mx-auto w-full min-w-0 px-4 md:px-6 lg:px-8 py-8">
              <HomepageAdsSection
                ratio={abovePhotographyRatio}
                items={abovePhotographyAdsItems}
              />
            </section>

            {/* Seksi Tentang Kami */}
            {/* <SectionText
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
            </SectionText> */}

            {/* Seksi Fotografi */}
            <section
              className="relative overflow-hidden py-16 lg:py-24"
            >
              {fotografiSectionBgUrl && (
                <ResponsiveMediaImage
                  src={fotografiSectionBgUrl}
                  aria-hidden="true"
                  alt=""
                  loading="lazy"
                  sizes="(max-width: 768px) 100vw, 1280px"
                  className="absolute inset-0 h-full w-full object-cover object-center blur-md brightness-70"
                />
              )}
              <div className="absolute inset-0 bg-black/60 z-0 pointer-events-none" />
              <div className="container mx-auto relative z-10 w-full min-w-0 px-4 md:px-6 lg:px-8">
                <TitleHomepage
                  title={SectionFotografiTitle?.toString() || "Arah Lensa"}
                  seeMoreLink="/search?type=ARTICLES&format=GALLERY"
                  variant="dark"
                />
                <FotografiCarousel />
              </div>
            </section>

            {/* Seksi Pilihan Editor */}
            <section className="container mx-auto w-full min-w-0 px-4 md:px-6 lg:px-8 py-16 lg:py-24">
              <TitleHomepage title="Pilihan Editor" variant="light" />
              <EditorChoiceCarousel />
            </section>

            {/* Seksi YouTube */}
            {SectionYoutubeIsActive && (
              <section
                className="relative overflow-hidden py-16 lg:py-24"
              >
                {youtubeSectionBgUrl && (
                  <ResponsiveMediaImage
                    src={youtubeSectionBgUrl}
                    aria-hidden="true"
                    alt=""
                    loading="lazy"
                    sizes="(max-width: 768px) 100vw, 1280px"
                    className="absolute inset-0 h-full w-full object-cover object-center blur-md brightness-70"
                  />
                )}
                <div className="absolute inset-0 bg-black/60 z-0 pointer-events-none" />
                <div className="container mx-auto relative z-10 w-full min-w-0 px-4 md:px-6 lg:px-8">
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
            <section className="container mx-auto w-full min-w-0 px-4 md:px-6 lg:px-8 py-8 snap-panel md:py-16 lg:py-24">
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
