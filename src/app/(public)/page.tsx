/**
 * Halaman Beranda Arasvara — Server Component
 *
 * File ini adalah entry point routing Next.js untuk halaman beranda ("/").
 * Sebagai Server Component, file ini bertanggung jawab untuk:
 *
 * 1. **SEO Metadata**: Mendefinisikan metadata yang kaya (title, description,
 *    Open Graph, Twitter Card, canonical URL) agar Google dapat mengindeks
 *    halaman ini dengan optimal.
 *
 * 2. **JSON-LD Structured Data**: Menanamkan skema Organization, WebSite,
 *    dan NewsMediaOrganization agar Google mengenali Arasvara sebagai
 *    organisasi media berita yang terverifikasi.
 *
 * 3. **Prefetching Data (Hybrid Approach)**: Melakukan prefetch data krusial
 *    (konfigurasi situs, artikel headline, artikel terbaru) menggunakan
 *    React Query di sisi server, lalu mengirimnya ke Client Component melalui
 *    HydrationBoundary. Ini memastikan konten tertulis di HTML asli
 *    (baik untuk SEO & performa) sekaligus tetap interaktif di browser.
 *
 * Semua logika UI dan interaktivitas ditangani oleh HomePageClient.tsx.
 */

import type { Metadata } from "next";
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";
import HomePageClient from "./HomePageClient";
import HeroMonogram from "@/components/homepage/HeroMonogram";
import { ResponsiveMediaImage } from "@/components/ui/ResponsiveMediaImage";
import { getHeroPosterUrlFromConfigs, HERO_MONOGRAM_SRC } from "@/lib/homepage-lcp";
import {
  buildSrcSet,
  resolvePublicMediaUrl,
} from "@/lib/media/public-media-url";
import {
  fetchConfigurationsServer,
  fetchHeadlineArticlesServer,
  fetchLatestArticlesServer,
  footerNapFromConfigs,
} from "@/lib/server/fetchServerSide";
import {
  buildAbsoluteUrl,
  buildSiteOpenGraphImages,
  buildSiteTwitterImages,
  getSiteBaseUrl,
  SITE_LOGO,
} from "@/lib/og-image";

// ─── Base URL Situs ───────────────────────────────────────────────────────────

const BASE_URL = getSiteBaseUrl();

// ─── SEO Metadata ─────────────────────────────────────────────────────────────

/**
 * Metadata homepage yang kaya keyword untuk meningkatkan visibilitas di
 * mesin pencari (Google, Bing, dll.) untuk kata kunci seperti:
 * "arasvara", "berita", "berita terkini indonesia", "portal berita", dll.
 */
export async function generateMetadata(): Promise<Metadata> {
  let tagline = "Portal Berita Terkini, Akurat & Terpercaya";
  let description =
    "Arasvara menghadirkan berita terkini, akurat, dan terpercaya seputar politik, ekonomi, teknologi, gaya hidup, hingga fotografi. Portal berita digital untuk generasi Milenial dan Gen Z Indonesia.";

  try {
    const configs = await fetchConfigurationsServer();
    const taglineConfig = configs.find((c) => c.key === "tagline_website");
    if (taglineConfig && taglineConfig.value) {
      tagline = taglineConfig.value as string;
    }
    const descConfig = configs.find(
      (c) => c.key === "meta_description_website",
    );
    if (descConfig && descConfig.value) {
      description = descConfig.value as string;
    }
  } catch (error) {
    console.error(
      "Gagal mengambil konfigurasi untuk metadata di homepage:",
      error,
    );
  }

  const title = `${tagline}`;

  return {
    title,
    description,
    keywords: [
      "arasvara",
      "berita",
      "berita terkini",
      "berita terbaru",
      "portal berita",
      "berita indonesia",
      "berita hari ini",
      "portal berita indonesia",
      "berita online",
      "berita digital",
      "arasvara berita",
      "arasvara.id",
    ],
    alternates: {
      canonical: BASE_URL,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-snippet": -1,
        "max-image-preview": "large",
        "max-video-preview": -1,
      },
    },
    openGraph: {
      type: "website",
      url: BASE_URL,
      siteName: "Arasvara",
      title,
      description,
      images: buildSiteOpenGraphImages(BASE_URL),
      locale: "id_ID",
    },
    twitter: {
      card: "summary_large_image",
      site: "@arasvara",
      title,
      description,
      images: buildSiteTwitterImages(BASE_URL),
    },
  };
}

// ─── JSON-LD Structured Data ──────────────────────────────────────────────────

/**
 * Skema Organization untuk Google Knowledge Graph.
 * Membantu Google menampilkan info Arasvara di panel pengetahuan (Knowledge Panel)
 * ketika seseorang mencari "arasvara" di Google.
 */
