import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/db";
import { getUserFromRequest } from "@/lib/auth";
import { ROLES } from "@/lib/auth-client";
import {
  getFormatDistribution,
  getCategoryDistribution,
  getCrossCorrelation,
} from "@/services/analytics/audienceAnalyticsService";

/**
 * Route GET /api/analytics/audience/distribution
 *
 * Menyajikan tiga kelompok data distribusi audiens dalam satu endpoint:
 * 1. formatDistribution  — distribusi views berdasarkan format artikel (STANDARD vs GALLERY)
 * 2. categoryDistribution — distribusi views berdasarkan kategori teratas
 * 3. crossCorrelation    — matriks views berdasarkan kombinasi format × kategori
 *
 * Query Params:
 * - startDate?: string  (YYYY-MM-DD, default: 30 hari lalu)
 * - endDate?:   string  (YYYY-MM-DD, default: hari ini)
 */
export async function GET(req: NextRequest) {
  try {
    // 1. Verifikasi Autentikasi & Otorisasi
    const user = await getUserFromRequest(req);

    const allowedRoles = [
      ROLES.ADMIN,
      ROLES.EDITOR_IN_CHIEF,
      ROLES.MANAGING_EDITOR,
      ROLES.HEAD_OF,
      ROLES.EDITOR,
    ];

    if (
      !user ||
      !allowedRoles.map((r) => r.toLowerCase()).includes(user.role?.toLowerCase())
    ) {
      return NextResponse.json(
        { error: "Forbidden: Anda tidak memiliki hak akses ke halaman analitik ini" },
        { status: 403 }
      );
    }

    // 2. Ambil & Validasi Query Parameters
    const searchParams = req.nextUrl.searchParams;
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");

    // Tentukan rentang default: 30 hari terakhir
    const resolvedEnd = endDateParam ? new Date(endDateParam) : new Date();
    const resolvedStart = startDateParam
      ? new Date(startDateParam)
      : new Date(resolvedEnd.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Validasi jika parameter diberikan
    if (startDateParam && isNaN(resolvedStart.getTime())) {
      return NextResponse.json(
        { error: "Invalid startDate format: Gunakan format ISO string yang valid (YYYY-MM-DD)" },
        { status: 400 }
      );
    }
    if (endDateParam && isNaN(resolvedEnd.getTime())) {
      return NextResponse.json(
        { error: "Invalid endDate format: Gunakan format ISO string yang valid (YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    // 3. Sambungkan ke DB & jalankan ketiga service secara paralel
    const db = await connectToDatabase();

    const [formatDistribution, categoryDistribution, crossCorrelation] =
      await Promise.all([
        getFormatDistribution(db, resolvedStart, resolvedEnd),
        getCategoryDistribution(db, resolvedStart, resolvedEnd, 10),
        getCrossCorrelation(db, resolvedStart, resolvedEnd, 5),
      ]);

    // 4. Kembalikan respons sukses
    return NextResponse.json({
      success: true,
      data: {
        formatDistribution,
        categoryDistribution,
        crossCorrelation,
      },
    });
  } catch (error: any) {
    console.error("Error pada GET /api/analytics/audience/distribution:", error);
    return NextResponse.json(
      { error: error.message || "Terjadi kesalahan internal server" },
      { status: 500 }
    );
  }
}
