import { useEffect, useMemo, useRef } from "react";
import { trackArticleView } from "@/lib/google-analytics";
import { Article } from "@/types/article";

export function useArticleTracking(article: Article, pageNum: number | "all") {
  const trackedArticleRef = useRef<string | null>(null);
  const trackedPageRef = useRef<string | number | null>(null);

  const tagKey = useMemo(
    () => (article.tags ?? []).map((t) => t.slug || t.name).join("|"),
    [article.tags],
  );

  const articleId = article._id ? String(article._id) : "";

  useEffect(() => {
    if (!articleId) return;

    if (
      trackedArticleRef.current === articleId &&
      trackedPageRef.current === pageNum
    ) {
      return;
    }

    trackArticleView(article, pageNum);

    trackedArticleRef.current = articleId;
    trackedPageRef.current = pageNum;
  }, [
    article,
    articleId,
    article.slug,
    article.title,
    article.authorId,
    article.author?.name,
    article.categoryId,
    article.category?.name,
    article.category?.slug,
    article.format,
    tagKey,
    article.isBreaking,
    article.isHeadline,
    pageNum,
  ]);
}
