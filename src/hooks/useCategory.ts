import { useQuery } from "@tanstack/react-query";
import { Category } from "@/types/category";
import api from "@/lib/axios";

type CategoriesListFetchOptions = {
  isRoot?: boolean;
  /** Hanya kategori dengan showOnNavbar === true */
  onlyShowOnNavbar?: boolean;
  limit?: number;
};

const fetchCategoriesList = async (opts: CategoriesListFetchOptions = {}) => {
  const params: Record<string, any> = {
    limit: opts.limit ?? 100,
  };
  if (opts.isRoot) params.isRoot = "true";
  if (opts.onlyShowOnNavbar) params.onlyShowOnNavbar = "true";

  const res = await api.get<{ categories: Category[] }>("/categories", { params });
  const json = res.data;
  return Array.isArray(json.categories) ? json.categories : [];
};

// =======================================================
// KELOMPOK 1: Kategori Keseluruhan (Berbagi Cache yang sama)
// =======================================================

export function useCategories() {
  return useQuery({
    queryKey: ["categories", "all"],
    // Limit 500 agar daftar kategori (termasuk subchannel) tidak terpotong
    queryFn: () => fetchCategoriesList({ limit: 500 }),
    staleTime: 1000 * 60 * 60, // 1 jam
  });
}

export function useCategoryOptions() {
  return useQuery({
    queryKey: ["categories", "all"],
    queryFn: () => fetchCategoriesList({}),
    staleTime: 1000 * 60 * 60,
    select: (data) => {
      return data.map((cat: Category) => ({
        label: cat.name,
        value: String(cat.slug || cat._id || ""),
      }));
    },
  });
}

// =======================================================
// Masthead: hanya kategori yang ditandai tampil di navbar
// =======================================================

export function useCategoriesNavbar() {
  return useQuery({
    queryKey: ["categories", "navbar", { onlyShowOnNavbar: true }],
    queryFn: () =>
      fetchCategoriesList({ onlyShowOnNavbar: true, limit: 100 }),
    staleTime: 1000 * 60 * 60,
  });
}


// use root categories
export function useRootCategories() {
  return useQuery({
    queryKey: ["categories", "root"],
    queryFn: () => fetchCategoriesList({ isRoot: true, limit: 100 }),
    staleTime: 1000 * 60 * 60,
  });
}