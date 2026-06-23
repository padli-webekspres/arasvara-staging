import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/db";
import { getUserFromRequest } from "@/lib/auth";
import { ROLES } from "@/lib/auth-client";
import { getThroughputRespon } from "@/services/analytics/workflowAnalyticsService";

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

    // 2. Ambil & Validasi Query Parameters
    const searchParams = req.nextUrl.searchParams;
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");

    let startDate: Date | undefined = undefined;
    let endDate: Date | undefined = undefined;

    if (startDateParam) {
      const parsedStart = Date.parse(startDateParam);
      if (!isNaN(parsedStart)) {
        startDate = new Date(parsedStart);
      }
    }

    if (endDateParam) {
      const parsedEnd = Date.parse(endDateParam);
      if (!isNaN(parsedEnd)) {
        endDate = new Date(parsedEnd);
      }
    }

    // 3. Ambil data dari service
    const db = await connectToDatabase();
    const throughput = await getThroughputRespon(db, startDate, endDate);

    return NextResponse.json({
      success: true,
      data: throughput,
    });
  } catch (error: any) {
    console.error("Error pada GET /api/analytics/workflow/throughput-respon:", error);
    return NextResponse.json(
      { error: error.message || "Terjadi kesalahan internal server" },
      { status: 500 }
    );
  }
}
