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

function toPlainRelatedArticles(input: unknown): unknown[] {
  if (!Array.isArray(input)) return [];

  return input.map((item: any) => {
    const rawArticle = item?.article;
    const plainArticle =
      rawArticle && typeof rawArticle === "object"
        ? {
            _id: rawArticle._id ? String(rawArticle._id) : "",
            title:
              typeof rawArticle.title === "string" ? rawArticle.title : "",
            slug: typeof rawArticle.slug === "string" ? rawArticle.slug : "",
            excerpt:
              typeof rawArticle.excerpt === "string" ? rawArticle.excerpt : "",
            category:
              rawArticle.category && typeof rawArticle.category === "object"
                ? {
                    _id: rawArticle.category._id
                      ? String(rawArticle.category._id)
                      : "",
                    name:
                      typeof rawArticle.category.name === "string"
                        ? rawArticle.category.name
                        : "",
                    slug:
                      typeof rawArticle.category.slug === "string"
                        ? rawArticle.category.slug
                        : "",
                  }
                : null,
            tags: Array.isArray(rawArticle.tags)
              ? rawArticle.tags.map((tag: any) =>
                  typeof tag === "object" && tag !== null
                    ? {
                        _id: tag._id ? String(tag._id) : "",
                        name: typeof tag.name === "string" ? tag.name : "",
                      }
                    : String(tag ?? ""),
                )
              : [],
            featuredImage:
              rawArticle.featuredImage &&
              typeof rawArticle.featuredImage === "object"
                ? {
                    ...rawArticle.featuredImage,
                    ...(rawArticle.featuredImage._id
                      ? { _id: String(rawArticle.featuredImage._id) }
                      : {}),
                    ...(rawArticle.featuredImage.mediaId
                      ? { mediaId: String(rawArticle.featuredImage.mediaId) }
                      : {}),
                  }
                : null,
            author:
              rawArticle.author && typeof rawArticle.author === "object"
                ? {
                    ...rawArticle.author,
                    _id: rawArticle.author._id
                      ? String(rawArticle.author._id)
                      : "",
                  }
                : null,
            editor:
              rawArticle.editor && typeof rawArticle.editor === "object"
                ? {
                    ...rawArticle.editor,
                    _id: rawArticle.editor._id
                      ? String(rawArticle.editor._id)
                      : "",
                  }
                : null,
            status:
              typeof rawArticle.status === "string" ? rawArticle.status : "",
            isFeatured: Boolean(rawArticle.isFeatured),
            isHeadline: Boolean(rawArticle.isHeadline),
            isBreaking: Boolean(rawArticle.isBreaking),
            viewCount:
              typeof rawArticle.viewCount === "number"
                ? rawArticle.viewCount
                : 0,
            publishedAt: rawArticle.publishedAt
              ? rawArticle.publishedAt instanceof Date
                ? rawArticle.publishedAt.toISOString()
                : String(rawArticle.publishedAt)
              : null,
            updatedAt: rawArticle.updatedAt
              ? rawArticle.updatedAt instanceof Date
                ? rawArticle.updatedAt.toISOString()
                : String(rawArticle.updatedAt)
              : null,
          }
        : null;

    return {
      _id: item?._id ? String(item._id) : "",
      article_id: item?.article_id ? String(item.article_id) : "",
      order: typeof item?.order === "number" ? item.order : 0,
      createdAt: item?.createdAt
        ? item.createdAt instanceof Date
          ? item.createdAt.toISOString()
          : String(item.createdAt)
        : null,
      createdBy: item?.createdBy ? String(item.createdBy) : "",
      article: plainArticle,
    };
  });
}

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
  const plainRelatedArticles = toPlainRelatedArticles(relatedArticles);

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
    editorId:
      articleDoc.editorId != null ? String(articleDoc.editorId) : null,
    contributorIds: Array.isArray(articleDoc.contributorIds)
      ? articleDoc.contributorIds.map((id: any) => String(id))
      : [],
    galleryItems: rawGalleryItems,
    relatedArticles: plainRelatedArticles as any,
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
