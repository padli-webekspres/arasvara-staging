import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/db";
import { getUserFromRequest } from "@/lib/auth";
import { getWriterDashboardStats } from "@/services/analytics/dashboard/writerService";

export async function GET(req: NextRequest) {
  try {
    // 1. Verifikasi Autentikasi & Otorisasi Pengguna via Cookie JWT Token
    const user = await getUserFromRequest(req);

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized: Silakan login terlebih dahulu" },
        { status: 401 }
      );
    }

    const allowedRoles = ["admin", "writer"];
    const userRole = (user.role || "").toString().toLowerCase();

    if (!allowedRoles.includes(userRole)) {
      return NextResponse.json(
        { error: "Forbidden: Hanya role Content Writer & Administrator yang dapat mengakses analitik ini" },
        { status: 403 }
      );
    }

    // 2. Tarik data analitik spesifik milik Penulis (Writer) dari MongoDB
    const db = await connectToDatabase();
    const stats = await getWriterDashboardStats(db, user._id);

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    console.error("Error pada GET /api/analytics/dashboard/writer:", error);
    return NextResponse.json(
      { error: error.message || "Terjadi kesalahan internal server" },
      { status: 500 }
    );
  }
}
