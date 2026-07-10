"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import {
  Plus,
  Search,
  Eye,
  Edit,
  Ban,
  Clock,
  CheckCircle,
  XCircle,
  Calendar as CalendarIcon,
  MoreHorizontal,
  Link as LinkIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Article, ArticleListResponse, ArticleStatus } from "@/types/article";
import { Category } from "@/types/category";
import {
  ArticleSearchResult,
  VideoItem,
  VideoSearchResult,
} from "@/types/search";
import {
  formatDateReadable,
  formatDateTimeReadable,
  formatTimeReadable,
  cn,
} from "@/lib/utils";
import { getAdminStandardCardGridClass } from "@/lib/admin-card-grid";
import { ListTable, ListTableColumn } from "@/components/table/ListTable";
import api from "@/lib/axios";
import { toast } from "sonner";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { ROLES } from "@/lib/auth-client";
import { ADMIN_PAGINATION_WRAP } from "@/lib/admin-ui";
import { adminPanelHref } from "@/lib/admin-panel-path";
import { resolveCmsArticleViewHref } from "@/lib/article-public-path";
import { DayPicker, DateRange } from "react-day-picker";
import { format, isValid, parse } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import "react-day-picker/dist/style.css";

const CMS_SEARCH_LIMIT = 12;

interface StatusConfigType {
  [key: string]: {
    variant: "default" | "secondary" | "outline" | "destructive";
    icon: React.ElementType;
    label: string;
  };
}

function parseYmd(value: string | null): Date | undefined {
  if (!value?.trim()) return undefined;
  const d = parse(value.trim(), "yyyy-MM-dd", new Date());
  return isValid(d) ? d : undefined;
}

function parseMongoDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === "string") return new Date(value);
  return new Date();
}

/** Memetakan baris hasil search ke `Article` agar cocok dengan kolom & hapus. */
function articleListRowToArticle(row: ArticleListResponse): Article {
  const publishedAt = parseMongoDate(row.publishedAt);
  const updatedAt = parseMongoDate(row.updatedAt);
  const fmt = row.format === "GALLERY" ? "GALLERY" : "STANDARD";
  const authorId =
    typeof row.author?._id === "string"
      ? row.author._id
      : ((
          row.author?._id as { toString?: () => string } | undefined
        )?.toString?.() ?? "");
  const categoryId =
    typeof row.category?._id === "string"
      ? row.category._id
      : ((
          row.category?._id as { toString?: () => string } | undefined
        )?.toString?.() ?? "");

  const base = {
    _id: row._id,
    title: row.title,
    slug: row.slug,
    publicPath: row.publicPath ?? null,
    urlFormat: row.urlFormat,
    excerpt: row.excerpt,
    categoryId,
    category: row.category,
    tags: row.tags ?? [],
    featuredImage: row.featuredImage ?? null,
    authorId,
    author: row.author,
    editorId:
      typeof row.editor?._id === "string"
        ? row.editor._id
        : ((
            row.editor?._id as { toString?: () => string } | undefined
          )?.toString?.() ?? null),
    editor: row.editor ?? null,
    status: row.status,
    viewCount: row.viewCount ?? 0,
    metaTitle: row.title,
    metaDesc: row.excerpt,
    publishedAt,
    createdAt: updatedAt,
    updatedAt,
    revisionHistory: [],
    isFeatured: row.isFeatured,
    isHeadline: row.isHeadline,
    isBreaking: row.isBreaking,
    format: fmt,
  };

  if (fmt === "GALLERY") {
    return { ...base, format: "GALLERY", galleryItems: [] } as Article;
  }
  return { ...base, format: "STANDARD", content: "" } as Article;
}

