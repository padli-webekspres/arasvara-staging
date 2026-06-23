import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/db";
import { getUserFromRequest } from "@/lib/auth";
import {
  getRelatedArticles,
  updateRelatedArticles,
} from "@/services/article/relatedArticlesService";
import logger from "@/lib/logger";

/**
 * GET /api/articles/[idOrSlug]/related
 *
 * Fetch related articles untuk artikel tertentu
 * Response: 200 OK dengan array RelatedArticle (include populated article details)
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ idOrSlug: string }> },
) {
  try {
    const db = await connectToDatabase();
    const { idOrSlug } = await context.params;

    // Fetch related articles dengan populated data
    const relatedArticles = await getRelatedArticles(db, idOrSlug);

    return NextResponse.json(
      {
        data: relatedArticles,
        message: "Related articles fetched successfully",
      },
      { status: 200 },
    );
  } catch (error) {
    const err = error as Error & { status?: number };

    // Handle 404 jika artikel tidak ditemukan
    if (err.status === 404) {
      logger.warn({ error: err.message }, "Article not found");
      return NextResponse.json({ error: err.message }, { status: 404 });
    }

    // Handle server errors
    logger.error({ error: err }, "Error fetching related articles");
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/articles/[idOrSlug]/related
 *
 * Update related articles untuk artikel tertentu
 * Replace seluruh array relatedArticles dengan data baru dari payload
 *
 * Payload:
 * {
 *   "related": [
 *     {
 *       "article_id": "article_id_string",
 *       "order": 0,
 *       "createdAt": "2026-04-09T00:00:00Z",
 *       "createdBy": "user_id_string"
 *     },
 *     ...
 *   ]
 * }
 *
 * Authorization: Hanya user authenticated yang bisa update
 * Response: 200 OK dengan updated article dan populated relatedArticles
 */
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ idOrSlug: string }> },
) {
  try {
    const db = await connectToDatabase();

    // Validasi user authentication
    const user = await getUserFromRequest(req);
    if (!user) {
      logger.warn("Unauthorized attempt to update related articles");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { idOrSlug } = await context.params;

    // Parse dan validasi payload
    const body = await req.json();

    // Update related articles menggunakan service
    const result = await updateRelatedArticles(
      db,
      idOrSlug,
      body,
      user._id?.toString() || String(user._id),
    );

    return NextResponse.json(
      {
        data: result.relatedArticles,
        articleId: result.articleId,
        message: "Related articles updated successfully",
      },
      { status: 200 },
    );
  } catch (error) {
    const err = error as Error & { status?: number };

    // Handle 404 jika artikel tidak ditemukan
    if (err.status === 404) {
      logger.warn({ error: err.message }, "Article not found");
      return NextResponse.json({ error: err.message }, { status: 404 });
    }

    // Handle 400 validation errors
    if (err.status === 400) {
      logger.warn(
        { error: err.message },
        "Validation error updating related articles",
      );
      return NextResponse.json({ error: err.message }, { status: 400 });
    }

    // Handle server errors
    logger.error({ error: err }, "Error updating related articles");
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 },
    );
  }
}
