/**
 * Helper untuk nanti ketika backend bulk PATCH siap:
 * satu array terurut kiri → modal = kategori dengan showOnNavbar true + urutan.
 */

import type { CategoryWithParent } from "@/types/category";

/** Maksimal kategori yang ditampilkan di navbar (masthead kiri + kanan). */
export const MAX_NAVBAR_CATEGORIES = 6;

export type NavbarCategorySortItem = {
  _id: string;
  name: string;
  slug: string;
  nickname?: string;
};

export type NavbarBulkUpdateRow = {
  categoryId: string;
  showOnNavbar: boolean;
  order: number;
};

export function categoryToNavbarSortItem(
  c: Pick<CategoryWithParent, "_id" | "name" | "slug" | "nickname">,
): NavbarCategorySortItem | null {
  if (c._id == null || c._id === "") return null;
  return {
    _id: String(c._id),
    name: c.name,
    slug: c.slug,
    nickname: c.nickname,
  };
}

/** Indeks DaDnD kiri → `order` 1-based untuk item navbar. */
export function buildNavbarBulkPayload(
  orderedNavbarCategories: NavbarCategorySortItem[],
): NavbarBulkUpdateRow[] {
  return orderedNavbarCategories.map((c, i) => ({
    categoryId: c._id,
    showOnNavbar: true,
    order: i + 1,
  }));
}
