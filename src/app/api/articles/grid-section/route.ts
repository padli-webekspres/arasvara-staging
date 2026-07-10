import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/db";
import { getUserFromRequest } from "@/lib/auth";
import {
  upsertSectionArticlesWithType,
  getSectionArticlesWithType,
} from "@/services/article/articleSection/sectionArticleService";
import logger from "@/lib/logger";

/**
 * GET /api/articles/grid-section
 *
 * Fetch semua grid section dengan populated article data
 * Response: 200 OK dengan array SectionArticleItem (include article details)
 */
export async function GET(req: NextRequest) {
  try {
    const db = await connectToDatabase();

    // Fetch grid section dengan populated article data
    const gridSection = await getSectionArticlesWithType(db, "featured");

    logger.info(
      { count: gridSection.length },
      "Grid section fetched successfully",
    );

    return NextResponse.json(
      {
        data: gridSection,
        message: "Grid section fetched successfully",
      },
      { status: 200 },
    );
  } catch (error) {
    const err = error as Error & { status?: number };

    logger.error({ error: err }, "Error fetching grid section");
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/articles/grid-section
 *
 * Upsert grid section: replace seluruh koleksi untuk type featured dengan data baru
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
      logger.warn("Unauthorized attempt to upsert grid section");
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
        "Forbidden: user tidak punya akses untuk upsert grid section",
      );
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Parse dan validate payload
    const body = await req.json();

    // Upsert grid section menggunakan service generik dengan limit 5
    await upsertSectionArticlesWithType(
      db,
      body,
      {
        _id: user._id?.toString() || user._id,
        name: String(user.name ?? ""),
        email: String(user.email ?? ""),
      },
      "featured",
      5,
    );

    // Fetch populated grid section after upsert
    const populatedSection = await getSectionArticlesWithType(db, "featured");

    logger.info(
      { userId: user._id, count: populatedSection.length },
      "Grid section upserted and populated successfully",
    );

    return NextResponse.json(
      {
        data: populatedSection,
        message: "Grid section upserted and populated successfully",
      },
      { status: 201 },
    );
  } catch (error) {
    const err = error as Error & { status?: number };

    // Handle validation errors (400)
    if (err.status === 400) {
      logger.warn(
        { error: err.message },
        "Validation error upserting grid section",
      );
      return NextResponse.json({ error: err.message }, { status: 400 });
    }

    // Handle other errors (500)
    logger.error({ error: err }, "Error upserting grid section");
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 },
    );
  }
}
