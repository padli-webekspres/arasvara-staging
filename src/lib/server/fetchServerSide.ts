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
import { connectToDatabase } from "@/lib/db/db";
import { getAllConfiguration } from "@/services/configurationService";
import { Configuration } from "@/types/configuration";
import { SectionArticleItem } from "@/types/articleSection";
import { Article, ArticleListPage } from "@/types/article";
import {
  ARTICLE_LISTING_CACHE_TAG,
  getArticleRevalidateSeconds,
} from "@/lib/cache/article-cache-config";
import { buildFooterNap, type FooterNap } from "@/lib/contact-display";
import {
  footerViewPropsFromConfigs,
  type FooterViewProps,
} from "@/lib/footer-view-props";

/**
 * Fetcher generik yang menggunakan `fetch()` native dengan revalidasi Next.js.
 * @param path - Path API tanpa base URL (misal: "/configuration")
 * @param revalidateSeconds - Berapa detik data di-cache oleh Next.js
 * @param tags - Cache tag Next.js untuk invalidasi on-demand
 */
async function serverFetch<T>(
  path: string,
  revalidateSeconds = 60,
  tags?: string[],
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
    next: {
      revalidate: revalidateSeconds,
      ...(tags && tags.length > 0 ? { tags } : {}),
    },
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
  return serverFetch<Configuration[]>(
    "/configuration",
    getArticleRevalidateSeconds(),
  );
}

function configString(
  configs: Configuration[],
  key: string,
): string {
  const item = configs.find((c) => c.key === key);
  if (item?.value == null) return "";
  if (typeof item.value === "string") return item.value;
  if (typeof item.value === "number" || typeof item.value === "boolean") {
    return String(item.value);
  }
  return "";
}

export function footerNapFromConfigs(
  configs: Configuration[],
): FooterNap | null {
  return buildFooterNap(
    configString(configs, "address_text"),
    configString(configs, "contact_phone"),
  );
}

/** NAP Footer dari DB langsung — hindari self-fetch HTTP di layout (sering gagal diam-diam). */
export async function getFooterNap(): Promise<FooterNap | null> {
  try {
    const db = await connectToDatabase();
    const raw = await getAllConfiguration(db, [
      "address_text",
      "contact_phone",
    ]);
    const configs = Array.isArray(raw) ? raw : raw ? [raw] : [];
    return footerNapFromConfigs(configs);
  } catch {
    return null;
  }
}

const FOOTER_VIEW_CONFIG_KEYS = [
  "copyright_text",
  "social_instagram_link",
  "social_twitter_link",
  "social_facebook_link",
  "social_threads_link",
  "whatsapp_channel",
  "telegram_group",
];

/** Props FooterView dari DB langsung — hindari self-fetch HTTP di layout publik. */
export async function getFooterViewPropsFromDb(): Promise<FooterViewProps> {
  try {
    const db = await connectToDatabase();
    const raw = await getAllConfiguration(db, FOOTER_VIEW_CONFIG_KEYS);
    const configs = Array.isArray(raw) ? raw : raw ? [raw] : [];
    return footerViewPropsFromConfigs(configs);
  } catch {
    return footerViewPropsFromConfigs([]);
  }
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
    getArticleRevalidateSeconds(),
    [ARTICLE_LISTING_CACHE_TAG],
  );
  return res.data;
}

/**
 * Mengambil halaman pertama dari artikel terbaru (untuk infinite query).
 * Dipakai untuk prefetch query key: ["latest", 9]
 */
export async function fetchLatestArticlesServer(): Promise<
  ArticleListPage<Article>
> {
  return serverFetch<ArticleListPage<Article>>(
    "/articles?limit=9&status=PUBLISHED",
    getArticleRevalidateSeconds(),
    [ARTICLE_LISTING_CACHE_TAG],
  );
}
