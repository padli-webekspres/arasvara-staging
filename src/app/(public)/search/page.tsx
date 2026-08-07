import { Metadata } from "next";
import SearchClient from "./SearchClient";

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const searchParams = await props.searchParams;
  const q = searchParams.q || "";

  const title = q ? `Hasil Pencarian untuk "${q}"` : "Pencarian Berita & Video";
  const description = q
    ? `Menampilkan hasil pencarian terhangat, terpopuler, dan terpercaya tentang "${q}" di Arasvara.`
    : "Gunakan fitur pencarian Arasvara untuk menemukan berita, artikel mendalam, opini, dan konten video terhangat dan terpercaya secara instan.";

  return {
    title,
    description,
    // Halaman pencarian tidak diindeks (thin/duplicate query URLs)
    robots: {
      index: false,
      follow: true,
      googleBot: {
        index: false,
        follow: true,
      },
    },
    openGraph: {
      title: `${title} | Arasvara`,
      description,
      type: "website",
    },
  };
}

export default async function SearchPage() {
  return <SearchClient />;
}
