import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/db";
import { getUserFromRequest } from "@/lib/auth";
import { ROLES } from "@/lib/auth-client";
import { getArticleEngagement } from "@/services/analytics/audienceAnalyticsService";

export async function GET(req: NextRequest) {
  try {
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

    const searchParams = req.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const search = searchParams.get("search") || "";
    const categoryId = searchParams.get("categoryId") || "";
    const format = searchParams.get("format") || "";

    const db = await connectToDatabase();
    const result = await getArticleEngagement(db, {
      page,
      limit,
      search,
      categoryId,
      format,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error("Error pada GET /api/analytics/audience/engagement:", error);
    return NextResponse.json(
      { error: error.message || "Terjadi kesalahan internal server" },
      { status: 500 }
    );
  }
}
