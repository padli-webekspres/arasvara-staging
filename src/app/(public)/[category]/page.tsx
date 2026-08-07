import { Metadata } from "next";
import { notFound } from "next/navigation";
import { CATEGORIES } from "@/lib/constants";
import { isReservedRootSegment } from "@/lib/article-public-path";
import { connectToDatabase } from "@/lib/db/db";
import CategoryClient from "./CategoryClient";

interface PageProps {
  params: Promise<{ category: string }>;
}

async function getCategoryInfo(categorySlug: string) {
  if (!categorySlug || isReservedRootSegment(categorySlug)) {
    return null;
  }

  // 1. Cek dari constants dulu (fast path)
  const constantCategory = CATEGORIES.find((c) => c.slug === categorySlug);
  if (constantCategory) {
    return constantCategory;
  }

  // 2. Fallback cek dari database MongoDB
  try {
    const db = await connectToDatabase();
    const catDoc = await db.collection("categories").findOne({ slug: categorySlug });
    if (catDoc) {
      return {
        slug: String(catDoc.slug ?? categorySlug),
        name: String(catDoc.name ?? categorySlug),
      };
    }
  } catch (err) {
    console.error("Gagal mengambil data kategori di server:", err);
  }

  return null;
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { category: categorySlug } = await props.params;
  const category = await getCategoryInfo(categorySlug);

  if (!category) {
    return {};
  }

  const categoryName = category.name || categorySlug.charAt(0).toUpperCase() + categorySlug.slice(1);
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

export default async function CategoryPage(props: PageProps) {
  const { category: categorySlug } = await props.params;
  const category = await getCategoryInfo(categorySlug);

  if (!category) {
    notFound();
  }

  return <CategoryClient initialCategory={category} />;
}
