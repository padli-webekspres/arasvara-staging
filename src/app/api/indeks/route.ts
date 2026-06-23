import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/db";
import { getIndeksArticles } from "@/services/indeksService";

/**
 * GET /api/indeks
 *
 * Endpoint untuk halaman indeks berita.
 * Selalu mengembalikan artikel yang dipublikasikan, diurutkan dari terbaru.
 *
 * Query Parameters:
 * - category : slug kategori (opsional, satu nilai). Kosong = semua kategori.
 * - date     : tanggal dalam format YYYY-MM-DD (opsional). Kosong = semua tanggal.
 * - page     : nomor halaman, 1-indexed (default: 1)
 * - limit    : jumlah artikel per halaman (default: 12, max: 50)
 */
export async function GET(req: NextRequest) {
  try {
    const db = await connectToDatabase();
    const { searchParams } = req.nextUrl;

    // ── Ekstraksi parameter ──
    const categorySlug = searchParams.get("category")?.trim() || undefined;
    const date = searchParams.get("date")?.trim() || undefined;

    const pageRaw = parseInt(searchParams.get("page") ?? "1", 10);
    const page = isNaN(pageRaw) || pageRaw < 1 ? 1 : pageRaw;

    const limitRaw = parseInt(searchParams.get("limit") ?? "12", 10);
    const limit = isNaN(limitRaw) ? 12 : limitRaw;

    // ── Jalankan service ──
    const result = await getIndeksArticles(db, {
      categorySlug,
      date,
      page,
      limit,
    });

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
