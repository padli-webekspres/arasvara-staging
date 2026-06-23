import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db/db";
import { getAdsHistory } from "@/services/ads/adsHistoryService";
import logger from "@/lib/logger";

/**
 * GET /api/ads/history
 *
 * Mengambil histori iklan terpadu (homepage & single article)
 * yang sudah berakhir atau telah didelete (soft-delete).
 *
 * Otorisasi: Khusus Administrator, Pemred, Redaktur, Editor, dan Account Executive.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized: Silakan login terlebih dahulu" },
        { status: 401 }
      );
    }

    const allowedRoles = ["admin", "editor-in-chief", "managing-editor", "editor", "account-executive"];
    const userRole = (user.role || "").toString().toLowerCase();

    if (!allowedRoles.includes(userRole)) {
      return NextResponse.json(
        { error: "Forbidden: Anda tidak memiliki akses untuk melihat riwayat iklan" },
        { status: 403 }
      );
    }

    const db = await connectToDatabase();
    const history = await getAdsHistory(db);

    return NextResponse.json({
      success: true,
      history,
    });
  } catch (error: any) {
    logger.error({ err: error }, "GET /api/ads/history failed");
    return NextResponse.json(
      { error: error.message || "Terjadi kesalahan internal server" },
      { status: 500 }
    );
  }
}
