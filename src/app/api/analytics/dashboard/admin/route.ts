import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/db";
import { getUserFromRequest } from "@/lib/auth";
import { ROLES } from "@/lib/auth-client";
import { getAdminDashboardStats } from "@/services/analytics/dashboard/adminDashboardService";

export async function GET(req: NextRequest) {
  try {
    // 1. Verifikasi Autentikasi & Otorisasi Pengguna
    const user = await getUserFromRequest(req);

    if (!user || user.role?.toLowerCase() !== ROLES.ADMIN.toLowerCase()) {
      return NextResponse.json(
        { error: "Forbidden: Hanya role Administrator yang dapat mengakses analitik ini" },
        { status: 403 }
      );
    }

    // 2. Tarik data terparalelisasi dari database MongoDB
    const db = await connectToDatabase();
    const stats = await getAdminDashboardStats(db);

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    console.error("Error pada GET /api/analytics/dashboard/admin:", error);
    return NextResponse.json(
      { error: error.message || "Terjadi kesalahan internal server" },
      { status: 500 }
    );
  }
}
