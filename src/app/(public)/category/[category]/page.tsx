import { Metadata } from "next";
import { CATEGORIES } from "@/lib/constants";
import CategoryClient from "./CategoryClient";

interface PageProps {
  params: Promise<{ category: string }>;
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { category: categorySlug } = await props.params;
  const category = CATEGORIES.find((c) => c.slug === categorySlug);
  const categoryName = category?.name || (typeof categorySlug === "string" ? categorySlug.charAt(0).toUpperCase() + categorySlug.slice(1) : "");

  const title = `Kategori ${categoryName}`;
  const description = `Baca berita terbaru, terpopuler, dan terpercaya seputar ${categoryName} di Arasvara. Menyajikan jurnalisme berkualitas untuk generasi digital.`;

  return {
    title,
    description,
    openGraph: {
      title: `${title} | Arasvara`,
      description,
      type: "website",
    },
  };
}

export default async function CategoryPage() {
  return <CategoryClient />;
}
