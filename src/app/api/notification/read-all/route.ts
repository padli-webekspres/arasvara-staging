import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/db";
import { getUserFromRequest } from "@/lib/auth";
import { markAllRead } from "@/services/notificationService";
import logger from "@/lib/logger";

// ─── PATCH /api/notification/read-all ────────────────────────────────────────
// Tandai semua notifikasi milik user sebagai sudah dibaca.

export async function PATCH(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = await connectToDatabase();
    const modifiedCount = await markAllRead(db, user._id.toString());

    return NextResponse.json({ success: true, modifiedCount });
  } catch (error: any) {
    logger.error({ err: error }, "Error marking all notifications as read");
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 },
    );
  }
}
