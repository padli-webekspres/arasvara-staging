import type { Metadata } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import ReactQueryProvider from "@/app/providers/ReactQueryProvider";
import GaRouteTracker from "@/components/analytics/GaRouteTracker";
import DeferredGtag from "@/components/analytics/DeferredGtag";
import { isGaMeasurementId } from "@/lib/load-gtag";
import DeferredPushSubscriber from "@/components/notification/DeferredPushSubscriber";
import { Suspense } from "react";
import { fetchConfigurationsServer } from "@/lib/server/fetchServerSide";
import {
  buildSiteOpenGraphImages,
  buildSiteTwitterImages,
  getSiteBaseUrl,
} from "@/lib/og-image";

const rubik = localFont({
  src: [
    {
      path: "../../public/fonts/Rubik/Rubik-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/Rubik/Rubik-Medium.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../public/fonts/Rubik/Rubik-SemiBold.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "../../public/fonts/Rubik/Rubik-Bold.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-rubik",
  display: "swap",
  preload: true,
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

const TEXT_SELECTION_CSS =
  "html ::selection, body ::selection, div ::selection, p ::selection, span ::selection, ::selection, *::selection { background: #445f24 !important; background-color: #445f24 !important; color: #fff !important; } html ::-moz-selection, body ::-moz-selection, ::-moz-selection, *::-moz-selection { background: #445f24 !important; background-color: #445f24 !important; color: #fff !important; }";

const DAY_PICKER_BRAND_CSS =
  ".rdp-root{--rdp-accent-color:#445f24!important;--rdp-accent-background-color:rgba(68,95,36,.18)!important;--rdp-today-color:#445f24!important}.rdp-chevron,.rdp-chevron polygon{fill:#445f24!important}.rdp-today:not(.rdp-outside),.rdp-today:not(.rdp-outside) .rdp-day_button{color:#445f24!important}.rdp-selected{font-weight:inherit;font-size:inherit}.rdp-range_start .rdp-day_button,.rdp-range_end .rdp-day_button,.rdp-selected:not(.rdp-range_middle):not(.rdp-range_start):not(.rdp-range_end) .rdp-day_button{background-color:#445f24!important;color:#fff!important;border-color:#445f24!important;font-weight:inherit}.rdp-range_middle{background-color:rgba(68,95,36,.18)!important}.rdp-range_middle .rdp-day_button{background-color:transparent!important;color:inherit!important;border-color:transparent!important}.rdp-range_middle.rdp-today:not(.rdp-outside),.rdp-range_middle.rdp-today:not(.rdp-outside) .rdp-day_button{color:#445f24!important}";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const gtmId = process.env.NEXT_PUBLIC_GTM_ID;
  const gaMeasurementIdRaw = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() ?? "";
  const gaMeasurementId = isGaMeasurementId(gaMeasurementIdRaw)
    ? gaMeasurementIdRaw
    : "";

  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        {/* <link rel="icon" href="/favicon.ico" /> */}
        {/* icon */}
        <link
          rel="icon"
          type="image/png"
          href="/logo-arasvara/monogram/contained-monogram-putih-naskah-32.png"
          sizes="32x32"
        />
        <link
          rel="apple-touch-icon"
          href="/logo-arasvara/monogram/contained-monogram-putih-naskah-180.png"
          sizes="180x180"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style
          dangerouslySetInnerHTML={{
            __html: `${TEXT_SELECTION_CSS}${DAY_PICKER_BRAND_CSS}`,
          }}
        />
        {/* Google Site Verification */}
        {process.env.GOOGLE_SITE_VERIFICATION && (
          <meta
            name="google-site-verification"
            content={process.env.GOOGLE_SITE_VERIFICATION}
          />
        )}
      </head>
      <body
        className={`${rubik.variable} antialiased min-h-screen bg-background hide-scrollbar`}
      >
        {/* Stub gtag segera agar event mengantri; unduh gtag.js ditunda (DeferredGtag). */}
        {gaMeasurementId && (
          <>
            <script
              dangerouslySetInnerHTML={{
                __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaMeasurementId}',{send_page_view:false});`,
              }}
            />
            <DeferredGtag measurementId={gaMeasurementId} />
          </>
        )}
        {/* Google Tag Manager — lazyOnload */}
        {gtmId && (
          <Script id="google-tag-manager" strategy="lazyOnload">
            {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${gtmId}');`}
          </Script>
        )}
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
          {/* Silent push — client-deferred, tidak di critical path SSR */}
          <DeferredPushSubscriber />
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
