import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/db";
import { getUserFromRequest } from "@/lib/auth";
import { getChiefDashboardStats } from "@/services/analytics/dashboard/editorInChiefService";

export async function GET(req: NextRequest) {
  try {
    // 1. Verifikasi Autentikasi & Otorisasi Pengguna
    const user = await getUserFromRequest(req);

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized: Silakan login terlebih dahulu" },
        { status: 401 }
      );
    }

    const allowedRoles = ["admin", "editor-in-chief"];
    const userRole = (user.role || "").toString().toLowerCase();

    if (!allowedRoles.includes(userRole)) {
      return NextResponse.json(
        { error: "Forbidden: Hanya role Pemimpin Redaksi & Administrator yang dapat mengakses analitik ini" },
        { status: 403 }
      );
    }

    // 2. Tarik data terparalelisasi dari database MongoDB melalui service
    const db = await connectToDatabase();
    const stats = await getChiefDashboardStats(db);

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    console.error("Error pada GET /api/analytics/dashboard/editor-in-chief:", error);
    return NextResponse.json(
      { error: error.message || "Terjadi kesalahan internal server" },
      { status: 500 }
    );
  }
}
