import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/db";
import { canViewArticleDetail } from "@/lib/articleViewAccess";
import { getUserFromRequest } from "@/lib/auth";
import { Article } from "@/types/article";

// Helper: check if user can edit/delete article
import type { UserProfile } from "@/types/user";
import type {
  ArticleListResponse,
  Article as ArticleType,
} from "@/types/article";
import type { SectionArticleItem } from "@/types/articleSection";
import {
  deleteArticle,
  updateArticle,
} from "@/services/article/coreWriteArticleService";
import {
  getArticleByIdOrSlug,
  getArticlesByCategoryIdOrSlug,
  getRelatedArticles,
} from "@/services/article/getArticleService";
import { hasPermission } from "@/lib/auth-client";
import { splitContentByPageBreak } from "@/lib/utils";
import { mapArticleWriteError } from "@/lib/map-article-write-error";
import logger from "@/lib/logger";

type Context = { params: Promise<{ idOrSlug: string }> };

function canEditArticle(user: UserProfile, article: ArticleType): boolean {
  if (!user || !user.role) return false;
  const role = user.role.toLowerCase();
  if (hasPermission(role, "edit_any_article")) return true;
  if (hasPermission(role, "edit_own_article")) {
    // Robust authorId comparison (string vs ObjectId)
    const userId = user._id?.toString?.() ?? user._id;
    const authorId = article.authorId?.toString?.() ?? article.authorId;
    if (authorId && userId && authorId === userId) {
      return true;
    }
  }
  return false;
}

function canDeleteArticle(user: UserProfile, article: ArticleType): boolean {
  if (!user || !user.role) return false;
  const role = user.role.toLowerCase();
  if (hasPermission(role, "delete_any_article")) return true;
  if (
    hasPermission(role, "delete_own_article") &&
    article.authorId &&
    article.authorId.toString() === user._id.toString()
  ) {
    return true;
  }
  return false;
}

export async function GET(req: NextRequest, context: Context) {
  try {
    const db = await connectToDatabase();
    const { idOrSlug } = await context.params;
    const searchParams = req.nextUrl.searchParams;
    const pageParam = searchParams.get("page");

    const article = await getArticleByIdOrSlug(db, idOrSlug);
    if (!article) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    // Otorisasi akses berdasarkan status artikel dan peran (role) pengguna
    if (article.status !== "PUBLISHED") {
      const user = await getUserFromRequest(req);

      if (!user || !canViewArticleDetail(user, article)) {
        return NextResponse.json(
          { error: "Article not found" },
          { status: 404 },
        );
      }
    }

    // Handle API level pagination
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

    // Ambil related articles dari field relatedArticles
    let related: ArticleListResponse[] = [];
    try {
      related = await getRelatedArticles(db, idOrSlug);
    } catch (e) {
      related = [];
    }
    return NextResponse.json(
      { article, related, totalPages },
    );
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest, context: Context) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { idOrSlug } = await context.params;
    const db = await connectToDatabase();
    const body = await req.json();

    // Fetch article to check authorId

    const articleDoc = await getArticleByIdOrSlug(db, idOrSlug);
    if (!articleDoc || !articleDoc._id) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }
    // Debug log for authorId comparison
    // console.log(
    //   "role:", user.role,
    //   "permissions:", ROLE_PERMISSIONS[user.role as keyof typeof ROLES],
    //   "userId:", user._id,
    //   "authorId:", articleDoc.authorId
    // );
    if (!canEditArticle(user, articleDoc)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const article = await updateArticle(db, articleDoc._id.toString(), body, {
      _id: user._id,
      role: user.role,
      name: user.name,
      email: user.email,
    });
    return NextResponse.json({ article });

  } catch (error: unknown) {
    logger.error({ err: error }, "Error updating article");
    const { status, body } = mapArticleWriteError(error);
    return NextResponse.json(body, { status });
  }
}

export async function DELETE() {
  return NextResponse.json(
    { error: "Method not allowed. Physical deletion of articles is disabled." },
    { status: 405 },
  );
}
