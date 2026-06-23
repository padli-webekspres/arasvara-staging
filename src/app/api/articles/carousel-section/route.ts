import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/db";
import { getUserFromRequest } from "@/lib/auth";
import {
  upsertCarouselSection,
  getCarouselSectionWithArticles,
} from "@/services/article/articleSection/carouselSectionService";
import logger from "@/lib/logger";

/**
 * GET /api/articles/carousel-section
 *
 * Fetch semua carousel section dengan populated article data
 * Response: 200 OK dengan array SectionArticleItem (include article details)
 */
export async function GET(req: NextRequest) {
  try {
    const db = await connectToDatabase();

    // Fetch carousel section dengan populated article data
    const carouselSection = await getCarouselSectionWithArticles(db);

    logger.info(
      { count: carouselSection.length },
      "Carousel section fetched successfully",
    );

    return NextResponse.json(
      {
        data: carouselSection,
        message: "Carousel section fetched successfully",
      },
      { status: 200 },
    );
  } catch (error) {
    const err = error as Error & { status?: number };

    logger.error({ error: err }, "Error fetching carousel section");
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/articles/carousel-section
 *
 * Upsert carousel section: replace seluruh koleksi carousel_section dengan data baru
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
      logger.warn("Unauthorized attempt to upsert carousel section");
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
        "Forbidden: user tidak punya akses untuk upsert carousel section",
      );
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Parse dan validate payload
    const body = await req.json();

    // Upsert carousel section menggunakan service
    await upsertCarouselSection(db, body, {
      _id: user._id,
      name: user.name,
      email: user.email,
    });

    // Fetch populated carousel section after upsert
    const populatedSection = await getCarouselSectionWithArticles(db);

    logger.info(
      { userId: user._id, count: populatedSection.length },
      "Carousel section upserted and populated successfully",
    );

    return NextResponse.json(
      {
        data: populatedSection,
        message: "Carousel section upserted and populated successfully",
      },
      { status: 201 },
    );
  } catch (error) {
    const err = error as Error & { status?: number };

    // Handle validation errors (400)
    if (err.status === 400) {
      logger.warn(
        { error: err.message },
        "Validation error upserting carousel section",
      );
      return NextResponse.json({ error: err.message }, { status: 400 });
    }

    // Handle other errors (500)
    logger.error({ error: err }, "Error upserting carousel section");
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 },
    );
  }
}
