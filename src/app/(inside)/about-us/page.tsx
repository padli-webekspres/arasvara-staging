import { Metadata } from "next";
import { connectToDatabase } from "@/lib/db/db";
import { getAllConfiguration } from "@/services/configurationService";
import { Configuration } from "@/types/configuration";
import { AboutUsData, RedaksiPosition, AboutUsSection } from "@/types/aboutUs";
import AboutUsClient from "./AboutUsClient";
import { formatPhoneDisplay } from "@/lib/contact-display";

export const dynamic = "force-dynamic";

// ── SEO Metadata ─────────────────────────────────────────────────────────────
export const metadata: Metadata = {
  title: "Tentang Kami",
  description:
    "Kenali lebih dalam Arasvara — media digital yang hadir sebagai suara generasi muda Indonesia. Temukan visi, misi, dan struktur redaksi kami.",
  keywords: [
    "tentang arasvara",
    "about arasvara",
    "media digital",
    "redaksi arasvara",
    "visi misi arasvara",
  ],
  openGraph: {
    title: "Tentang Kami | Arasvara",
    description:
      "Kenali lebih dalam Arasvara — media digital yang hadir sebagai suara generasi muda Indonesia.",
    type: "website",
    locale: "id_ID",
  },
  twitter: {
    card: "summary_large_image",
    title: "Tentang Kami | Arasvara",
    description:
      "Kenali lebih dalam Arasvara — media digital yang hadir sebagai suara generasi muda Indonesia.",
  },
};

// ── Helper: ambil value string dari array konfigurasi ────────────────────────
function getConfigValue(configs: Configuration[], key: string): string {
  const config = configs.find((c) => c.key === key && c.type === "string");
  return config ? String(config.value || "") : "";
}

// ── Helper: ambil URL file dari konfigurasi bertipe file ─────────────────────
function getFileUrl(configs: Configuration[], key: string): string | undefined {
  const config = configs.find((c) => c.key === key && c.type === "file");
  const value = config?.value as { url?: string } | undefined;
  return value?.url || undefined;
}

// ── Helper: parse JSON array dari konfigurasi ────────────────────────────────
function parseJsonConfig<T>(
  configs: Configuration[],
  key: string,
  fallback: T,
): T {
  const raw = getConfigValue(configs, key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// ── Server Component ─────────────────────────────────────────────────────────
export default async function AboutUsPage() {
  // Fetch langsung dari database (server-side) — tidak ada waterfall network
  let aboutUsData: AboutUsData = {
    redaksiPositions: [],
    sections: [],
  };

  try {
    const db = await connectToDatabase();
    const rawConfigs = await getAllConfiguration(db);
    const configs = Array.isArray(rawConfigs)
      ? (rawConfigs as Configuration[])
      : [];

    const rawPhone = getConfigValue(configs, "contact_phone");

    aboutUsData = {
      // Hero video (sama dengan homepage)
      heroVideoUrl: getFileUrl(configs, "hero_video_config"),
      heroVideoPosterUrl: getFileUrl(configs, "hero_video_poster_bg"),

      // Profil & Deskripsi
      tagline: getConfigValue(configs, "tagline_about_us") || undefined,
      subTagline: getConfigValue(configs, "sub_tagline_about_us") || undefined,
      aboutUsText: getConfigValue(configs, "about_us_text") || undefined,

      // Visi & Misi
      visi: getConfigValue(configs, "visi") || undefined,
      misi: getConfigValue(configs, "misi") || undefined,

      // Struktur Redaksi
      titleRedaksi: getConfigValue(configs, "title_redaksi") || undefined,
      redaksiPositions: parseJsonConfig<RedaksiPosition[]>(
        configs,
        "redaksi_positions",
        [],
      ),

      // Sections CTA
      sections: parseJsonConfig<AboutUsSection[]>(
        configs,
        "sections_about_us",
        [],
      ),

      // Quotes
      quotes: getConfigValue(configs, "quotes") || undefined,
      quotesOwner: getConfigValue(configs, "quotes_owner") || undefined,

      // Meet Us
      titleMeetUs: getConfigValue(configs, "title_meet_us") || undefined,
      descMeetUs: getConfigValue(configs, "desc_meet_us") || undefined,
      linkGmaps: getConfigValue(configs, "link_gmaps") || undefined,

      // Kontak & Sosial Media
      address: getConfigValue(configs, "address_text") || undefined,
      email: getConfigValue(configs, "contact_email") || undefined,
      phone: rawPhone ? formatPhoneDisplay(rawPhone) : undefined,
      fax: getConfigValue(configs, "contact_fax") || undefined,
      instagramLink:
        getConfigValue(configs, "social_instagram_link") || undefined,
      facebookLink:
        getConfigValue(configs, "social_facebook_link") || undefined,
      twitterLink: getConfigValue(configs, "social_twitter_link") || undefined,
    };
  } catch (error) {
    // Jika DB gagal diakses, halaman tetap render dengan data kosong
    console.error("[AboutUsPage] Failed to fetch configuration:", error);
  }

  return <AboutUsClient data={aboutUsData} />;
}
