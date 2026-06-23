import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import ReactQueryProvider from "@/app/providers/ReactQueryProvider";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/scrollbar";
import "swiper/css/mousewheel";
import PushSubscriber from "@/components/notification/PushSubscriber";
import GaRouteTracker from "@/components/analytics/GaRouteTracker";
import { Suspense } from "react";
import { fetchConfigurationsServer } from "@/lib/server/fetchServerSide";
import {
  buildSiteOpenGraphImages,
  buildSiteTwitterImages,
  getSiteBaseUrl,
} from "@/lib/og-image";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  let tagline = "Portal Berita Terkini & Terpercaya";
  let description =
    "Arasvara — portal berita digital Indonesia untuk generasi Milenial dan Gen Z. Berita terkini, akurat, dan terpercaya seputar politik, ekonomi, teknologi, gaya hidup, dan fotografi.";

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
      "Gagal mengambil konfigurasi untuk metadata di layout.tsx:",
      error,
    );
  }

  const baseUrl = getSiteBaseUrl();

  return {
    metadataBase: new URL(baseUrl),
    title: {
      default: `Arasvara | ${tagline}`,
      template: "Arasvara | %s",
    },
    description: description,
    keywords: [
      "arasvara",
      "berita",
      "berita terkini",
      "portal berita indonesia",
      "berita online",
      "media digital indonesia",
    ],
    openGraph: {
      title: `Arasvara | ${tagline}`,
      description: description,
      url: baseUrl,
      siteName: "Arasvara",
      type: "website",
      locale: "id_ID",
      images: buildSiteOpenGraphImages(baseUrl),
    },
    twitter: {
      card: "summary_large_image",
      site: "@arasvara",
      title: `Arasvara | ${tagline}`,
      description: description,
      images: buildSiteTwitterImages(baseUrl),
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const gtmId = process.env.NEXT_PUBLIC_GTM_ID;

  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        {/* <link rel="icon" href="/favicon.ico" /> */}
        {/* icon */}
        <link
          rel="icon"
          type="image/png"
          href="/logo-arasvara/monogram/contained-monogram-putih-naskah.png"
          sizes="512x512"
        />
        <link
          rel="apple-touch-icon"
          href="/logo-arasvara/monogram/contained-monogram-putih-naskah.png"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {/* Google Analytics */}
        {process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID && (
          <>
            <script
              async
              src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID}`}
            />
            <script
              dangerouslySetInnerHTML={{
                __html: `
                  window.dataLayer = window.dataLayer || [];
                  function gtag(){dataLayer.push(arguments);}
                  gtag('js', new Date());
                  gtag('config', '${process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID}', { send_page_view: false });
                `,
              }}
            />
          </>
        )}
        {/* Google Site Verification */}
        {process.env.GOOGLE_SITE_VERIFICATION && (
          <meta
            name="google-site-verification"
            content={process.env.GOOGLE_SITE_VERIFICATION}
          />
        )}
        {/* Google Tag Manager */}
        {gtmId && (
          <script
            dangerouslySetInnerHTML={{
              __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${gtmId}');`,
            }}
          />
        )}
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-background hide-scrollbar`}
      >
        {gtmId && (
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
              height="0"
              width="0"
              style={{ display: "none", visibility: "hidden" }}
            />
          </noscript>
        )}
        <ReactQueryProvider>
          {/* Silent push notification subscriber — tidak me-render UI */}
          <PushSubscriber />
          <Suspense fallback={null}>
            <GaRouteTracker />
          </Suspense>

          {children}
          <Toaster />
        </ReactQueryProvider>
      </body>
    </html>
  );
}
