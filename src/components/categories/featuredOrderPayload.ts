import type { CategoryWithParent } from "@/types/category";

export type FeaturedCategorySortItem = {
  _id: string;
  name: string;
  slug: string;
  nickname?: string;
};

export type FeaturedBulkUpdateRow = {
  categoryId: string;
  featured: boolean;
  featuredOrder: number;
};

export function categoryToFeaturedSortItem(
  c: Pick<CategoryWithParent, "_id" | "name" | "slug" | "nickname">,
): FeaturedCategorySortItem | null {
  if (c._id == null || c._id === "") return null;
  return {
    _id: String(c._id),
    name: c.name,
    slug: c.slug,
    nickname: c.nickname,
  };
}

/** Indeks DnD kiri → `featuredOrder` 1-based untuk item unggulan. */
export function buildFeaturedBulkPayload(
  orderedFeaturedCategories: FeaturedCategorySortItem[],
): FeaturedBulkUpdateRow[] {
  return orderedFeaturedCategories.map((c, i) => ({
    categoryId: c._id,
    featured: true,
    featuredOrder: i + 1,
  }));
}
