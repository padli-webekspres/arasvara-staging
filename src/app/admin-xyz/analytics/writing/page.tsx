"use client";
import { useState, useEffect } from "react";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import UserAvatar from "@/components/users/AvatarUser";
import { ListTableColumn } from "@/components/table/ListTable";
import CardReportTable from "@/components/admin/reports/CardReportTable";
import { useReportArticleWriter } from "@/hooks/useReportArticleWriter";
import { adminPanelHref } from "@/lib/admin-panel-path";
import { resolveCmsArticleViewHref } from "@/lib/article-public-path";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Table Columns Definition - Article Writer Report
 * ─────────────────────────────────────────────────────────────────────────────
 */
type ArticleWriterTableRow = {
  user: { avatar?: string; name?: string; email?: string };
  totalArticles?: number;
  articlesLast30Days?: number;
  readersLast30Days?: number;
};
type ArticleEngagementTableRow = {
  article: {
    title?: string;
    slug?: string;
    publicPath?: string | null;
    status?: string;
    publishedAt?: Date | string;
    category?: { slug?: string };
  };
  totalViews?: number;
  viewsLast30Days?: number;
};

const handleView = () => {
  // TODO: Implement view detail functionality
};

const columnsArticleUser: ListTableColumn<ArticleWriterTableRow>[] = [
  {
    key: "name",
    header: "User",
    render: (row: ArticleWriterTableRow) => (
      <div className="flex items-center gap-3">
        <UserAvatar
          avatar={row.user.avatar}
          name={row.user.name || row.user.email || "User"}
          className="h-9 w-9 shrink-0"
        />
        <div className="min-w-0">
          <p className="font-medium line-clamp-1">{row.user.name}</p>
          <p className="text-sm text-muted-foreground line-clamp-1">
            {row.user.email}
          </p>
        </div>
      </div>
    ),
  },
  {
    key: "totalArticles",
    header: "Total Artikel",
    render: (row: ArticleWriterTableRow) => (
      <span>{row.totalArticles ?? 0}</span>
    ),
  },
  {
    key: "articlesLast30Days",
    header: "Artikel 30 Hari",
    className: "hidden md:table-cell",
    render: (row: ArticleWriterTableRow) => (
      <span>{row.articlesLast30Days ?? 0}</span>
    ),
  },
  {
    key: "readersLast30Days",
    header: "Pembaca 30 Hari",
    className: "hidden md:table-cell",
    render: (row: ArticleWriterTableRow) => (
      <span>{row.readersLast30Days ?? 0}</span>
    ),
  },
  {
    key: "actions",
    header: <span className="float-right">Aksi</span>,
    className: "text-right p-4 font-medium",
    render: () => (
      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" size="icon" onClick={handleView}>
          <Eye className="h-4 w-4" />
        </Button>
      </div>
    ),
  },
];

const columnsEngagement: ListTableColumn<ArticleEngagementTableRow>[] = [
  {
    key: "title",
    header: "Judul",
    render: (row: ArticleEngagementTableRow) => {
      const title = row.article.title || "";
      const displayTitle =
        title.length > 30 ? title.slice(0, 30) + "..." : title;
      return (
        <Link
          href={resolveCmsArticleViewHref({
            status: row.article.status ?? "PUBLISHED",
            slug: row.article.slug,
            publicPath: row.article.publicPath,
            categorySlug: row.article.category?.slug,
            publishedAt: row.article.publishedAt,
          })}
          className="font-medium hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          {displayTitle}
        </Link>
      );
    },
  },
  {
    key: "totalViews",
    header: "Total Pembaca",
    render: (row: ArticleEngagementTableRow) => (
      <span>{row.totalViews ?? 0}</span>
    ),
  },
  {
    key: "viewsLast30Days",
    header: "Pembaca 30 Hari",
    render: (row: ArticleEngagementTableRow) => (
      <span>{row.viewsLast30Days ?? 0}</span>
    ),
  },
  {
    key: "actions",
    header: <span className="float-right">Aksi</span>,
    className: "text-right p-4 font-medium",
    render: () => (
      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" size="icon" onClick={handleView}>
          <Eye className="h-4 w-4" />
        </Button>
      </div>
    ),
  },
];

