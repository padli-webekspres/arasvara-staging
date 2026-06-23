import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/db";
import { getUserFromRequest } from "@/lib/auth";
import { getEditorDashboardStats } from "@/services/analytics/dashboard/editorService";

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

    const allowedRoles = ["admin", "editor"];
    const userRole = (user.role || "").toString().toLowerCase();

    if (!allowedRoles.includes(userRole)) {
      return NextResponse.json(
        { error: "Forbidden: Hanya role Editor & Administrator yang dapat mengakses analitik ini" },
        { status: 403 }
      );
    }

    // 2. Tarik data suntingan spesifik milik Editor bersangkutan dari MongoDB
    const db = await connectToDatabase();
    const stats = await getEditorDashboardStats(db, user._id);

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    console.error("Error pada GET /api/analytics/dashboard/editor:", error);
    return NextResponse.json(
      { error: error.message || "Terjadi kesalahan internal server" },
      { status: 500 }
    );
  }
}
