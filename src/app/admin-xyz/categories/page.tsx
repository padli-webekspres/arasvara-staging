"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Edit, Eye, Plus, Trash2, ListOrdered } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import type {
  CategoryWithParent,
  CategoryListResult,
  CategorySingleResult,
} from "@/types/category";
import { fetcher } from "@/lib/fetcher";
import axios from "@/lib/axios";
import { ADMIN_PAGINATION_WRAP } from "@/lib/admin-ui";
import { ListTable, ListTableColumn } from "@/components/table/ListTable";
import { getPageNumbers } from "@/lib/utils";
import CategoryFormDialog from "@/components/categories/CategoryFormDialog";
import NavbarCategoriesOrderModal from "@/components/categories/NavbarCategoriesOrderModal";
import type { NavbarCategorySortItem } from "@/components/categories/navbarOrderPayload";
import FeaturedCategoriesOrderModal from "@/components/categories/FeaturedCategoriesOrderModal";
import type { FeaturedCategorySortItem } from "@/components/categories/featuredOrderPayload";

const LIMIT = 10;

const CATEGORY_MODAL_QUERY = {
  create: "tambah",
  editKey: "ubah",
} as const;

type CategoryFormModalState =
  | { mode: "create" }
  | { mode: "edit"; categoryId: string };

