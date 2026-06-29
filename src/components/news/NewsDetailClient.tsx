"use client";
import { usePathname } from "next/navigation";
import ArticleUi from "@/components/news/ArticleUi";
import {
  formatDateReadable,
  formatTimeReadable,
  splitContentByPageBreak,
} from "@/lib/utils";
import { useState, useMemo, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import api from "@/lib/axios";
import { Article, ArticleListResponse } from "@/types/article";
import { useLatestArticles } from "@/hooks/useLatestArticles";
import { useArticlePageAds } from "@/hooks/useAds";
import { useArticleTracking } from "@/hooks/useArticleTracking";
import { resolveAuthorPublicHref } from "@/lib/author-public-path";
import { buildAbsoluteUrl, getSiteBaseUrl } from "@/lib/og-image";
import CategoryPushPrompt from "@/components/notification/CategoryPushPrompt";

interface NewsDetailClientProps {
  article: Article;
  related: ArticleListResponse[];
  /** URL share kanonikal tanpa query page — dari server, selaras OG metadata. */
  canonicalShareUrl: string;
}

const NewsDetailClient: React.FC<NewsDetailClientProps> = ({
  article,
  related,
  canonicalShareUrl,
}) => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pageParam = searchParams.get("page");
  const isShowAll = pageParam === "all";
  const pageNum = isShowAll ? 1 : Math.max(1, parseInt(pageParam || "1") || 1);

  const pathname = usePathname();
  useEffect(() => {
    if (!article?._id) return;
    const key = `viewed_article_${article._id}`;
    if (typeof window !== "undefined" && !sessionStorage.getItem(key)) {
      (async () => {
        try {
          await api.post("/analytics/view-article", {
            articleId: article._id,
            userAgent: navigator.userAgent,
            referrer: document.referrer,
          });
          sessionStorage.setItem(key, "1");
        } catch (e) {
          console.error("Failed to log article view:", e);
        }
      })();
    }
    return () => {
      // Tidak perlu hapus flag, biarkan per session per artikel
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article?._id, pathname]);

  const pages = useMemo(
    () => splitContentByPageBreak(article?.content || ""),
    [article?.content],
  );
  const totalPages = pages.length;
  const currentContent = isShowAll
    ? pages.join("<br/><br/>")
    : (pages[Math.min(pageNum - 1, totalPages - 1)] ?? article.content);

  const pagedArticle = useMemo(
    () => ({ ...article, content: currentContent }),
    [article, currentContent],
  );

  const handlePageChange = (page: number | "all") => {
    const params = new URLSearchParams(searchParams.toString());
    if (page === "all") {
      params.set("page", "all");
    } else {
      if (page <= 1) params.delete("page");
      else params.set("page", String(page));
    }
    const qs = params.toString();
    router.push(qs ? `?${qs}` : window.location.pathname, { scroll: true });
  };
  const [copied, setCopied] = useState(false);

  const shareUrl = canonicalShareUrl;
  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const { data: latestPages, isLoading: isLoadingLatestArticles } =
    useLatestArticles();

  const latestArticles =
    latestPages?.pages?.flatMap((p: { articles: Article[] }) => p.articles) ??
    [];

  const categorySlug =
    typeof article.category?.slug === "string"
      ? article.category.slug.trim()
      : undefined;
  const categoryIdSource =
    article.categoryId ?? article.category?._id ?? undefined;
  const categoryId =
    categoryIdSource !== undefined && categoryIdSource !== null
      ? String(categoryIdSource).trim()
      : undefined;

  const { data: articleAdsData, isLoading: isLoadingArticleAds } =
    useArticlePageAds({
      categorySlug,
      categoryId,
      enabled: Boolean(categorySlug || categoryId),
    });

  const articleVerticalAd = useMemo(() => {
    const list = articleAdsData?.vertical ?? [];
    return [...list].sort((a, b) => a.order - b.order)[0] ?? null;
  }, [articleAdsData]);

  const articleHorizontalAds = useMemo(() => {
    const list = articleAdsData?.horizontal ?? [];
    return [...list].sort((a, b) => a.order - b.order);
  }, [articleAdsData]);

  useArticleTracking(article, isShowAll ? "all" : pageNum);

  const authorProfilePath = resolveAuthorPublicHref(article.author);
  const authorProfileUrl = authorProfilePath
    ? buildAbsoluteUrl(authorProfilePath, getSiteBaseUrl())
    : undefined;

  return (
    <main className="pt-40">
      <ArticleUi
        related={related}
        article={pagedArticle}
        shareUrl={shareUrl}
        copied={copied}
        handleCopy={handleCopy}
        formatDateReadable={(date) =>
          formatDateReadable(date instanceof Date ? date.toISOString() : date)
        }
        formatTimeReadable={(date) =>
          formatTimeReadable(date instanceof Date ? date.toISOString() : date)
        }
        isPreview={false}
        isPageAdmin={false}
        currentPage={pageNum}
        totalPages={totalPages}
        isShowAll={isShowAll}
        onPageChange={handlePageChange}
        isForPublic={true}
        latestArticles={latestArticles}
        isLoadingLatestArticles={isLoadingLatestArticles}
        articleVerticalAd={articleVerticalAd}
        articleHorizontalAds={articleHorizontalAds}
        isLoadingArticleAds={isLoadingArticleAds}
      />

      {article.category?.slug ? (
        <CategoryPushPrompt
          categorySlug={article.category.slug}
          categoryName={article.category.name}
        />
      ) : null}

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "NewsArticle",
            headline: article.title,
            description: article.excerpt,
            image: article.featuredImage,
            datePublished: article.publishedAt,
            dateModified: article.updatedAt,
            url: canonicalShareUrl,
            mainEntityOfPage: {
              "@type": "WebPage",
              "@id": canonicalShareUrl,
            },
            author: {
              "@type": "Person",
              name: article.author?.name || "Unknown Author",
              ...(authorProfileUrl ? { url: authorProfileUrl } : {}),
            },
            publisher: {
              "@type": "Organization",
              name: "ARASVARA",
              logo: {
                "@type": "ImageObject",
                url: "https://arasvara.id/logo.png",
              },
            },
          }),
        }}
      />
    </main>
  );
};

export default NewsDetailClient;
