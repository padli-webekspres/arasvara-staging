import type { Article } from "@/types/article";
import { buildArticleNewsArticleJsonLd } from "@/lib/article-json-ld";

type ArticleJsonLdProps = {
  article: Article;
  shareUrl: string;
};

/** Server component: satu blok NewsArticle JSON-LD (hindari duplikat di client). */
export default function ArticleJsonLd({ article, shareUrl }: ArticleJsonLdProps) {
  const jsonLd = buildArticleNewsArticleJsonLd(article, shareUrl);
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(jsonLd),
      }}
    />
  );
}
