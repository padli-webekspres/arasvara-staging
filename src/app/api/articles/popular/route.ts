import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/db";
import { getUserFromRequest } from "@/lib/auth";
import {
  upsertSectionArticlesWithType,
  getSectionArticlesWithType,
} from "@/services/article/articleSection/sectionArticleService";
import logger from "@/lib/logger";

/**
 * GET /api/articles/popular
 *
 * Fetch semua popular articles dengan populated article data
 * Response: 200 OK dengan array SectionArticleItem (include article details)
 */
export async function GET(req: NextRequest) {
  try {
    const db = await connectToDatabase();

    // Fetch popular articles dengan populated article data
    const popularArticles = await getSectionArticlesWithType(db, "popular");

    logger.info(
      { count: popularArticles.length },
      "Popular articles fetched successfully",
    );

    return NextResponse.json(
      {
        data: popularArticles,
        message: "Popular articles fetched successfully",
      },
      { status: 200 },
    );
  } catch (error) {
    const err = error as Error & { status?: number };

    logger.error({ error: err }, "Error fetching popular articles");
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/articles/popular
 *
 * Upsert popular articles: replace seluruh koleksi untuk type popular dengan data baru
 *
 * Payload:
 * {
 *   "articles": [
 *     { "article_id": "article_id_string" },
 *     { "article_id": "article_id_string" }
 *   ]
 * }
 *
 * Authorization: ADMIN, EDITOR_IN_CHIEF, MANAGING_EDITOR
 * Response: 201 Created dengan array SectionArticleItem yang di-insert
 */
export async function POST(req: NextRequest) {
  try {
    const db = await connectToDatabase();

    // Validasi user authentication
    const user = await getUserFromRequest(req);
    if (!user) {
      logger.warn("Unauthorized attempt to upsert popular articles");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Validasi user authorization
    // Hanya ADMIN, EDITOR_IN_CHIEF, MANAGING_EDITOR yang boleh
    const userRole = (user.role || "").toString().toLowerCase();
    const allowedRoles = [
      "admin",
      "editor_in_chief",
      "managing_editor",
      "editor",
    ];

    if (!allowedRoles.includes(userRole)) {
      logger.warn(
        { userId: user._id, role: user.role },
        "Forbidden: user tidak punya akses untuk upsert popular articles",
      );
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Parse dan validate payload
    const body = await req.json();

    // Upsert popular articles menggunakan service generik
    await upsertSectionArticlesWithType(
      db,
      body,
      {
        _id: user._id?.toString() || user._id,
        name: String(user.name ?? ""),
        email: String(user.email ?? ""),
      },
      "popular",
    );

    // Fetch populated popular articles after upsert
    const populatedArticles = await getSectionArticlesWithType(db, "popular");

    logger.info(
      { userId: user._id, count: populatedArticles.length },
      "Popular articles upserted and populated successfully",
    );

    return NextResponse.json(
      {
        data: populatedArticles,
        message: "Popular articles upserted and populated successfully",
      },
      { status: 201 },
    );
  } catch (error) {
    const err = error as Error & { status?: number };

    // Handle validation errors (400)
    if (err.status === 400) {
      logger.warn(
        { error: err.message },
        "Validation error upserting popular articles",
      );
      return NextResponse.json({ error: err.message }, { status: 400 });
    }

    // Handle other errors (500)
    logger.error({ error: err }, "Error upserting popular articles");
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 },
    );
  }
}
