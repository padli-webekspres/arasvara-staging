"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import ArticleUi from "@/components/news/ArticleUi";
import {
  resolveCmsArticleShareUrl,
  copyToClipboard,
  formatDateReadable,
  splitContentByPageBreak,
  formatTimeReadable,
} from "@/lib/utils";
import {
  Article,
  ArticleStatus,
  Tag,
  StandardArticle,
  GalleryArticle,
  GalleryItem,
  DraftGalleryItem,
} from "@/types/article";
import { Category } from "@/types/category";
import { UserProfile } from "@/types/user";
import { ROLES } from "@/lib/auth-client";
import { Media } from "@/types/media";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { adminPanelHref } from "@/lib/admin-panel-path";
import { readArticleDraftRaw } from "@/lib/autosave";

function readPreviewDraftRaw(formatParam: string | null): string | null {
  if (formatParam === "gallery") {
    return readArticleDraftRaw("GALLERY");
  }
  if (formatParam === "standard") {
    return readArticleDraftRaw("STANDARD");
  }
  return (
    readArticleDraftRaw("GALLERY") ?? readArticleDraftRaw("STANDARD")
  );
}

async function restorePreviewGalleryItems(
  items: DraftGalleryItem[],
): Promise<GalleryItem[]> {
  const { getEditorImage } = await import("@/lib/db/draftImageDb");
  const restored: GalleryItem[] = [];

  for (const item of items) {
    let url = item.imageUrl ?? "";
    if (item.isPending && item.idbKey) {
      const file = await getEditorImage(item.idbKey).catch(() => null);
      if (file) {
        url = URL.createObjectURL(file);
      }
    }
    restored.push({
      mediaId: item.mediaId || "preview",
      url,
      caption: item.caption ?? "",
      credit: item.credit ?? "",
      order: typeof item.order === "number" ? item.order : restored.length,
    });
  }

  return restored.sort((a, b) => a.order - b.order);
}

