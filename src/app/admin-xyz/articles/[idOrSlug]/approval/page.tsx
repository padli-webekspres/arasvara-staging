"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams, useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import ArticleUi from "@/components/news/ArticleUi";
import ArticleApprovalForm from "@/components/news/ArticleApprovalForm";
import ApprovalSidebar from "@/components/news/ApprovalSidebar";
import {
  copyToClipboard,
  formatDateReadable,
  splitContentByPageBreak,
  formatTimeReadable,
  resolveCmsArticleShareUrl,
} from "@/lib/utils";
import { Article } from "@/types/article";
import api from "@/lib/axios";
import { adminPanelHref } from "@/lib/admin-panel-path";
import { useArticleContentPaginationEnabled } from "@/components/admin/ArticleContentPaginationFlag";
import {
  nextArticlePageQuery,
  resolveArticleContentView,
} from "@/lib/article-content-pagination";

export default function SingleArticleApprovalPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const params = useParams();
  const { data: user } = useCurrentUser();
  const paginationEnabled = useArticleContentPaginationEnabled();
  const { isShowAll, pageNum } = resolveArticleContentView(
    searchParams.get("page"),
    paginationEnabled,
  );

  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Fetch article from approval endpoint
  const fetchArticle = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const idOrSlug = params?.idOrSlug as string;
      const res = await api.get(`/articles/${idOrSlug}/approval`, {
        withCredentials: true,
      });
      setArticle(res.data.article);
    } catch (err: any) {
      if (err.response && err.response.data && err.response.data.error) {
        setError(err.response.data.error);
      } else {
        setError(err.message || "Gagal mengambil artikel");
      }
    } finally {
      setLoading(false);
    }
  }, [params?.idOrSlug]);

  useEffect(() => {
    fetchArticle();
  }, [fetchArticle]);

  const shareUrl = article
    ? resolveCmsArticleShareUrl({
        status: article.status,
        slug: article.slug,
        publicPath: article.publicPath,
      })
    : "";
  const handleCopy = () => copyToClipboard(shareUrl, setCopied);

  // Split article content into pages by page break markers
  const pages = useMemo(
    () => splitContentByPageBreak(article?.content || ""),
    [article?.content],
  );
  const totalPages = pages.length;
  const pagedArticle = useMemo(() => {
    if (!article) return null;
    const content = isShowAll
      ? pages.join("<br/><br/>")
      : (pages[Math.min(pageNum - 1, totalPages - 1)] ?? article.content);
    return { ...article, content };
  }, [article, pages, pageNum, totalPages, isShowAll]);

  // get idorslug from url
  const idOrSlug = params?.idOrSlug as string;

  const handlePageChange = (page: number | "all") => {
    const qs = nextArticlePageQuery(
      searchParams,
      page,
      paginationEnabled,
    );
    router.push(
      adminPanelHref(`articles/${idOrSlug}/approval/${qs ? `?${qs}` : ""}`),
      {
        scroll: true,
      },
    );
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

  return (
    <div className="flex flex-col lg:flex-row lg:items-start lg:gap-8 min-w-0 max-w-full">
      {/* Main Content - Article Preview */}
      <div className="flex-1 min-w-0 space-y-4 sm:space-y-6">
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
          isPageAdmin={true}
        />

        {/* Mobile/Tablet - Approval Form Below Article */}
        <div className="lg:hidden">
          {user && article && (
            <ArticleApprovalForm
              article={article}
              userRole={user.role || ""}
              onSuccess={fetchArticle}
            />
          )}
        </div>
      </div>

      {/* Desktop Sidebar - Approval Form */}
      {user && article && (
        <ApprovalSidebar
          article={article}
          userRole={user.role || ""}
          onSuccess={fetchArticle}
        />
      )}
    </div>
  );
}
