import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/db";
import { searchArticles, searchVideos } from "@/services/searchService";
import { ArticleSearchParams, VideoSearchParams } from "@/types/search";
import logger from "@/lib/logger";

/**
 * GET /api/search
 *
 * Query Parameters:
 * - type         : "ARTICLES" | "VIDEO" (default: "ARTICLES")
 * - q            : teks pencarian bebas (judul, excerpt, tag, kategori, nama/slug penulis)
 * - format       : "STANDARD" | "GALLERY" (bisa multiple, dipisah koma)
 * - category     : slug kategori (bisa multiple, dipisah koma)
 * - tags         : slug tag (bisa multiple, dipisah koma)
 * - flags        : "popular" | "editor_choice" | "headline" — dari koleksi section_articles (bisa multiple, dipisah koma)
 * - platform     : "tiktok" | "instagram" | "youtube" (bisa multiple, dipisah koma)
 * - dateFrom     : ISO date string (e.g. "2024-01-01")
 * - dateTo       : ISO date string (e.g. "2024-12-31")
 * - sortBy       : "date" | "title" | "views" (hanya untuk ARTICLES)
 * - sortOrder    : "asc" | "desc"
 * - status       : satu status artikel; default `published`; gunakan `all` untuk semua status
 * - authorId     : satu ObjectId penulis (filter CMS; tidak boleh koma)
 * - page         : nomor halaman (default: 1)
 * - limit        : jumlah item per halaman (default: 12, max: 50)
 * - skip         : offset dokumen (opsional; mengabaikan page jika diset)
 */
export async function GET(req: NextRequest) {
  try {
    const db = await connectToDatabase();
    const url = req.nextUrl;

    // ── Helper: Baca param koma-separated menjadi array ──
    const getArray = (key: string): string[] => {
      const raw = url.searchParams.get(key);
      if (!raw || !raw.trim()) return [];
      return raw.split(",").map((v) => v.trim()).filter(Boolean);
    };

    // ── Helper: Baca param string ──
    const getString = (key: string): string =>
      url.searchParams.get(key)?.trim() ?? "";

    // ── Helper: Baca param integer ──
    const getInt = (key: string, fallback: number): number => {
      const raw = url.searchParams.get(key);
      const parsed = parseInt(raw ?? "", 10);
      return isNaN(parsed) ? fallback : parsed;
    };

    // ── Ekstraksi parameter umum ──
    const type = getString("type") || "ARTICLES";
    const search = getString("q") || undefined;
    const dateFrom = getString("dateFrom") || undefined;
    const dateTo = getString("dateTo") || undefined;
    const sortOrder = (getString("sortOrder") || "desc") as "asc" | "desc";
    const page = getInt("page", 1);
    const limit = getInt("limit", 12);
    const skipRaw = url.searchParams.get("skip");
    const skip =
      skipRaw != null && skipRaw.trim() !== "" && !Number.isNaN(parseInt(skipRaw, 10))
        ? parseInt(skipRaw, 10)
        : undefined;

    // ── Routing berdasarkan tipe ──
    if (type === "VIDEO") {
      // Mode Video: query ke video_section saja
      const params: VideoSearchParams = {
        search,
        platforms: getArray("platform"),
        dateFrom,
        dateTo,
        sortOrder,
        page,
        limit,
      };

      const result = await searchVideos(db, params);
      return NextResponse.json(result, { status: 200 });
    }

    // Mode Artikel (default): query ke articles saja
    const sortByRaw = getString("sortBy");
    const sortBy =
      sortByRaw === "title" || sortByRaw === "views" || sortByRaw === "updatedAt"
        ? (sortByRaw as "title" | "views" | "updatedAt")
        : "date";

    const statusRaw = getString("status");
    if (statusRaw.includes(",")) {
      return NextResponse.json(
        {
          success: false,
          error: "Parameter status hanya boleh satu nilai (tidak dipisah koma).",
        },
        { status: 400 },
      );
    }

    const authorIdRaw = getString("authorId");
    if (authorIdRaw.includes(",")) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Parameter authorId hanya boleh satu nilai (tidak dipisah koma).",
        },
        { status: 400 },
      );
    }

    const rawTags = getArray("tags");
    const tags = rawTags.length > 0 ? rawTags : (getString("tag") ? [getString("tag")] : []);

    const params: ArticleSearchParams = {
      search,
      format: getArray("format"),
      categories: getArray("category"),
      tags,
      flags: getArray("flags"),
      ...(statusRaw ? { status: statusRaw } : {}),
      ...(authorIdRaw ? { authorId: authorIdRaw } : {}),
      dateFrom,
      dateTo,
      sortBy,
      sortOrder,
      page,
      limit,
      ...(skip != null ? { skip } : {}),
    };

    const result = await searchArticles(db, params);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