export default function ArticlePreviewPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const formatParam = searchParams.get("format");
  const pageParam = searchParams.get("page");
  const isShowAll = pageParam === "all";
  const pageNum = isShowAll ? 1 : Math.max(1, parseInt(pageParam || "1") || 1);

  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: currentUser } = useCurrentUser();
  console.log("Current user in preview page:", currentUser);

  useEffect(() => {
    const loadDraft = async () => {
      setLoading(true);
      setError(null);
      try {
        // 1. Ambil draft dari localStorage (key per format)
        const draftRaw = readPreviewDraftRaw(formatParam);
        if (!draftRaw) {
          setError("Draft article not found.");
          setLoading(false);
          return;
        }
        const parsed = JSON.parse(draftRaw) as Record<string, unknown>;

        // 2. Featured image dari IndexedDB
        if (parsed.featuredImageKey === "featured") {
          try {
            const { getFeaturedImage } = await import("@/lib/db/draftImageDb");
            const file = await getFeaturedImage();
            if (file) parsed.featuredImage = URL.createObjectURL(file);
          } catch {
            setError("Gagal mengambil featured image dari IndexedDB.");
          }
        } else if (
          typeof parsed.pendingFeaturedIdbKey === "string" &&
          parsed.pendingFeaturedIdbKey
        ) {
          try {
            const { getEditorImage } = await import("@/lib/db/draftImageDb");
            const file = await getEditorImage(parsed.pendingFeaturedIdbKey).catch(
              () => null,
            );
            if (file) parsed.featuredImage = URL.createObjectURL(file);
          } catch {
            setError("Gagal mengambil featured image dari IndexedDB.");
          }
        }

        // 3. Editor images dari IndexedDB
        const imageKeys = Array.isArray(parsed.editorImageKeys)
          ? (parsed.editorImageKeys as Array<{
              blobUrl: string;
              idbKey: string;
            }>)
          : [];
        if (imageKeys.length > 0) {
          try {
            const { getEditorImage } = await import("@/lib/db/draftImageDb");
            let content =
              typeof parsed.content === "string" ? parsed.content : "";
            for (const { blobUrl: oldBlobUrl, idbKey } of imageKeys) {
              const file = await getEditorImage(idbKey).catch(() => null);
              if (file) {
                const newBlobUrl = URL.createObjectURL(file);
                content = content.replaceAll(oldBlobUrl, newBlobUrl);
              }
            }
            parsed.content = content;
          } catch {
            setError("Gagal mengambil editor images dari IndexedDB.");
          }
        }
        console.log("current user:", currentUser);
        // 4. Author: fallback ke user localStorage, jika tidak ada pakai default
        let author: UserProfile = {
          _id: currentUser?._id || "preview",
          name: currentUser?.name || "Unknown Author",
          email: currentUser?.email || "",
          avatar: currentUser?.avatar || "",
          role: currentUser?.role || ROLES.WRITER,
        };
        try {
          const userData = localStorage.getItem("user");
          if (userData) {
            const userParsed = JSON.parse(userData);
            author = {
              _id: userParsed._id || currentUser?._id || "preview",
              name: userParsed.name || currentUser?.name || "Unknown Author",
              email: userParsed.email || currentUser?.email || "",
              avatar: userParsed.avatar || currentUser?.avatar || "",
              role: (userParsed.role as typeof author.role) || ROLES.SUBSCRIBER,
            };
          }
        } catch {}

        // 5. Category: handle baik dari draft maupun fetch API
        let category: Category = {
          _id: undefined,
          name: "-",
          slug: "-",
        };
        if (parsed.category && typeof parsed.category === "object") {
          const parsedCategory = parsed.category as {
            _id?: string;
            name?: string;
            slug?: string;
          };
          if (parsedCategory.name && parsedCategory.slug) {
            category = {
              _id: parsedCategory._id,
              name: parsedCategory.name,
              slug: parsedCategory.slug,
            };
          }
        } else {
          let categoryId = "";
          if (typeof parsed.categoryId === "string") {
            categoryId = parsed.categoryId;
          } else if (
            parsed.categoryId &&
            typeof parsed.categoryId === "object" &&
            "$oid" in parsed.categoryId
          ) {
            const oid = (parsed.categoryId as { $oid?: unknown }).$oid;
            categoryId = typeof oid === "string" ? oid : "";
          }
          if (
            categoryId &&
            typeof categoryId === "string" &&
            categoryId.trim() !== ""
          ) {
            try {
              const axios = (await import("axios")).default;
              const res = await axios.get(`/api/categories/${categoryId}`);
              // Handle response: bisa { category: {...} } atau langsung {...}
              const categoryData = res.data;
              if (
                categoryData.category &&
                categoryData.category.name &&
                categoryData.category.slug
              ) {
                category = categoryData.category;
              } else if (categoryData.name && categoryData.slug) {
                category = categoryData;
              }
            } catch {
              setError("Gagal mengambil kategori dari API.");
            }
          }
        }

        // 6. Tags
        const tagsRaw = Array.isArray(parsed.tags)
          ? parsed.tags
          : String(parsed.tags || "")
              .split(",")
              .map((tag) => tag.trim())
              .filter(Boolean);

        const tags: Tag[] = tagsRaw.map((tag) => ({
          name: typeof tag === "string" ? tag : String(tag),
          slug:
            typeof tag === "string"
              ? tag.toLowerCase().replace(/\s+/g, "-")
              : String(tag).toLowerCase().replace(/\s+/g, "-"),
        }));

        const parsedTitle =
          typeof parsed.title === "string" ? parsed.title : "Untitled";
        const parsedExcerpt =
          typeof parsed.excerpt === "string" ? parsed.excerpt : "";
        const parsedContent =
          typeof parsed.content === "string" ? parsed.content : "";

        let normalizedCategoryId = "";
        if (typeof parsed.categoryId === "string") {
          normalizedCategoryId = parsed.categoryId;
        } else if (
          parsed.categoryId &&
          typeof parsed.categoryId === "object" &&
          "$oid" in parsed.categoryId
        ) {
          const oid = (parsed.categoryId as { $oid?: unknown }).$oid;
          normalizedCategoryId = typeof oid === "string" ? oid : "";
        }

        // Normalisasi featuredImage: gunakan featuredImagePreviewUrl jika ada, fallback ke featuredImage lama
        let normalizedFeaturedImageUrl: string | null = null;
        if (
          typeof parsed.featuredImagePreviewUrl === "string" &&
          parsed.featuredImagePreviewUrl
        ) {
          normalizedFeaturedImageUrl = parsed.featuredImagePreviewUrl;
        } else if (
          typeof parsed.featuredImage === "string" &&
          parsed.featuredImage
        ) {
          normalizedFeaturedImageUrl = parsed.featuredImage;
        } else {
          normalizedFeaturedImageUrl = null;
        }

        // 7. Compose Article (support STANDARD and GALLERY)
        let articleObj: Article;
        const parsedFormat =
          typeof parsed.format === "string" ? parsed.format : "STANDARD";
        if (parsedFormat === "GALLERY") {
          const galleryItems = Array.isArray(parsed.galleryItems)
            ? await restorePreviewGalleryItems(
                parsed.galleryItems as DraftGalleryItem[],
              )
            : [];
          articleObj = {
            _id:
              typeof parsed.articleId === "string"
                ? parsed.articleId
                : undefined,
            title: parsedTitle,
            slug: parsedTitle
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-|-$/g, ""),
            excerpt: parsedExcerpt,
            categoryId: normalizedCategoryId,
            category,
            tags,
            featuredImage:
              typeof normalizedFeaturedImageUrl === "string"
                ? { mediaId: "preview", url: normalizedFeaturedImageUrl, caption: "", credit: "" }
                : undefined,
            authorId: author._id,
            author,
            editorId: null,
            status:
              typeof parsed.status === "string" &&
              Object.values(ArticleStatus).includes(
                parsed.status as ArticleStatus,
              )
                ? (parsed.status as Article["status"])
                : ArticleStatus.DRAFT,
            viewCount: 0,
            metaTitle: parsedTitle,
            metaDesc: parsedExcerpt,
            publishedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
            format: "GALLERY",
            content: parsedContent || undefined,
            galleryItems,
          } as GalleryArticle;
        } else {
          // StandardArticle
          articleObj = {
            _id:
              typeof parsed.articleId === "string"
                ? parsed.articleId
                : undefined,
            title: parsedTitle,
            slug: parsedTitle
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-|-$/g, ""),
            excerpt: parsedExcerpt,
            categoryId: normalizedCategoryId,
            category,
            tags,
            featuredImage:
              typeof normalizedFeaturedImageUrl === "string"
                ? { mediaId: "preview", url: normalizedFeaturedImageUrl, caption: "", credit: "" }
                : undefined,
            authorId: author._id,
            author,
            editorId: null,
            status:
              typeof parsed.status === "string" &&
              Object.values(ArticleStatus).includes(
                parsed.status as ArticleStatus,
              )
                ? (parsed.status as Article["status"])
                : ArticleStatus.DRAFT,
            viewCount: 0,
            metaTitle: parsedTitle,
            metaDesc: parsedExcerpt,
            publishedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
            format: "STANDARD",
            content: parsedContent,
            contentMedia: Array.isArray(parsed.contentMedia)
              ? parsed.contentMedia
              : undefined,
          } as StandardArticle;
        }
        setArticle(articleObj);
      } catch {
        setError("Gagal memuat draft article.");
      } finally {
        setLoading(false);
      }
    };
    loadDraft();
  }, [currentUser, formatParam]);

  const shareUrl = article
    ? resolveCmsArticleShareUrl({
        status: article.status,
        slug: article.slug,
        publicPath: article.publicPath,
      })
    : "";
  const handleCopy = () => copyToClipboard(shareUrl, setCopied);

  // Split article content into pages by page break markers (only for STANDARD)
  const pages = useMemo(() => {
    if (!article) return [""];
    if (article.format === "STANDARD") {
      return splitContentByPageBreak(
        (article as StandardArticle).content ?? "",
      );
    }
    return [article.content ?? ""];
  }, [article]);
  const totalPages = pages.length;
  // Buat pagedArticle dengan author selalu diisi currentUser jika ada
  const pagedArticle = useMemo(() => {
    if (!article) return null;
    let content: string;
    if (isShowAll) {
      content = pages.join("<br/><br/>");
    } else if (article.format === "GALLERY") {
      content = article.content ?? "";
    } else {
      content = pages[Math.min(pageNum - 1, totalPages - 1)] ?? article.content;
    }
    // Jika currentUser ada, gunakan sebagai author, jika tidak fallback ke article.author
    const author = currentUser
      ? {
          _id: currentUser._id || "preview",
          name: currentUser.name || "Unknown Author",
          email: currentUser.email || "",
          avatar: currentUser.avatar || "",
          role: currentUser.role || ROLES.WRITER,
        }
      : article.author;
    return { ...article, content, author };
  }, [article, pages, pageNum, totalPages, currentUser, isShowAll]);

  const handlePageChange = (page: number | "all") => {
    const params = new URLSearchParams(searchParams.toString());
    if (page === "all") {
      params.set("page", "all");
    } else {
      if (page <= 1) params.delete("page");
      else params.set("page", String(page));
    }
    const qs = params.toString();
    router.push(adminPanelHref(`articles/preview${qs ? `?${qs}` : ""}`), {
      scroll: true,
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 text-destructive mb-2" />
        <div className="text-lg text-destructive font-semibold">{error}</div>
        <Link
          href={adminPanelHref("articles")}
          className="text-accent hover:underline"
        >
          Back to Articles
        </Link>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold mb-4">Article not found</h1>
        <Link
          href={adminPanelHref("articles")}
          className="text-accent hover:underline"
        >
          Back to Articles
        </Link>
      </div>
    );
  }

  console.log("Previewing article:", pagedArticle?.author);

  return (
    <div className="min-w-0 max-w-full overflow-x-clip">
      <ArticleUi
        article={pagedArticle as Article}
        shareUrl={shareUrl}
        copied={copied}
        handleCopy={handleCopy}
        formatDateReadable={(date) =>
          formatDateReadable(date instanceof Date ? date.toISOString() : date)
        }
        formatTimeReadable={(date) =>
          formatTimeReadable(date instanceof Date ? date.toISOString() : date)
        }
        isPreview={true}
        currentPage={pageNum}
        totalPages={totalPages}
        isShowAll={isShowAll}
        onPageChange={handlePageChange}
      />
    </div>
  );
}