const UsersPage = () => {
  /**
   * ─────────────────────────────────────────────────────────────────────────
   * Writer Report State
   * ─────────────────────────────────────────────────────────────────────────
   */
  const [currentPageWriter, setCurrentPageWriter] = useState(1);
  const [searchInputWriter, setSearchInputWriter] = useState("");
  const [searchQueryWriter, setSearchQueryWriter] = useState("");

  /**
   * ─────────────────────────────────────────────────────────────────────────
   * Engagement Report State
   * ─────────────────────────────────────────────────────────────────────────
   */
  const [currentPageEngagement, setCurrentPageEngagement] = useState(1);
  const [searchInputEngagement, setSearchInputEngagement] = useState("");
  const [searchQueryEngagement, setSearchQueryEngagement] = useState("");

  /**
   * ─────────────────────────────────────────────────────────────────────────
   * React Query Hooks - Writer Report
   * ─────────────────────────────────────────────────────────────────────────
   */
  const writerReportQuery = useReportArticleWriter(
    currentPageWriter,
    searchQueryWriter,
  );

  /**
   * ─────────────────────────────────────────────────────────────────────────
   * Regex untuk validasi input search
   * Hanya izinkan: alfabet, angka, @, ., _, -
   * ─────────────────────────────────────────────────────────────────────────
   */
  const allowedSearchRegex = /^[a-zA-Z0-9@._-]*$/;

  /**
   * ─────────────────────────────────────────────────────────────────────────
   * Effect: Debounce Writer Search (0.5 seconds)
   * ─────────────────────────────────────────────────────────────────────────
   */
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      setSearchQueryWriter(searchInputWriter);
      setCurrentPageWriter(1);
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [searchInputWriter]);

  /**
   * ─────────────────────────────────────────────────────────────────────────
   * Effect: Debounce Engagement Search (0.5 seconds)
   * ─────────────────────────────────────────────────────────────────────────
   */
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      setSearchQueryEngagement(searchInputEngagement);
      setCurrentPageEngagement(1);
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [searchInputEngagement]);

  /**
   * ─────────────────────────────────────────────────────────────────────────
   * Effect: Debounce Writer Search (0.5 seconds)
   * ─────────────────────────────────────────────────────────────────────────
   */
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      setSearchQueryWriter(searchInputWriter);
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [searchInputWriter]);

  /**
   * ─────────────────────────────────────────────────────────────────────────
   * Effect: Debounce Engagement Search (0.5 seconds)
   * ─────────────────────────────────────────────────────────────────────────
   */
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      setSearchQueryEngagement(searchInputEngagement);
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [searchInputEngagement]);

  /**
   * ─────────────────────────────────────────────────────────────────────────
   * Handler: Writer Report Page Change
   * ─────────────────────────────────────────────────────────────────────────
   */
  const handlePageChangeWriter = (page: number) => {
    setCurrentPageWriter(page);
  };

  /**
   * ─────────────────────────────────────────────────────────────────────────
   * Handler: Engagement Report Page Change
   * ─────────────────────────────────────────────────────────────────────────
   */
  const handlePageChangeEngagement = (page: number) => {
    setCurrentPageEngagement(page);
  };

  /**
   * ─────────────────────────────────────────────────────────────────────────
   * Handler: Writer Report Search Change
   * ─────────────────────────────────────────────────────────────────────────
   */
  const handleSearchChangeWriter = (searchValue: string) => {
    if (allowedSearchRegex.test(searchValue)) {
      setSearchInputWriter(searchValue);
      setCurrentPageWriter(1);
    }
  };

  /**
   * ─────────────────────────────────────────────────────────────────────────
   * Handler: Engagement Report Search Change
   * ─────────────────────────────────────────────────────────────────────────
   */
  const handleSearchChangeEngagement = (searchValue: string) => {
    if (allowedSearchRegex.test(searchValue)) {
      setSearchInputEngagement(searchValue);
      setCurrentPageEngagement(1);
    }
  };

  return (
    <div className="min-w-0 max-w-full space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Report Article</h1>
          <p className="text-muted-foreground">Manage all reported articles</p>
        </div>
      </div>

      <CardReportTable
        title="Laporan artikel penulis"
        link={adminPanelHref("reports/articles/users")}
        columns={columnsArticleUser}
        data={writerReportQuery.data?.reports || []}
        loading={writerReportQuery.isLoading}
        currentPage={writerReportQuery.data?.pagination.page || 1}
        totalPages={writerReportQuery.data?.pagination.totalPages || 0}
        onPageChange={handlePageChangeWriter}
        search={searchInputWriter}
        onSearchChange={handleSearchChangeWriter}
      />
      {/* <div className="grid grid-cols-1 xl:grid-cols-2 gap-6"> */}
      {/* Writer Report Card */}

      {/* Engagement Report Card */}
      {/* <CardReportTable
          title="Laporan engagement"
          columns={columnsEngagement}
          data={engagementReportQuery.data?.reports || []}
          loading={engagementReportQuery.isLoading}
          currentPage={engagementReportQuery.data?.pagination.page || 1}
          totalPages={engagementReportQuery.data?.pagination.totalPages || 0}
          onPageChange={handlePageChangeEngagement}
          search={searchInputEngagement}
          onSearchChange={handleSearchChangeEngagement}
        /> */}
      {/* </div> */}
    </div>
  );
};

export default UsersPage;
