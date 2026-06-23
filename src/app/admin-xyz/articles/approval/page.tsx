"use client";

import { useState, useEffect, useCallback, useTransition, useRef } from "react";
import { isApproverRole } from "@/lib/auth-client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, Search, Clock, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { ADMIN_PAGINATION_WRAP } from "@/lib/admin-ui";
import { ListTable, ListTableColumn } from "@/components/table/ListTable";
import { Article } from "@/types/article";
import { Category } from "@/types/category";
import api from "@/lib/axios";
import { formatDateReadable, getPageNumbers } from "@/lib/utils";
import { adminPanelHref } from "@/lib/admin-panel-path";

interface StatusConfig {
  [key: string]: {
    variant: "default" | "secondary" | "outline" | "destructive";
    icon: React.ElementType;
    label: string;
  };
}

export default function ApprovalArticlesPage() {
  const { data: user, isLoading: userLoading } = useCurrentUser();
  const role = user?.role || null;
  const isApprover = isApproverRole(role);
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialSearch = searchParams.get("search") || "";
  const initialCategory = searchParams.get("category") || "all";
  const initialPage = Number.parseInt(searchParams.get("page") || "1", 10);

  const [articles, setArticles] = useState<Article[]>([]);
  const [categoriesData, setCategoriesData] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);
  const [category, setCategory] = useState(initialCategory);
  const [page, setPage] = useState(
    Number.isFinite(initialPage) ? initialPage : 1,
  );
  const [pagination, setPagination] = useState({
    page: 1,
    totalPages: 1,
    total: 0,
    limit: 10,
  });
  const [, startTransition] = useTransition();

  const updateParams = useCallback(
    (params: Record<string, string | number | boolean>) => {
      const sp = new URLSearchParams(searchParams.toString());
      Object.entries(params).forEach(([key, value]) => {
        if (
          value === "" ||
          value === false ||
          value == null ||
          value === "all"
        ) {
          sp.delete(key);
        } else {
          sp.set(key, String(value));
        }
      });

      const nextPage =
        typeof params.page === "number"
          ? Number(params.page)
          : Number(sp.get("page") || 1);
      setPage(Number.isFinite(nextPage) && nextPage > 0 ? nextPage : 1);

      startTransition(() => {
        router.push(`?${sp.toString()}`);
      });
    },
    [router, searchParams, startTransition],
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

  const fetchApprovalQueue = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/articles/approval?limit=${pagination.limit}&page=${page}`;
      if (debouncedSearch)
        url += `&search=${encodeURIComponent(debouncedSearch)}`;
      if (category && category !== "all") {
        url += `&category=${encodeURIComponent(category)}`;
      }

      // Tidak perlu kirim role/authorId, backend sudah handle dari session
      const { data } = await api.get(url);
      setArticles(data.articles || []);
      setPagination((prev) => ({
        ...prev,
        page,
        totalPages: data.totalPages || 1,
        total: data.total || (data.articles ? data.articles.length : 0),
      }));
    } catch {
      setArticles([]);
      setPagination((prev) => ({ ...prev, page: 1, totalPages: 1, total: 0 }));
    } finally {
      setLoading(false);
    }
  }, [category, page, pagination.limit, debouncedSearch]);

  useEffect(() => {
    fetchApprovalQueue();
  }, [fetchApprovalQueue]);

  // Debounce search input
  useEffect(() => {
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }
    debounceTimeout.current = setTimeout(() => {
      setDebouncedSearch(search);
      updateParams({ search, page: 1 });
    }, 1000);
    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
    };
  }, [search]);

  const getStatusBadge = (articleStatus: string) => {
    const statusConfig: StatusConfig = {
      PENDING_REVIEW: {
        variant: "outline",
        icon: Clock,
        label: "Pending Review",
      },
      APPROVED: {
        variant: "default",
        icon: CheckCircle,
        label: "Approved",
      },
    };

    const config = statusConfig[articleStatus] || statusConfig.PENDING_REVIEW;
    return (
      <Badge variant={config.variant} className="capitalize">
        <config.icon className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
    );
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
      header: "Category",
      className: "hidden md:table-cell",
      render: (row) => (
        <span className="capitalize">{row.category?.name || "-"}</span>
      ),
    },
    {
      key: "submittedAt",
      header: "Disubmit Pada",
      className: "hidden lg:table-cell",
      render: (row) =>
        row.updatedAt ? formatDateReadable(row.updatedAt.toString()) : "-",
    },
    // Writer column only for approver
    ...(isApprover
      ? [
          {
            key: "writer",
            header: "Writer",
            render: (row: Article) => row.author?.name || "-",
          },
        ]
      : []),
    {
      key: "status",
      header: "Status",
      render: (row) => getStatusBadge(row.status),
    },
    {
      key: "actions",
      header: <span className="float-right">Actions</span>,
      className: "text-right p-4 font-medium",
      render: (row) => (
        <div className="flex items-center justify-end gap-2">
          <Link href={adminPanelHref(`articles/${row.slug || row._id}/approval`)}>
            <Button variant="ghost" size="icon">
              <Eye className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      ),
    },
  ];

  return (
    <div className="min-w-0 max-w-full space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Approval Queue</h1>
          <p className="text-muted-foreground">
            Artikel yang menunggu proses approval dan publikasi
          </p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search articles..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
            }}
            className="pl-10"
          />
        </div>

        <Select
          value={category}
          onValueChange={(value) => {
            setCategory(value);
            updateParams({ category: value, page: 1 });
          }}
        >
          <SelectTrigger className="w-full md:w-56">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
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

      <div className="bg-card rounded-lg border border-border overflow-x-auto min-w-0">
        <ListTable
          columns={columns}
          data={articles}
          loading={loading}
          emptyText="No approval queue articles found"
          rowKey={(row) => row._id || row.slug}
        />

        {pagination.totalPages > 1 && (
          <Pagination className="my-4 flex-wrap justify-center">
            <PaginationContent className={ADMIN_PAGINATION_WRAP}>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    if (page > 1) updateParams({ page: page - 1 });
                  }}
                  className={page <= 1 ? "pointer-events-none opacity-50" : ""}
                />
              </PaginationItem>

              {getPageNumbers(page, pagination.totalPages).map((num, idx) =>
                num === "..." ? (
                  <PaginationItem key={`ellipsis-${idx}`}>
                    <PaginationEllipsis />
                  </PaginationItem>
                ) : (
                  <PaginationItem key={num}>
                    <PaginationLink
                      href="#"
                      isActive={page === num}
                      onClick={(e) => {
                        e.preventDefault();
                        if (page !== num) updateParams({ page: num });
                      }}
                    >
                      {num}
                    </PaginationLink>
                  </PaginationItem>
                ),
              )}

              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    if (page < pagination.totalPages) {
                      updateParams({ page: page + 1 });
                    }
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
    </div>
  );
}
