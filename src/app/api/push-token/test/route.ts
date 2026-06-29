import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/db";
import { getUserFromRequest } from "@/lib/auth";
import { sendPushToUserWithResult } from "@/services/pushNotifService";
import { adminPanelHref } from "@/lib/admin-panel-path";
import logger from "@/lib/logger";

// POST /api/push-token/test — kirim push debug ke user yang sedang login
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Endpoint debug push hanya tersedia di development" },
      { status: 403 },
    );
  }

  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = user._id.toString();
    const db = await connectToDatabase();
    const nowLabel = new Date().toLocaleString("id-ID", {
      dateStyle: "medium",
      timeStyle: "short",
    });

    const result = await sendPushToUserWithResult(db, userId, {
      title: "Test Push Arasvara",
      body: `Notifikasi debug untuk ${user.name ?? "Anda"} — ${nowLabel}`,
      link: adminPanelHref(),
    });

    if (!result.firebaseConfigured) {
      return NextResponse.json(
        {
          success: false,
          error:
            "FIREBASE_SERVICE_ACCOUNT belum dikonfigurasi di server (.env).",
          ...result,
        },
        { status: 503 },
      );
    }

    if (result.tokenCount === 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Tidak ada FCM token terdaftar. Izinkan notifikasi browser lalu subscribe ulang.",
          ...result,
        },
        { status: 400 },
      );
    }

    if (result.sentCount === 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "FCM menolak semua token. Coba subscribe ulang dari tombol debug.",
          ...result,
        },
        { status: 502 },
      );
    }

    logger.info({ userId, ...result }, "Debug push notification terkirim");

    return NextResponse.json({
      success: true,
      message: `Push terkirim ke ${result.sentCount}/${result.tokenCount} device.`,
      ...result,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    logger.error({ err: error }, "Error mengirim debug push notification");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
