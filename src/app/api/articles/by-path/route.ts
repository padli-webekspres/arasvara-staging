import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/db";
import { getArticleRevalidateSeconds } from "@/lib/cache/article-cache-config";
import { isValidArticlePublicPath } from "@/lib/article-public-path";
import { splitContentByPageBreak } from "@/lib/utils";
import {
  getPublishedArticleByPublicPath,
  getRelatedArticles,
} from "@/services/article/getArticleService";
import type { ArticleListResponse } from "@/types/article";

export async function GET(req: NextRequest) {
  try {
    const publicPath = req.nextUrl.searchParams.get("publicPath")?.trim();
    if (!publicPath || !isValidArticlePublicPath(publicPath)) {
      return NextResponse.json(
        { error: "Invalid or missing publicPath" },
        { status: 400 },
      );
    }

    const pageParam = req.nextUrl.searchParams.get("page");
    const db = await connectToDatabase();
    const article = await getPublishedArticleByPublicPath(db, publicPath);

    if (!article) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    let totalPages = 1;
    if (article.content) {
      const pages = splitContentByPageBreak(article.content);
      totalPages = pages.length;

      if (pageParam === "all") {
        article.content = pages.join("<br/><br/>");
      } else if (pageParam) {
        const pageNum = Math.max(1, parseInt(pageParam) || 1);
        const pageIndex = Math.min(pageNum - 1, totalPages - 1);
        article.content = pages[pageIndex] ?? article.content;
      }
    }

    let related: ArticleListResponse[] = [];
    try {
      if (article._id) {
        related = await getRelatedArticles(db, article._id);
      }
    } catch {
      related = [];
    }

    return NextResponse.json(
      { article, related, totalPages },
      {
        headers:
          !req.headers.get("cookie")?.includes("access_token")
            ? {
                "Cache-Control": `s-maxage=${getArticleRevalidateSeconds()}, stale-while-revalidate=600`,
              }
            : undefined,
      },
    );
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Internal server error" },
      { status: 500 },
    );
  }
}
