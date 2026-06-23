import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/db";
import { getUserFromRequest } from "@/lib/auth";
import {
  upsertSectionArticlesWithType,
  getSectionArticlesWithType,
} from "@/services/article/articleSection/sectionArticleService";
import logger from "@/lib/logger";

/**
 * GET /api/articles/editor-choice
 *
 * Fetch semua editor choices dengan populated article data
 * Response: 200 OK dengan array SectionArticleItem (include article details)
 */
export async function GET(req: NextRequest) {
  try {
    const db = await connectToDatabase();

    // Fetch editor choices dengan populated article data
    const editorChoices = await getSectionArticlesWithType(db, "editor choices");

    logger.info(
      { count: editorChoices.length },
      "Editor choices fetched successfully",
    );

    return NextResponse.json(
      {
        data: editorChoices,
        message: "Editor choices fetched successfully",
      },
      { status: 200 },
    );
  } catch (error) {
    const err = error as Error & { status?: number };

    logger.error({ error: err }, "Error fetching editor choices");
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/articles/editor-choice
 *
 * Upsert editor choices: replace seluruh koleksi untuk type editor choices dengan data baru
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
      logger.warn("Unauthorized attempt to upsert editor choices");
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
        "Forbidden: user tidak punya akses untuk upsert editor choices",
      );
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Parse dan validate payload
    const body = await req.json();

    // Upsert editor choices menggunakan service generik
    await upsertSectionArticlesWithType(db, body, user._id?.toString() || user._id, "editor choices");

    // Fetch populated editor choices after upsert
    const populatedChoices = await getSectionArticlesWithType(db, "editor choices");

    logger.info(
      { userId: user._id, count: populatedChoices.length },
      "Editor choices upserted and populated successfully",
    );

    return NextResponse.json(
      {
        data: populatedChoices,
        message: "Editor choices upserted and populated successfully",
      },
      { status: 201 },
    );
  } catch (error) {
    const err = error as Error & { status?: number };

    // Handle validation errors (400)
    if (err.status === 400) {
      logger.warn(
        { error: err.message },
        "Validation error upserting editor choices",
      );
      return NextResponse.json({ error: err.message }, { status: 400 });
    }

    // Handle other errors (500)
    logger.error({ error: err }, "Error upserting editor choices");
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 },
    );
  }
}