const ArticlesPage = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: user } = useCurrentUser();

  const [articleRows, setArticleRows] = useState<Article[]>([]);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoriesData, setCategoriesData] = useState<Category[]>([]);
  const [takeDownId, setTakeDownId] = useState<string | null>(null);
  const [isConfirmingUpdateTags, setIsConfirmingUpdateTags] = useState(false);

  const handleUpdateTags = useCallback(() => {
    toast.promise(api.post("/tags/recommendation"), {
      loading: "Memperbarui rekomendasi tag...",
      success: (res) => {
        const total = res.data?.totalTags ?? 10;
        return `Rekomendasi ${total} tag terpopuler berhasil diperbarui!`;
      },
      error: "Gagal memperbarui rekomendasi tag.",
    });
  }, []);

  const [pagination, setPagination] = useState({
    page: 1,
    totalPages: 1,
    total: 0,
    limit: CMS_SEARCH_LIMIT,
  });

  const qFromUrl = searchParams.get("q") ?? "";
  const [qDraft, setQDraft] = useState(qFromUrl);

  useEffect(() => {
    setQDraft(qFromUrl);
  }, [qFromUrl]);

  const pushParams = useCallback(
    (
      patch: Record<string, string | number | null | undefined>,
      opts?: { replace?: boolean },
    ) => {
      const sp = new URLSearchParams(searchParams.toString());
      for (const [key, val] of Object.entries(patch)) {
        if (val === null || val === undefined || val === "") {
          sp.delete(key);
        } else {
          sp.set(key, String(val));
        }
      }
      const qs = sp.toString();
      const url = qs ? `${pathname}?${qs}` : pathname;
      if (opts?.replace) router.replace(url, { scroll: false });
      else router.push(url, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = qDraft.trim();
      if (next === qFromUrl.trim()) return;
      pushParams({ q: next || null, page: 1 }, { replace: true });
    }, 450);
    return () => window.clearTimeout(timer);
  }, [qDraft, qFromUrl, pushParams]);

  const type = (searchParams.get("type") || "ARTICLES") as "ARTICLES" | "VIDEO";
  const status = searchParams.get("status") ?? "all";
  const formatFilter = searchParams.get("format") ?? "";
  const categorySlug = searchParams.get("category") ?? "";

  const page = useMemo(
    () => Math.max(1, parseInt(searchParams.get("page") || "1", 10)),
    [searchParams],
  );

  const dateRange: DateRange | undefined = useMemo(() => {
    const from = parseYmd(searchParams.get("dateFrom"));
    const to = parseYmd(searchParams.get("dateTo"));
    if (!from && !to) return undefined;
    return { from: from ?? to, to: to ?? from };
  }, [searchParams]);

  const restrictByAuthor = Boolean(
    user?._id &&
    user.role &&
    [ROLES.WRITER, ROLES.REPORTER, ROLES.CONTRIBUTOR].includes(user.role),
  );

  useEffect(() => {
    async function fetchCategories() {
      try {
        const { data } = await api.get("/categories?limit=1000");
        setCategoriesData(data.categories || []);
      } catch {
        setCategoriesData([]);
      }
    }
    fetchCategories();
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const sp = new URLSearchParams();
      sp.set("limit", String(CMS_SEARCH_LIMIT));
      sp.set("page", String(page));
      sp.set("type", type);

      const q = searchParams.get("q")?.trim();
      if (q) sp.set("q", q);

      const dateFrom = searchParams.get("dateFrom")?.trim();
      const dateTo = searchParams.get("dateTo")?.trim();
      if (dateFrom) sp.set("dateFrom", dateFrom);
      if (dateTo) sp.set("dateTo", dateTo);

      if (type === "ARTICLES") {
        sp.set("status", status);
        sp.set("sortBy", "updatedAt"); // Urutkan dari yang terbaru (updatedAt), tidak peduli statusnya apa
        if (formatFilter === "STANDARD" || formatFilter === "GALLERY") {
          sp.set("format", formatFilter);
        }
        if (categorySlug) sp.set("category", categorySlug);
        if (restrictByAuthor && user?._id) {
          sp.set("authorId", user._id);
        }
      }

      const { data } = await api.get<
        | ArticleSearchResult
        | VideoSearchResult
        | { success?: false; error?: string }
      >(`/search?${sp.toString()}`);

      if (!data || typeof data !== "object" || data.success !== true) {
        setArticleRows([]);
        setVideos([]);
        setPagination((prev) => ({
          ...prev,
          page: 1,
          totalPages: 1,
          total: 0,
          limit: CMS_SEARCH_LIMIT,
        }));
        return;
      }

      if (type === "VIDEO") {
        const vr = data as VideoSearchResult;
        setVideos(vr.data || []);
        setArticleRows([]);
        setPagination({
          page: vr.meta.page,
          totalPages: vr.meta.totalPages,
          total: vr.meta.total,
          limit: vr.meta.limit,
        });
      } else {
        const ar = data as ArticleSearchResult;
        const mapped = (ar.data || []).map(articleListRowToArticle);
        setArticleRows(mapped);
        setVideos([]);
        setPagination({
          page: ar.meta.page,
          totalPages: ar.meta.totalPages,
          total: ar.meta.total,
          limit: ar.meta.limit,
        });
      }
    } catch {
      setArticleRows([]);
      setVideos([]);
      setPagination((prev) => ({
        ...prev,
        page: 1,
        totalPages: 1,
        total: 0,
      }));
    } finally {
      setLoading(false);
    }
  }, [
    searchParams,
    type,
    status,
    formatFilter,
    categorySlug,
    page,
    restrictByAuthor,
    user?._id,
  ]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getStatusBadge = (articleStatus: ArticleStatus | string) => {
    const statusConfig: StatusConfigType = {
      PUBLISHED: { variant: "default", icon: CheckCircle, label: "Published" },
      DRAFT: { variant: "secondary", icon: Clock, label: "Waiting" },
      PENDING_REVIEW: {
        variant: "outline",
        icon: Clock,
        label: "Pending Review",
      },
      REJECTED: { variant: "destructive", icon: XCircle, label: "Rejected" },
      SCHEDULED: { variant: "outline", icon: Clock, label: "Scheduled" },
      TAKEN_DOWN: {
        variant: "destructive",
        icon: XCircle,
        label: "Taken Down",
      },
      APPROVED: { variant: "default", icon: CheckCircle, label: "Approved" },
      DELETED: { variant: "destructive", icon: XCircle, label: "Deleted" },
    };

    const config = statusConfig[articleStatus] || statusConfig.DRAFT;
    return (
      <Badge variant={config.variant} className="capitalize">
        <config.icon className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  const handleTakeDown = async () => {
    if (!takeDownId) return;
    try {
      await api.patch(`/articles/${takeDownId}`, { status: "TAKEN_DOWN" });
      toast.success("Article successfully taken down!");
      setTakeDownId(null);
      fetchData();
    } catch (error) {
      const message =
        error && typeof error === "object" && "message" in error
          ? (error.message as string)
          : "Error taking down article";
      toast.error(message);
      setTakeDownId(null);
    }
  };

  const columns: ListTableColumn<Article>[] = [
    {
      key: "title",
      header: "Title",
      render: (row) => (
        <div className="max-w-xs">
          <p className="font-medium line-clamp-1">{row.title}</p>
          <p className="text-sm text-muted-foreground line-clamp-1">
            {row.excerpt}
          </p>
        </div>
      ),
    },
    {
      key: "category",
      header: <span className="hidden md:inline">Category</span>,
      className: "p-4 hidden md:table-cell",
      render: (row) => (
        <span className="capitalize">{row.category?.name || "-"}</span>
      ),
    },
    {
      key: "author",
      header: <span className="hidden lg:inline">Author</span>,
      className: "p-4 hidden lg:table-cell",
      render: (row) => row.author?.name || "-",
    },
    {
      key: "status",
      header: "Status",
      render: (row) => getStatusBadge(row.status),
    },
    {
      key: "viewCount",
      header: <span className="hidden md:inline">Views</span>,
      className: "p-4 hidden md:table-cell",
      render: (row) =>
        row.viewCount ? Number(row.viewCount).toLocaleString() : 0,
    },
    {
      key: "updatedAt",
      header: <span className="hidden lg:inline">Updated</span>,
      className: "p-4 hidden lg:table-cell",
      render: (row) =>
        row.updatedAt
          ? formatDateReadable(row.updatedAt) +
            " - " +
            formatTimeReadable(row.updatedAt)
          : "-",
    },
    {
      key: "actions",
      header: "Actions",
      className: "p-4",
      render: (row) => (
        <DropdownMenu>
          <DropdownMenuTrigger>
            <Button variant="ghost" size="icon" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <Link href={resolveCmsArticleViewHref({ status: row.status, slug: row.slug, publicPath: row.publicPath, categorySlug: row.category?.slug, publishedAt: row.publishedAt })} target="_blank" className="w-full">
              <DropdownMenuItem className="cursor-pointer">
                <Eye className="mr-2 h-4 w-4 text-muted-foreground" />
                <span>Lihat</span>
              </DropdownMenuItem>
            </Link>
            <Link
              href={adminPanelHref(`articles/${row.slug || row._id}`)}
              className="w-full"
            >
              <DropdownMenuItem className="cursor-pointer">
                <Edit className="mr-2 h-4 w-4 text-muted-foreground" />
                <span>Edit</span>
              </DropdownMenuItem>
            </Link>
            <DropdownMenuItem
              onClick={() => setTakeDownId(row._id || row.slug)}
              disabled={row.status === "TAKEN_DOWN"}
              className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
            >
              <Ban className="mr-2 h-4 w-4 text-destructive" />
              <span>Take Down</span>
            </DropdownMenuItem>
            <Link
              href={adminPanelHref(`articles/${row.slug || row._id}/related`)}
              className="w-full"
            >
              <DropdownMenuItem className="cursor-pointer">
                <LinkIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                <span>Atur Terkait</span>
              </DropdownMenuItem>
            </Link>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const dateRangeLabel = () => {
    if (!dateRange?.from) return "Rentang tanggal";
    if (!dateRange.to || dateRange.from.getTime() === dateRange.to.getTime()) {
      return format(dateRange.from, "d MMM yyyy", { locale: idLocale });
    }
    return `${format(dateRange.from, "d MMM yyyy", { locale: idLocale })} – ${format(dateRange.to, "d MMM yyyy", { locale: idLocale })}`;
  };

  const onDateRangeSelect = (range: DateRange | undefined) => {
    if (!range?.from) {
      pushParams({ dateFrom: null, dateTo: null, page: 1 }, { replace: true });
      return;
    }
    const fromStr = format(range.from, "yyyy-MM-dd");
    const toStr = range.to
      ? format(range.to, "yyyy-MM-dd")
      : format(range.from, "yyyy-MM-dd");
    pushParams(
      { dateFrom: fromStr, dateTo: toStr, page: 1 },
      { replace: true },
    );
  };

  return (
    <div className="min-w-0 max-w-full space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Articles</h1>
          <p className="text-muted-foreground">
            Kelola artikel dan video (pencarian via API Search)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setIsConfirmingUpdateTags(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Perbarui Rekomendasi Tag
          </Button>
          <Link href={adminPanelHref("articles/new")}>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Article
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Cari (judul, kutipan, tag, kategori, penulis)…"
            value={qDraft}
            onChange={(e) => setQDraft(e.target.value)}
            className="pl-10"
            aria-label="Kata kunci pencarian"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
          <div className="space-y-2">
            <Label htmlFor="filter-type">Type</Label>
            <Select
              value={type}
              onValueChange={(v) => {
                const next = v as "ARTICLES" | "VIDEO";
                if (next === "VIDEO") {
                  pushParams({
                    type: "VIDEO",
                    page: 1,
                    format: null,
                    category: null,
                    status: null,
                  });
                } else {
                  pushParams({ type: null, page: 1 });
                }
              }}
            >
              <SelectTrigger id="filter-type" className="w-full">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ARTICLES">Articles</SelectItem>
                <SelectItem value="VIDEO">Video</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {type === "ARTICLES" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="filter-status">Status</Label>
                <Select
                  value={status}
                  onValueChange={(v) => pushParams({ status: v, page: 1 })}
                >
                  <SelectTrigger id="filter-status" className="w-full">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua status</SelectItem>
                    <SelectItem value="PUBLISHED">Published</SelectItem>
                    <SelectItem value="DRAFT">Waiting</SelectItem>
                    <SelectItem value="PENDING_REVIEW">
                      Pending Review
                    </SelectItem>
                    <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                    <SelectItem value="TAKEN_DOWN">Taken Down</SelectItem>
                    <SelectItem value="REJECTED">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="filter-format">Format</Label>
                <Select
                  value={formatFilter || "__any__"}
                  onValueChange={(v) =>
                    pushParams({
                      format: v === "__any__" ? null : v,
                      page: 1,
                    })
                  }
                >
                  <SelectTrigger id="filter-format" className="w-full">
                    <SelectValue placeholder="Format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__any__">Semua format</SelectItem>
                    <SelectItem value="STANDARD">Standard</SelectItem>
                    <SelectItem value="GALLERY">Gallery</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="filter-category">Category</Label>
                <Select
                  value={categorySlug || "__all__"}
                  onValueChange={(v) =>
                    pushParams({
                      category: v === "__all__" ? null : v,
                      page: 1,
                    })
                  }
                >
                  <SelectTrigger id="filter-category" className="w-full">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Semua kategori</SelectItem>
                    {categoriesData.map((cat) => (
                      <SelectItem
                        key={cat._id?.toString() || cat.slug}
                        value={cat.slug}
                      >
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          <div
            className={cn(
              "space-y-2",
              type === "ARTICLES" && "sm:col-span-2",
            )}
          >
            <Label>Tanggal tayang / dibuat</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                  type="button"
                >
                  <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                  <span className="truncate">{dateRangeLabel()}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <DayPicker
                  mode="range"
                  selected={dateRange}
                  onSelect={onDateRangeSelect}
                  locale={idLocale}
                  numberOfMonths={1}
                  className="p-3"
                />
                <div className="border-t p-2 flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      pushParams(
                        { dateFrom: null, dateTo: null, page: 1 },
                        { replace: true },
                      )
                    }
                  >
                    Hapus tanggal
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-lg border border-border overflow-x-auto min-w-0">
        {type === "VIDEO" ? (
          <>
            {loading ? (
              <p className="p-8 text-center text-muted-foreground">
                Memuat video…
              </p>
            ) : videos.length === 0 ? (
              <p className="p-8 text-center text-muted-foreground">
                Tidak ada video
              </p>
            ) : (
              <div className={cn("p-4", getAdminStandardCardGridClass())}>
                {videos.map((v) => (
                  <Card key={v._id} className="overflow-hidden flex flex-col">
                    <div className="aspect-video bg-muted relative">
                      {v.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={v.thumbnailUrl}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      ) : null}
                    </div>
                    <CardHeader className="pb-2">
                      <Badge variant="secondary" className="w-fit capitalize">
                        {v.type}
                      </Badge>
                      <CardTitle className="text-base line-clamp-2 leading-snug">
                        {v.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground flex-1">
                      {formatDateTimeReadable(parseMongoDate(v.createdAt)) ||
                        "-"}
                    </CardContent>
                    <CardFooter>
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                        className="w-full"
                      >
                        <a
                          href={v.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Buka tautan
                        </a>
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </>
        ) : (
          <ListTable
            columns={columns}
            data={articleRows}
            loading={loading}
            emptyText="No articles found"
            rowKey={(row) => row._id || row.slug}
          />
        )}

        {pagination.totalPages > 1 && (
          <Pagination className="my-4 px-2 flex-wrap justify-center">
            <PaginationContent className={ADMIN_PAGINATION_WRAP}>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    if (page > 1) pushParams({ page: page - 1 });
                  }}
                  className={page <= 1 ? "pointer-events-none opacity-50" : ""}
                />
              </PaginationItem>

              {(() => {
                const { totalPages } = pagination;
                if (totalPages <= 5) {
                  return Array.from(
                    { length: totalPages },
                    (_, i) => i + 1,
                  ).map((pageNum) => (
                    <PaginationItem key={pageNum}>
                      <PaginationLink
                        href="#"
                        isActive={page === pageNum}
                        onClick={(e) => {
                          e.preventDefault();
                          if (page !== pageNum) pushParams({ page: pageNum });
                        }}
                      >
                        {pageNum}
                      </PaginationLink>
                    </PaginationItem>
                  ));
                }

                const pages: number[] = [1];
                for (let i = page - 1; i <= page + 1; i++) {
                  if (i > 1 && i < totalPages) pages.push(i);
                }
                if (!pages.includes(totalPages)) pages.push(totalPages);
                const uniquePages = Array.from(new Set(pages)).sort(
                  (a, b) => a - b,
                );

                return uniquePages
                  .map((pageNum, idx) => {
                    const prevPage = uniquePages[idx - 1];
                    if (idx > 0 && pageNum - prevPage > 1) {
                      return [
                        <PaginationItem key={`ellipsis-${pageNum}`}>
                          <PaginationEllipsis />
                        </PaginationItem>,
                        <PaginationItem key={pageNum}>
                          <PaginationLink
                            href="#"
                            isActive={page === pageNum}
                            onClick={(e) => {
                              e.preventDefault();
                              if (page !== pageNum)
                                pushParams({ page: pageNum });
                            }}
                          >
                            {pageNum}
                          </PaginationLink>
                        </PaginationItem>,
                      ];
                    }
                    return (
                      <PaginationItem key={pageNum}>
                        <PaginationLink
                          href="#"
                          isActive={page === pageNum}
                          onClick={(e) => {
                            e.preventDefault();
                            if (page !== pageNum) pushParams({ page: pageNum });
                          }}
                        >
                          {pageNum}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  })
                  .flat();
              })()}

              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    if (page < pagination.totalPages)
                      pushParams({ page: page + 1 });
                  }}
                  className={
                    page >= pagination.totalPages
                      ? "pointer-events-none opacity-50"
                      : ""
                  }
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
      </div>

      <AlertDialog
        open={!!takeDownId}
        onOpenChange={(open) => !open && setTakeDownId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Take down artikel ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini akan mengubah status artikel menjadi{" "}
              <strong>Taken Down</strong>. Artikel tidak akan lagi tampil di
              halaman publik untuk pembaca, namun datanya tetap aman di database
              dan Anda dapat memulihkannya sewaktu-waktu.
              <br />
              Apakah Anda yakin ingin melanjutkan?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleTakeDown}
              className="bg-destructive hover:bg-destructive/90 text-white"
            >
              Ya, Take Down
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={isConfirmingUpdateTags}
        onOpenChange={setIsConfirmingUpdateTags}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Perbarui Rekomendasi Tag?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini akan memindai seluruh artikel untuk memperbarui
              rekomendasi tag. Proses ini mungkin memakan waktu beberapa menit.
              <br />
              Apakah Anda yakin ingin melanjutkan?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleUpdateTags}>
              Ya, Perbarui
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ArticlesPage;
