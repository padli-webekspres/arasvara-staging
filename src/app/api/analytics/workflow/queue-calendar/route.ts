import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/db";
import { getUserFromRequest } from "@/lib/auth";
import { ROLES } from "@/lib/auth-client";
import { getQueueCalendar } from "@/services/analytics/workflowAnalyticsService";

export async function GET(req: NextRequest) {
  try {
    // 1. Verifikasi Autentikasi & Otorisasi Pengguna
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

    // 2. Ambil data dari service
    const db = await connectToDatabase();
    const queueData = await getQueueCalendar(db);

    return NextResponse.json({
      success: true,
      data: queueData,
    });
  } catch (error: any) {
    console.error("Error pada GET /api/analytics/workflow/queue-calendar:", error);
    return NextResponse.json(
      { error: error.message || "Terjadi kesalahan internal server" },
      { status: 500 }
    );
  }
}
