import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/db";
import { getUserFromRequest } from "@/lib/auth";
import { ROLES } from "@/lib/auth-client";
import { getTrafficTrend } from "@/services/analytics/audienceAnalyticsService";

/**
 * Route GET /api/analytics/audience/views
 * 
 * Melayani data tren traffic situs (Total Views & Unique Visitors) dengan filter:
 * - startDate: Tanggal awal (default: 30 hari yang lalu)
 * - endDate: Tanggal akhir (default: hari ini)
 * - interval: "daily" | "weekly" | "monthly" (default: "daily")
 */
export async function GET(req: NextRequest) {
  try {
    // 1. Verifikasi Autentikasi & Otorisasi Pengguna
    const user = await getUserFromRequest(req);
    
    // Peran staf CMS yang diperbolehkan mengakses dashboard analitik luas
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
    const intervalParam = searchParams.get("interval") || "daily";

    // Validasi nilai interval
    if (intervalParam !== "daily" && intervalParam !== "weekly" && intervalParam !== "monthly") {
      return NextResponse.json(
        { error: "Invalid interval: Pilihan interval hanya 'daily', 'weekly', atau 'monthly'" },
        { status: 400 }
      );
    }

    // Validasi format tanggal jika diberikan
    let startDate: Date | undefined = undefined;
    let endDate: Date | undefined = undefined;

    if (startDateParam) {
      const parsedStart = Date.parse(startDateParam);
      if (isNaN(parsedStart)) {
        return NextResponse.json(
          { error: "Invalid startDate format: Gunakan format ISO string yang valid (YYYY-MM-DD)" },
          { status: 400 }
        );
      }
      startDate = new Date(parsedStart);
    }

    if (endDateParam) {
      const parsedEnd = Date.parse(endDateParam);
      if (isNaN(parsedEnd)) {
        return NextResponse.json(
          { error: "Invalid endDate format: Gunakan format ISO string yang valid (YYYY-MM-DD)" },
          { status: 400 }
        );
      }
      endDate = new Date(parsedEnd);
    }

    // Hubungkan ke Database & ambil data tren tayangan
    const db = await connectToDatabase();
    const trendData = await getTrafficTrend(db, {
      startDate,
      endDate,
      interval: intervalParam as "daily" | "weekly" | "monthly",
    });

    // Kembalikan respons sukses
    return NextResponse.json({
      success: true,
      data: trendData,
    });
  } catch (error: any) {
    console.error("Error pada GET /api/analytics/audience/views:", error);
    return NextResponse.json(
      { error: error.message || "Terjadi kesalahan internal server" },
      { status: 500 }
    );
  }
}
