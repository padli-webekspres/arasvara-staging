/**
 * Server-side data fetchers untuk digunakan di Server Components (Next.js App Router).
 *
 * PENTING: File ini TIDAK boleh mengimpor axios, React hooks, atau pustaka client-side lainnya.
 * Kita menggunakan `fetch()` native Node.js agar bisa berjalan di server.
 *
 * Fungsi-fungsi di sini dipakai untuk melakukan prefetching data di `page.tsx` (Server Component),
 * kemudian hasilnya di-"dehydrate" dan dikirim ke Client Component melalui `HydrationBoundary`.
 * Dengan cara ini, React Query di sisi client langsung mendapatkan data tanpa perlu fetch ulang.
 */

import { getServerApiSecret } from "@/lib/api-secret";
import { getServerApiBaseUrl } from "@/lib/server/server-api";
import { Configuration } from "@/types/configuration";
import { SectionArticleItem } from "@/types/articleSection";
import { Article } from "@/types/article";

/**
 * Fetcher generik yang menggunakan `fetch()` native dengan revalidasi Next.js.
 * @param path - Path API tanpa base URL (misal: "/configuration")
 * @param revalidateSeconds - Berapa detik data di-cache oleh Next.js (default: 60 detik)
 */
async function serverFetch<T>(
  path: string,
  revalidateSeconds = 60
): Promise<T> {
  const baseUrl = getServerApiBaseUrl();
  const url = `${baseUrl}${path}`;

  const headers: Record<string, string> = {};
  const secret = getServerApiSecret();
  if (secret) {
    headers["x-api-secret"] = secret;
  }

  const res = await fetch(url, {
    headers,
    // Next.js Incremental Static Regeneration (ISR) — data di-cache di server
    next: { revalidate: revalidateSeconds },
  });

  if (!res.ok) {
    throw new Error(
      `Server fetch gagal untuk "${url}": ${res.status} ${res.statusText}`
    );
  }

  return res.json() as Promise<T>;
}

// ─── Fungsi Fetcher Publik ────────────────────────────────────────────────────

/**
 * Mengambil semua data konfigurasi situs.
 * Dipakai untuk prefetch query key: ["configuration", "all"]
 */
export async function fetchConfigurationsServer(): Promise<Configuration[]> {
  return serverFetch<Configuration[]>("/configuration", 600); // cache 10 menit
}

/**
 * Mengambil daftar artikel headline.
 * Dipakai untuk prefetch query key: ["headline-articles-carousel"]
 */
export async function fetchHeadlineArticlesServer(): Promise<
  SectionArticleItem[]
> {
  const res = await serverFetch<{ data: SectionArticleItem[] }>(
    "/articles/headline",
    300 // cache 5 menit
  );
  return res.data;
}

/**
 * Mengambil halaman pertama dari artikel terbaru (untuk infinite query).
 * Dipakai untuk prefetch query key: ["latest", 9]
 */
export async function fetchLatestArticlesServer(): Promise<{
  articles: Article[];
  nextCursor: string | null;
}> {
  return serverFetch<{ articles: Article[]; nextCursor: string | null }>(
    "/articles?limit=9&status=PUBLISHED",
    120 // cache 2 menit (konten berita lebih sering berubah)
  );
}
