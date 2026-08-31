"use client";
import { usePathname } from "next/navigation";
import ArticleUi from "@/components/news/ArticleUi";
import {
  copyToClipboard,
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
import CategoryPushPrompt from "@/components/notification/CategoryPushPrompt";
import {
  buildArticleGaParams,
  getGaClientIdAsync,
} from "@/lib/google-analytics";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { trackPushOpen } from "@/lib/ga-events";
import { shouldCountArticleView } from "@/lib/articleViewAccess";
import {
  nextArticlePageQuery,
  resolveArticleContentView,
} from "@/lib/article-content-pagination";

interface NewsDetailClientProps {
  article: Article;
  related: ArticleListResponse[];
  /** URL share kanonikal tanpa query page — dari server, selaras OG metadata. */
  canonicalShareUrl: string;
  /** Dari env server `ARTICLE_CONTENT_PAGINATION` — bukan `NEXT_PUBLIC_*`. */
  paginationEnabled: boolean;
}

const NewsDetailClient: React.FC<NewsDetailClientProps> = ({
  article,
  related,
  canonicalShareUrl,
  paginationEnabled,
}) => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isShowAll, pageNum } = resolveArticleContentView(
    searchParams.get("page"),
    paginationEnabled,
  );

  const { data: currentUser } = useCurrentUser();
  const userType: "logged_in" | "guest" = currentUser ? "logged_in" : "guest";

  const pathname = usePathname();
  useEffect(() => {
    if (!article?._id) return;
    if (!shouldCountArticleView(article.status)) return;
    const key = `viewed_article_${article._id}`;
    if (typeof window !== "undefined" && !sessionStorage.getItem(key)) {
      (async () => {
        try {
          const gaClientId = await getGaClientIdAsync();
          const gaParams = buildArticleGaParams(
            article,
            isShowAll ? "all" : pageNum,
            {
              pagePath: window.location.pathname + window.location.search,
              pageLocation: window.location.href,
              pageTitle: document.title,
            },
            userType,
          );

          await api.post("/analytics/view-article", {
            articleId: article._id,
            userAgent: navigator.userAgent,
            referrer: document.referrer,
            gaClientId,
            gaParams,
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
    const qs = nextArticlePageQuery(
      searchParams,
      page,
      paginationEnabled,
    );
    router.push(qs ? `?${qs}` : window.location.pathname, { scroll: true });
  };
  const [copied, setCopied] = useState(false);

  const shareUrl = canonicalShareUrl;
  const handleCopy = () => {
    void copyToClipboard(shareUrl, setCopied);
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("ref") !== "push") return;
    const sessionKey = `push_open_${article._id}`;
    if (sessionStorage.getItem(sessionKey)) return;
    sessionStorage.setItem(sessionKey, "1");
    trackPushOpen({
      notification_id: urlParams.get("notif_id") ?? "",
      notification_title: urlParams.get("notif_title") ?? "",
      article_id: String(article._id ?? ""),
      category_name: article.category?.name ?? "",
    });
  }, [article._id]);

  useArticleTracking(article, isShowAll ? "all" : pageNum);

  return (
    <main className="pt-48 pb-8">
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
    </main>
  );
};

export default NewsDetailClient;
