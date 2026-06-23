import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/db";
import { getUserFromRequest } from "@/lib/auth";
import { savePushToken, deletePushToken } from "@/services/pushNotifService";
import logger from "@/lib/logger";

// ─── POST /api/push-token ────────────────────────────────────────────────────
// Simpan FCM token untuk user yang sedang login.
// Dipanggil oleh frontend setelah user memberi izin push notification.

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { token } = body;

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    const userAgent = req.headers.get("user-agent") ?? undefined;
    const db = await connectToDatabase();
    await savePushToken(db, user._id.toString(), token, userAgent);

    logger.info({ userId: user._id.toString() }, "Push token registered");

    return NextResponse.json({ success: true });
  } catch (error: any) {
    logger.error({ err: error }, "Error saving push token");
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 },
    );
  }
}

// ─── DELETE /api/push-token ───────────────────────────────────────────────────
// Hapus FCM token saat user logout atau unsubscribe dari push notification.

export async function DELETE(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { token } = body;

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    const db = await connectToDatabase();
    await deletePushToken(db, token);

    logger.info({ userId: user._id.toString() }, "Push token removed");

    return NextResponse.json({ success: true });
  } catch (error: any) {
    logger.error({ err: error }, "Error removing push token");
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 },
    );
  }
}
