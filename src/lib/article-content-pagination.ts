export type ArticleContentView = {
  isShowAll: boolean;
  pageNum: number;
};

/** Hanya `true` (trim, case-insensitive) yang mengaktifkan pecahan isi artikel. */
export function isArticleContentPaginationEnabled(
  value: string | undefined = process.env.ARTICLE_CONTENT_PAGINATION,
): boolean {
  return value?.trim().toLowerCase() === "true";
}

function parseNumericPage(pageParam: string | null): number | null {
  if (pageParam === null || pageParam === "all") return null;
  const trimmed = pageParam.trim();
  if (!trimmed) return null;
  const parsed = parseInt(trimmed, 10);
  if (!Number.isFinite(parsed) || parsed < 1 || String(parsed) !== trimmed) {
    return null;
  }
  return parsed;
}

/**
 * Default tanpa query `page`: flag on → halaman 1; flag off → seluruh artikel.
 * `?page=all` selalu tampilkan semua. Angka ≥ 1 memotong ke halaman itu.
 */
export function resolveArticleContentView(
  pageParam: string | null,
  paginationEnabled: boolean,
): ArticleContentView {
  if (pageParam === "all") {
    return { isShowAll: true, pageNum: 1 };
  }

  const numeric = parseNumericPage(pageParam);
  if (numeric !== null) {
    return { isShowAll: false, pageNum: numeric };
  }

  if (paginationEnabled) {
    return { isShowAll: false, pageNum: 1 };
  }

  return { isShowAll: true, pageNum: 1 };
}

/**
 * Query string berikutnya saat user pindah halaman.
 * Flag off: halaman 1 tetap `?page=1` agar tidak kembali ke tampilan semua;
 * "Tampilkan Semua" menghapus `page` (URL bersih).
 */
export function nextArticlePageQuery(
  searchParams: { toString(): string },
  page: number | "all",
  paginationEnabled: boolean,
): string {
  const params = new URLSearchParams(searchParams.toString());

  if (page === "all") {
    if (paginationEnabled) {
      params.set("page", "all");
    } else {
      params.delete("page");
    }
  } else if (!paginationEnabled || page > 1) {
    params.set("page", String(page));
  } else {
    params.delete("page");
  }

  return params.toString();
}
