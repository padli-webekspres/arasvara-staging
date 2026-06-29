/* eslint-disable @typescript-eslint/no-explicit-any */
import { notFound } from "next/navigation";
import { connectToDatabase } from "@/lib/db/db";
import { getCategories } from "@/services/categoryService";
import { toJakartaDatetimeLocal } from "@/lib/utils";
import ArticleEditorForm from "@/components/admin/articles/ArticleEditorForm";
import { Article, ArticleMedia } from "@/types/article";
import { Media } from "@/types/media";
import { getArticleByIdOrSlug } from "@/services/article/getArticleService";
import { getRelatedArticles } from "@/services/article/relatedArticlesService";

export default async function EditArticlePage({
  params,
}: {
  params: Promise<{ idOrSlug: string }>;
}) {
  const { idOrSlug } = await params;

  const db = await connectToDatabase();

  const articleDoc: Article | null = await getArticleByIdOrSlug(db, idOrSlug);

  if (!articleDoc) notFound();

  const { categories } = await getCategories(db, { limit: 200 });
  const relatedArticles = await getRelatedArticles(db, idOrSlug);

  // Convert tags array to comma-separated string
  const tagsString = Array.isArray(articleDoc.tags)
    ? articleDoc.tags
        .map((t: any) =>
          t && typeof t === "object" ? (t.name ?? "") : String(t),
        )
        .filter(Boolean)
        .join(", ")
    : String(articleDoc.tags || "");

  // Convert scheduledAt to datetime-local string
  const scheduledAtRaw = articleDoc.scheduledAt;
  const scheduledAt = scheduledAtRaw
    ? toJakartaDatetimeLocal(
        scheduledAtRaw instanceof Date
          ? scheduledAtRaw.toISOString()
          : String(scheduledAtRaw),
      )
    : "";

  // Ambil contentMediaIds dari contentMedia (prefer) atau contentMediaIds (fallback)
  // let contentMediaIds: string[] = [];
  // if (
  //   Array.isArray(articleDoc.contentMedia) &&
  //   articleDoc.contentMedia.length > 0
  // ) {
  //   contentMediaIds = articleDoc.contentMedia
  //     .map((m: any) => m.filename || m._id)
  //     .filter(Boolean);
  // } else if (Array.isArray((articleDoc as any).contentMediaIds)) {
  //   contentMediaIds = (articleDoc as any).contentMediaIds;
  // }

  // featured image: build ArticleMedia object (skema denormalisasi baru)
  let featuredImagePlain: ArticleMedia | string = "";
  if (
    articleDoc.featuredImage &&
    typeof articleDoc.featuredImage === "object"
  ) {
    const fm = articleDoc.featuredImage as unknown as Record<string, unknown>;

    // Support: skema baru (mediaId, url, caption, credit) dan lama (Media dgn _id)
    const mediaId = String(fm.mediaId ?? fm._id ?? "");
    const url = String(fm.url ?? "");
    const caption = typeof fm.caption === "string" ? fm.caption : "";
    const credit =
      typeof fm.credit === "string"
        ? fm.credit
        : typeof fm.takenBy === "string"
          ? fm.takenBy  // backward compat dengan field lama
          : "";

    featuredImagePlain = { mediaId, url, caption, credit };
  }

  const rawGalleryItems: any[] =
    articleDoc.format === "GALLERY" && Array.isArray((articleDoc as any).galleryItems)
      ? (articleDoc as any).galleryItems
      : [];

  const initialData = {
    title: articleDoc.title ?? "",
    excerpt: articleDoc.excerpt ?? "",
    content: articleDoc.content ?? "",
    slug: articleDoc.slug ?? "",
    categoryId: articleDoc.categoryId?.toString() ?? "",
    tags: tagsString,
    featuredImage: featuredImagePlain,
    status: articleDoc.status ?? "DRAFT",
    scheduledAt,
    authorId: articleDoc.authorId?.toString(),
    editorId: articleDoc.editorId ?? null,
    contributorIds: articleDoc.contributorIds ?? [],
    galleryItems: rawGalleryItems,
    relatedArticles,
    publicPath: articleDoc.publicPath ?? null,
    urlFormat: articleDoc.urlFormat,
    publishedAt: articleDoc.publishedAt
      ? articleDoc.publishedAt instanceof Date
        ? articleDoc.publishedAt.toISOString()
        : String(articleDoc.publishedAt)
      : undefined,
  };

  const categoryOptions = categories.map((c) => ({
    _id: String(c._id),
    name: c.name,
    slug: c.slug,
  }));

  return (
    <ArticleEditorForm
      mode="edit"
      idArticle={articleDoc._id?.toString() ?? ""}
      paramArticle={idOrSlug}
      initialData={initialData}
      categories={categoryOptions}
      format={(articleDoc.format as "STANDARD" | "GALLERY") ?? "STANDARD"}
    />
  );
}
