import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/db";
import logger from "@/lib/logger";
import { publishScheduledArticles } from "@/services/article/writeArticleService";

// Optional: gunakan secret untuk proteksi tambahan
const SCHEDULER_SECRET = process.env.SCHEDULER_SECRET;

export async function POST(req: NextRequest) {
  try {
    // Proteksi: hanya izinkan dari localhost atau dengan secret
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
        "Unauthorized scheduler access attempt: secret mismatch or missing",
      );
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = await connectToDatabase();
    const result = await publishScheduledArticles(db);
    return NextResponse.json(result);
  } catch (error: any) {
    logger.error({ err: error, stack: error?.stack }, "Scheduler error");
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 },
    );
  }
}
