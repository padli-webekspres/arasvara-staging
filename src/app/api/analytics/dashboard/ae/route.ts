import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/db";
import { getUserFromRequest } from "@/lib/auth";
import { ROLES } from "@/lib/auth-client";
import { getAEDashboardData } from "@/services/analytics/dashboard/aeService";
import { ensureAdClickEventIndexes } from "@/services/ads/adClickService";

const ALLOWED_ROLES = [
  ROLES.ADMIN.toLowerCase(),
  ROLES.ACCOUNT_EXECUTIVE.toLowerCase(),
];

let indexesEnsured = false;

/**
 * GET /api/analytics/dashboard/ae
 * Data lengkap dashboard Account Executive (KPI, grafik, tabel iklan).
 *
 * Query: `days` — rentang tren & pie (7–90, default 30).
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized: Silakan login terlebih dahulu" },
        { status: 401 },
      );
    }

    const userRole = (user.role || "").toString().toLowerCase();
    if (!ALLOWED_ROLES.includes(userRole)) {
      return NextResponse.json(
        {
          error:
            "Forbidden: Hanya role Account Executive & Administrator yang dapat mengakses analitik ini",
        },
        { status: 403 },
      );
    }

    const daysParam = req.nextUrl.searchParams.get("days");
    const trendDays = daysParam ? parseInt(daysParam, 10) : undefined;

    const db = await connectToDatabase();

    if (!indexesEnsured) {
      await ensureAdClickEventIndexes(db);
      indexesEnsured = true;
    }

    const data = await getAEDashboardData(db, { trendDays });

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Terjadi kesalahan internal server";
    console.error("Error pada GET /api/analytics/dashboard/ae:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
