import type { Article } from "@/types/article";
import { buildArticleNewsArticleJsonLd } from "@/lib/article-json-ld";
import { buildBreadcrumbJsonLd } from "@/lib/breadcrumb-json-ld";

type ArticleJsonLdProps = {
  article: Article;
  shareUrl: string;
};

/** Server component: satu blok NewsArticle JSON-LD (hindari duplikat di client). */
export default function ArticleJsonLd({ article, shareUrl }: ArticleJsonLdProps) {
  const newsArticleSchema = buildArticleNewsArticleJsonLd(article, shareUrl);
  const breadcrumbSchema = buildBreadcrumbJsonLd(article.category, article);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(newsArticleSchema),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbSchema),
        }}
      />
    </>
  );
}
