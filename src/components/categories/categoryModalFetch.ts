import { fetcher } from "@/lib/fetcher";
import type { CategoryListResult, CategoryWithParent } from "@/types/category";

/** Ambil seluruh halaman hasil GET `/categories` (modal navbar & seed draf). */
export async function fetchAllCategoriesPages(params: {
  onlyShowOnNavbar?: boolean;
  onlyFeatured?: boolean;
  search?: string;
  sortBy?: "order" | "featuredOrder" | "name";
}): Promise<CategoryWithParent[]> {
  const PAGE_LIMIT = 200;
  let page = 1;
  const out: CategoryWithParent[] = [];
  for (;;) {
    const sort = params.sortBy || "order";
    let url = `/categories?limit=${PAGE_LIMIT}&page=${page}&sortBy=${sort}`;
    if (params.onlyShowOnNavbar) url += "&onlyShowOnNavbar=true";
    if (params.onlyFeatured) url += "&onlyFeatured=true";
    if (params.search?.trim())
      url += `&search=${encodeURIComponent(params.search.trim())}`;
    const res = await fetcher<CategoryListResult>(url);
    out.push(...res.categories);
    if (page >= res.pagination.totalPages) break;
    page += 1;
    if (page > 400) break;
  }
  return out;
}