function buildOrganizationSchema(nap: {
  address?: string;
  phoneHref?: string;
} | null) {
  return {
    "@context": "https://schema.org",
    "@type": "NewsMediaOrganization",
    name: "Arasvara",
    alternateName: "Arasvara.id",
    url: BASE_URL,
    logo: {
      "@type": "ImageObject",
      url: buildAbsoluteUrl(SITE_LOGO.path, BASE_URL),
      width: SITE_LOGO.width,
      height: SITE_LOGO.height,
    },
    description:
      "Arasvara adalah portal berita digital Indonesia yang menghadirkan informasi akurat, berimbang, dan terpercaya untuk generasi Milenial dan Gen Z.",
    foundingDate: "2024",
    inLanguage: "id",
    sameAs: [
      "https://www.instagram.com/arasvara",
      "https://x.com/arasvara",
      "https://www.facebook.com/arasvara",
    ],
    ...(nap?.address ? { address: nap.address } : {}),
    ...(nap?.phoneHref
      ? { telephone: nap.phoneHref.replace(/^tel:/, "") }
      : {}),
  };
}

/**
 * Skema WebSite dengan SearchAction.
 * Memungkinkan Google menampilkan Sitelinks Searchbox di hasil pencarian —
 * pengguna bisa langsung mencari di dalam Arasvara dari halaman Google.
 */
const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Arasvara",
  url: BASE_URL,
  description:
    "Portal berita digital terpercaya untuk generasi Milenial dan Gen Z Indonesia.",
  inLanguage: "id",
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${BASE_URL}/search?q={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
};

// ─── Server Component ─────────────────────────────────────────────────────────

export default async function HomePage() {
  // Buat instance QueryClient baru yang terisolasi per-request
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Menonaktifkan retry di server agar tidak memperlambat rendering
        retry: false,
        staleTime: 1000 * 60 * 5, // 5 menit
      },
    },
  });

  // Prefetch data krusial secara paralel di server.
  // Query key HARUS identik dengan yang dipakai di hooks client-side
  // agar HydrationBoundary bisa menyambungkan data dengan benar.
  await Promise.allSettled([
    // Key: ["configuration", "all"] — sama dengan useConfiguration()
    queryClient.prefetchQuery({
      queryKey: ["configuration", "all"],
      queryFn: fetchConfigurationsServer,
    }),

    // Key: ["headline-articles-carousel"] — sama dengan useHeadlineArticles()
    queryClient.prefetchQuery({
      queryKey: ["headline-articles-carousel"],
      queryFn: fetchHeadlineArticlesServer,
    }),

    // Key: ["latest", 9] — sama dengan useLatestArticles({ limit: 9 })
    // Prefetch hanya halaman pertama (cukup untuk SEO)
    queryClient.prefetchInfiniteQuery({
      queryKey: ["latest", 9],
      queryFn: fetchLatestArticlesServer,
      initialPageParam: "",
    }),
  ]);

  const configs =
    queryClient.getQueryData<
      Awaited<ReturnType<typeof fetchConfigurationsServer>>
    >(["configuration", "all"]) ?? [];
  const heroPosterUrl = getHeroPosterUrlFromConfigs(configs);
  const resolvedHeroPoster = heroPosterUrl
    ? resolvePublicMediaUrl(heroPosterUrl) || heroPosterUrl
    : "";
  const heroPosterIsWebp = /\.webp(?:$|[?#])/i.test(resolvedHeroPoster);
  // Preload original sebagai fallback; varian opsional lewat imageSrcSet.
  const heroPosterPreloadHref = resolvedHeroPoster || "";
  const heroPosterPreloadSrcSet =
    resolvedHeroPoster && heroPosterIsWebp
      ? buildSrcSet(resolvedHeroPoster)
      : undefined;
  const organizationSchema = buildOrganizationSchema(
    footerNapFromConfigs(configs),
  );

  return (
    <>
      {heroPosterPreloadHref ? (
        <link
          rel="preload"
          as="image"
          href={heroPosterPreloadHref}
          // Samakan dengan ResponsiveMediaImage di HeroVideo agar tidak double-fetch.
          {...(heroPosterPreloadSrcSet
            ? {
                imageSrcSet: heroPosterPreloadSrcSet,
                imageSizes: "100vw",
              }
            : {})}
          fetchPriority="high"
        />
      ) : (
        <link
          rel="preload"
          as="image"
          href={HERO_MONOGRAM_SRC}
          fetchPriority="high"
        />
      )}
      {/* JSON-LD Structured Data untuk Google Knowledge Graph */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(organizationSchema),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(websiteSchema),
        }}
      />

      {/*
        HydrationBoundary meneruskan data yang sudah di-prefetch di server
        ke Client Component. React Query di browser akan langsung menggunakan
        data ini tanpa perlu fetch ulang — menghilangkan loading flash untuk
        konten krusial (konfigurasi, headline, artikel terbaru).
      */}
      <HydrationBoundary state={dehydrate(queryClient)}>
        <HomePageClient
          lcpMonogram={<HeroMonogram priority={!resolvedHeroPoster} />}
          lcpPoster={
            resolvedHeroPoster ? (
              <ResponsiveMediaImage
                src={resolvedHeroPoster}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
                priority
                sizes="100vw"
              />
            ) : null
          }
        />
      </HydrationBoundary>
    </>
  );
}
