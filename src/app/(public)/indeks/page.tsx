import { Metadata } from "next";
import { connectToDatabase } from "@/lib/db/db";
import { buildAbsoluteUrl, getSiteBaseUrl } from "@/lib/og-image";
import { getIndeksArticles } from "@/services/indeksService";
import NewsIndeksClient from "./NewsIndeksClient";

interface PageProps {
  searchParams: Promise<{
    category?: string;
    date?: string;
    page?: string;
  }>;
}

/**
 * ─── PENGATURAN SEO PREMIUM (generateMetadata) ───
 *
 * Menghasilkan metadata dinamis untuk merangsang pengindeksan Google secara optimal.
 * - Robots: "index, follow" agar halaman dan link-link artikel di dalamnya dirayapi secara penuh.
 * - Canonical URL: Menunjuk ke rute unik dengan parameter yang relevan untuk menghindari duplikasi konten.
 * - Dynamic Title & Meta Description: Menyesuaikan tag judul dan cuplikan deskripsi berdasarkan kategori dan tanggal terpilih.
 */
export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const searchParams = await props.searchParams;
  const category = searchParams.category || "";
  const date = searchParams.date || "";
  const pageParam = parseInt(searchParams.page || "1", 10);
  const page = isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;

  let title = "Indeks Berita Terbaru";
  let desc = "Temukan seluruh arsip indeks berita terpercaya, aktual, dan terlengkap dari Arasvara. Urutkan berdasarkan kategori, rubrik, dan tanggal publikasi.";

  if (category) {
    const formattedCategory = category.charAt(0).toUpperCase() + category.slice(1);
    title = `Indeks Berita ${formattedCategory} Terbaru`;
    desc = `Daftar lengkap arsip indeks berita kategori ${formattedCategory} terhangat, aktual, dan terpercaya di Arasvara.`;
  }

  if (date) {
    const formattedDate = new Date(`${date}T00:00:00`).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric"
    });
    title += ` - Edisi ${formattedDate}`;
    desc += ` Diterbitkan pada tanggal ${formattedDate}.`;
  }

  // Bangun Canonical URL secara eksplisit
  const canonicalQuery = [
    category ? `category=${category}` : "",
    date ? `date=${date}` : "",
    page > 1 ? `page=${page}` : "",
  ].filter(Boolean).join("&");
  const baseUrl = getSiteBaseUrl();
  const canonicalUrl = buildAbsoluteUrl(
    `/indeks${canonicalQuery ? `?${canonicalQuery}` : ""}`,
    baseUrl
  );

  return {
    title: title,
    description: desc,
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: `${title} | Arasvara`,
      description: desc,
      type: "website",
      url: `/indeks`,
      siteName: "Arasvara",
    },
  };
}

/**
 * ─── SERVER COMPONENT: IndeksPage ───
 *
 * Mengambil parameter kueri secara server-side dan memuat halaman 1 secara langsung dari database MongoDB.
 * Menghilangkan pemanggilan fetch HTTP client-side awal untuk men-serve HTML lengkap ke crawler search engine.
 */
export default async function IndeksPage(props: PageProps) {
  const searchParams = await props.searchParams;
  const category = searchParams.category || "";
  const date = searchParams.date || "";
  const pageParam = parseInt(searchParams.page || "1", 10);
  const page = isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;

  // Hubungkan ke database langsung di server context
  const db = await connectToDatabase();
  const result = await getIndeksArticles(db, {
    categorySlug: category,
    date: date,
    page: page,
    limit: 12,
  });

  // Serialisasi Date ke ISO strings agar aman ditransmisikan dari Server ke Client Component
  const serializedArticles = result.data.map((art) => ({
    ...art,
    publishedAt: art.publishedAt instanceof Date ? art.publishedAt.toISOString() : String(art.publishedAt),
    updatedAt: art.updatedAt instanceof Date ? art.updatedAt.toISOString() : String(art.updatedAt),
  }));

  const serializedMeta = {
    ...result.meta,
  };

  return (
    <NewsIndeksClient
      initialArticles={serializedArticles as any}
      initialMeta={serializedMeta}
      activeCategory={category}
      activeDate={date}
    />
  );
}