export default function CategoriesPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [isRoot, setIsRoot] = useState(false);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<CategoryListResult | null>(null);
  const [selectedCategory, setSelectedCategory] =
    useState<CategorySingleResult | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [categoryModal, setCategoryModal] =
    useState<CategoryFormModalState | null>(null);
  const [navbarOrderModalOpen, setNavbarOrderModalOpen] = useState(false);
  const [navbarDraft, setNavbarDraft] = useState<NavbarCategorySortItem[]>(
    [],
  );
  const [featuredOrderModalOpen, setFeaturedOrderModalOpen] = useState(false);
  const [featuredDraft, setFeaturedDraft] = useState<FeaturedCategorySortItem[]>(
    [],
  );
  const [, startTransition] = useTransition();

  const reloadCategoriesTable = useCallback(() => {
    let url = `/categories?limit=${LIMIT}&page=${page}&sortBy=order`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (isRoot) url += `&isRoot=true`;
    setData(null);
    fetcher<CategoryListResult>(url).then(setData);
  }, [page, search, isRoot]);

  /** Hapus query pembuka modal agar refresh tidak membuka lagi */
  const stripCategoryFormQuery = useCallback(() => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.delete(CATEGORY_MODAL_QUERY.create);
    sp.delete(CATEGORY_MODAL_QUERY.editKey);
    const q = sp.toString();
    startTransition(() => {
      router.replace(q ? `${pathname}?${q}` : pathname);
    });
  }, [pathname, router, searchParams, startTransition]);

  useEffect(() => {
    const pageParam = parseInt(searchParams.get("page") || "1", 10);
    setPage(pageParam);
    setSearch(searchParams.get("search") || "");
    setIsRoot(searchParams.get("isRoot") === "true");
  }, [searchParams]);

  /** Deep link: …?tambah=1 atau …?ubah=<slug|id> (misal dari redirect rute lama) */
  useEffect(() => {
    const tambah = searchParams.get(CATEGORY_MODAL_QUERY.create);
    const ubah = searchParams.get(CATEGORY_MODAL_QUERY.editKey)?.trim();
    if (tambah === "1") {
      setCategoryModal({ mode: "create" });
      stripCategoryFormQuery();
      return;
    }
    if (ubah) {
      setCategoryModal({ mode: "edit", categoryId: ubah });
      stripCategoryFormQuery();
    }
  }, [searchParams, stripCategoryFormQuery]);

  useEffect(() => {
    let url = `/categories?limit=${LIMIT}&page=${page}&sortBy=order`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (isRoot) url += `&isRoot=true`;
    setData(null);
    fetcher<CategoryListResult>(url).then(setData);
  }, [page, search, isRoot]);

  const updateParams = (params: Record<string, string | number | boolean>) => {
    const sp = new URLSearchParams(searchParams.toString());
    Object.entries(params).forEach(([k, v]) => {
      if (v === "" || v === false || v == null) sp.delete(k);
      else sp.set(k, String(v));
    });
    startTransition(() => {
      router.push(`?${sp.toString()}`);
    });
  };

  const handleView = async (idOrSlug: string) => {
    setViewDialogOpen(true);
    setViewLoading(true);
    setSelectedCategory(null);
    try {
      const { data: res } = await axios.get(`/categories/${idOrSlug}`);
      setSelectedCategory(res);
    } catch {
      setSelectedCategory(null);
    } finally {
      setViewLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleteLoading(true);
    setDeleteError("");
    try {
      await axios.delete(`/categories/${deleteId}`);
      toast.success("Kategori berhasil dihapus.");
      setDeleteId(null);
      let url = `/categories?limit=${LIMIT}&page=${page}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (isRoot) url += `&isRoot=true`;
      setData(null);
      fetcher<CategoryListResult>(url).then(setData);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      const msg =
        err?.response?.data?.message ||
        (e instanceof Error ? e.message : "") ||
        "Gagal menghapus kategori.";
      setDeleteError(msg);
      toast.error(msg);
    } finally {
      setDeleteLoading(false);
    }
  };

  const columns: ListTableColumn<CategoryWithParent>[] = [
    {
      key: "name",
      header: "Nama",
      render: (row) => (
        <div className="max-w-xs">
          <p className="font-medium">{row.name}</p>
        </div>
      ),
    },
    {
      key: "nickname",
      header: "Nama panggilan (navbar)",
      render: (row) => (
        <span className="text-muted-foreground">
          {row.nickname?.trim() ? row.nickname.trim() : "—"}
        </span>
      ),
    },
    {
      key: "parent",
      header: "Kategori induk",
      render: (row) => (row.parent ? row.parent.name : "—"),
    },
    {
      key: "showOnNavbar",
      header: "Navbar",
      render: (row) => (
        <span
          className={
            row.showOnNavbar
              ? "font-semibold text-green-600"
              : "text-muted-foreground"
          }
        >
          {row.showOnNavbar ? "Ya" : "Tidak"}
        </span>
      ),
    },
    {
      key: "featured",
      header: "Unggulkan",
      render: (row) => (
        <span
          className={
            row.featured
              ? "font-semibold text-green-600"
              : "text-muted-foreground"
          }
        >
          {row.featured ? "Ya" : "Tidak"}
        </span>
      ),
    },
    {
      key: "actions",
      header: <span className="float-right">Aksi</span>,
      render: (row) => (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="icon"
            type="button"
            title="Lihat ringkas"
            aria-label="Lihat ringkas"
            onClick={() => handleView(row._id as string)}
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            type="button"
            title="Ubah kategori"
            aria-label="Ubah kategori"
            onClick={() =>
              setCategoryModal({
                mode: "edit",
                categoryId: String(row.slug),
              })
            }
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            type="button"
            title="Hapus"
            aria-label="Hapus"
            onClick={() => setDeleteId(row._id as string)}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
      className: "text-right p-4",
    },
  ];

  return (
    <div className="min-w-0 max-w-full space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Kategori</h1>
          <p className="text-muted-foreground">
            Kelola kanal dan hierarki kategori
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setNavbarOrderModalOpen(true)}
          >
            <ListOrdered className="mr-2 h-4 w-4 shrink-0" />
            Urutan navbar
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setFeaturedOrderModalOpen(true)}
          >
            <ListOrdered className="mr-2 h-4 w-4 shrink-0" />
            Urutan unggulan
          </Button>
          <Button
            type="button"
            onClick={() => setCategoryModal({ mode: "create" })}
          >
            <Plus className="mr-2 h-4 w-4 shrink-0" />
            Kategori baru
          </Button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Input
            placeholder="Cari nama atau slug…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              updateParams({ search: e.target.value, page: 1 });
            }}
            className="pl-10"
            aria-label="Cari kategori"
          />
        </div>
        <select
          className="w-full md:w-56 border rounded-md px-3 py-2 bg-background text-sm"
          value={isRoot ? "true" : "false"}
          onChange={(e) => {
            setIsRoot(e.target.value === "true");
            updateParams({ isRoot: e.target.value === "true", page: 1 });
          }}
          aria-label="Filter jenis kategori"
        >
          <option value="false">Semua kategori</option>
          <option value="true">Hanya kategori akar</option>
        </select>
      </div>

      <div className="bg-card rounded-lg border border-border overflow-x-auto min-w-0">
        <ListTable
          columns={columns}
          data={data ? data.categories : []}
          loading={!data}
          emptyText="Belum ada kategori."
          rowKey={(row) => String(row.slug)}
        />
        {data && data.pagination.totalPages > 1 && (
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
              {getPageNumbers(page, data.pagination.totalPages).map((num) => (
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
              ))}
              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    if (page < data.pagination.totalPages)
                      updateParams({ page: page + 1 });
                  }}
                  className={
                    page >= data.pagination.totalPages
                      ? "pointer-events-none opacity-50"
                      : ""
                  }
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
      </div>

      <Dialog
        open={viewDialogOpen}
        onOpenChange={(open) => {
          setViewDialogOpen(open);
          if (!open) setSelectedCategory(null);
        }}
      >
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>
              {viewLoading
                ? "Memuat…"
                : selectedCategory
                  ? selectedCategory.name
                  : "Kategori tidak ditemukan"}
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-1 text-left">
                {viewLoading ? (
                  <span className="text-muted-foreground">Mengambil data…</span>
                ) : selectedCategory ? (
                  <>
                    <p>
                      <span className="text-muted-foreground">Slug — </span>
                      <span className="font-mono text-sm">
                        {selectedCategory.slug}
                      </span>
                    </p>
                    {selectedCategory.nickname?.trim() ? (
                      <p>
                        <span className="text-muted-foreground">
                          Nama panggilan —{" "}
                        </span>
                        {selectedCategory.nickname.trim()}
                      </p>
                    ) : null}
                    {selectedCategory.description ? (
                      <p className="text-sm text-muted-foreground pt-1">
                        {selectedCategory.description}
                      </p>
                    ) : null}
                  </>
                ) : (
                  <span className="text-muted-foreground">
                    Data tidak ditemukan.
                  </span>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>
          {!viewLoading && selectedCategory && (
            <div className="flex flex-col gap-4 mt-4">
              <Card className="mx-auto w-full bg-sidebar">
                <CardHeader className="pb-2">
                  <CardTitle>Total artikel</CardTitle>
                  <CardDescription>
                    Artikel yang memakai kategori ini
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col sm:flex-row sm:items-end gap-2">
                    <span className="text-5xl font-bold">
                      {selectedCategory.totalArticles}
                    </span>
                    <span className="text-sm text-muted-foreground ml-2 mb-1">
                      artikel
                    </span>
                  </div>
                </CardContent>
              </Card>
              <Card className="mx-auto w-full bg-sidebar">
                <CardHeader className="pb-2">
                  <CardTitle>Jumlah tayangan</CardTitle>
                  <CardDescription>
                    Akumulasi view artikel di kategori ini
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col sm:flex-row sm:items-end gap-2">
                    <span className="text-5xl font-bold">
                      {selectedCategory.totalViews}
                    </span>
                    <span className="text-sm text-muted-foreground ml-2 mb-1">
                      view
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <NavbarCategoriesOrderModal
        open={navbarOrderModalOpen}
        onOpenChange={setNavbarOrderModalOpen}
        navbarItems={navbarDraft}
        onNavbarItemsChange={setNavbarDraft}
        onSaveSuccess={reloadCategoriesTable}
      />

      <FeaturedCategoriesOrderModal
        open={featuredOrderModalOpen}
        onOpenChange={setFeaturedOrderModalOpen}
        featuredItems={featuredDraft}
        onFeaturedItemsChange={setFeaturedDraft}
        onSaveSuccess={reloadCategoriesTable}
      />

      <CategoryFormDialog
        key={
          categoryModal === null
            ? "category-form-closed"
            : categoryModal.mode === "edit"
              ? `edit-${categoryModal.categoryId}`
              : "create"
        }
        open={categoryModal !== null}
        onOpenChange={(open) => {
          if (!open) setCategoryModal(null);
        }}
        mode={categoryModal?.mode ?? "create"}
        categoryId={
          categoryModal?.mode === "edit" ? categoryModal.categoryId : undefined
        }
        onSuccess={reloadCategoriesTable}
      />

      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteId(null);
            setDeleteError("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus kategori?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini tidak dapat dibatalkan. Pastikan tidak ada artikel
              yang masih bergantung pada kategori ini.
            </AlertDialogDescription>
            {deleteError && (
              <p className="text-destructive text-sm mt-2">{deleteError}</p>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground"
              disabled={deleteLoading}
            >
              {deleteLoading ? "Menghapus…" : "Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
