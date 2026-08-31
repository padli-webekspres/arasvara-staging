import type { Article } from "@/types/article";
import type { Category } from "@/types/category";
import { buildAbsoluteUrl, getSiteBaseUrl } from "@/lib/og-image";
import { buildArticleUrl } from "@/lib/utils";

export type BreadcrumbListJsonLd = {
  "@context": "https://schema.org";
  "@type": "BreadcrumbList";
  itemListElement: Array<{
    "@type": "ListItem";
    position: number;
    name: string;
    item: string;
  }>;
};

/**
 * Build BreadcrumbList JSON-LD for article pages.
 * Pattern: Home → Category → Article
 */
export function buildBreadcrumbJsonLd(
  category: Category,
  article: Article
): BreadcrumbListJsonLd {
  const baseUrl = getSiteBaseUrl();
  
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: baseUrl,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: category.name,
        item: buildAbsoluteUrl(`/${category.slug}`, baseUrl),
      },
      {
        "@type": "ListItem",
        position: 3,
        name: article.title,
        item: article.publicPath ? buildArticleUrl(article.publicPath) : baseUrl,
      },
    ],
  };
}
