import { NextRequest, NextResponse } from "next/server";

import { connectToDatabase } from "@/lib/db/db";
import { getReportArticleWriter } from "@/services/reports/articleWriterService";
import { getUserFromRequest } from "@/lib/auth";
import { ROLES } from "@/lib/auth-client";
import logger from "@/lib/logger";

export async function GET(req: NextRequest) {
  try {
    // Proteksi: hanya user login & role tertentu
    const user = await getUserFromRequest(req);
    const allowedRoles = [
      ROLES.REPORTER,
      ROLES.WRITER,
      ROLES.CONTRIBUTOR,
      ROLES.EDITOR,
      ROLES.HEAD_OF,
      ROLES.MANAGING_EDITOR,
      ROLES.EDITOR_IN_CHIEF,
      ROLES.ADMIN,
    ];
    if (!user || !allowedRoles.includes(user.role)) {
      return NextResponse.json(
        { error: "Unauthorized: Anda tidak memiliki akses." },
        { status: 401 },
      );
    }

    const db = await connectToDatabase();
    const url = new URL(req.url);

    const limit = parseInt(url.searchParams.get("limit") || "20", 10);
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const search = url.searchParams.get("search") || "";

    const result = await getReportArticleWriter(db, {
      limit,
      page,
      search,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    logger.error({
      msg: "Error in GET /api/reports/article/writer",
      error: error?.message,
      stack: error?.stack,
    });
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 },
    );
  }
}
