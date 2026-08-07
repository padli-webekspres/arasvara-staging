import { NextRequest, NextResponse } from "next/server";
import { cleanupExpiredTempMedia } from "@/services/mediaService";
import logger from "@/lib/logger";

const SCHEDULER_SECRET = process.env.SCHEDULER_SECRET;

/**
 * POST /api/media/cleanup-temp
 *
 * Garbage collection folder `temp/`: hapus objek berusia > 24 jam yang tidak
 * pernah di-promote (draft dibatalkan / artikel tidak pernah disubmit).
 *
 * Proteksi: sama seperti `/api/publish-scheduled` — header
 * `x-scheduler-secret: ${SCHEDULER_SECRET}` (atau request dari localhost).
 */
export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") || "";
    const isLocal = ip.startsWith("127.") || ip === "::1" || ip === "";
    const secret =
      req.headers.get("x-scheduler-secret") ||
      req.nextUrl.searchParams.get("secret");

    if (!isLocal && (!SCHEDULER_SECRET || secret !== SCHEDULER_SECRET)) {
      logger.warn(
        {
          ip,
          hasEnvSecret: !!SCHEDULER_SECRET,
          hasHeaderSecret: !!req.headers.get("x-scheduler-secret"),
          hasParamSecret: !!req.nextUrl.searchParams.get("secret"),
        },
        "Unauthorized cleanup-temp access attempt: secret mismatch or missing",
      );
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await cleanupExpiredTempMedia();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    logger.error({ err: error }, "cleanup-temp error");
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: message || "Internal server error" },
      { status: 500 },
    );
  }
}
