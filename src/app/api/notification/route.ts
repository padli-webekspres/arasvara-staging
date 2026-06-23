import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/db";
import { getUserFromRequest } from "@/lib/auth";
import {
  createNotification,
  getNotifications,
} from "@/services/notificationService";
import logger from "@/lib/logger";
import { NotificationType } from "@/types/notification";

// ─── GET /api/notification ────────────────────────────────────────────────────
// Ambil daftar notifikasi user yang sedang login (dengan pagination).
// Query params: limit (default 7), skip (default 0)

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "7");
    const skip = parseInt(searchParams.get("skip") || "0");

    const db = await connectToDatabase();
    const result = await getNotifications(db, {
      userId: user._id.toString(),
      limit,
      skip,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    logger.error({ err: error }, "Error fetching notifications");
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 },
    );
  }
}

// ─── POST /api/notification ───────────────────────────────────────────────────
// Buat notifikasi baru. Hanya admin/editor/sistem yang diizinkan.
// Body: { userId, type, title, message?, link?, actor?, icon?, meta? }

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = user.role?.toLowerCase() ?? "";
    if (!["admin", "editor-in-chief", "editor"].includes(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { userId, type, title, message, link, actor, icon, meta } = body;

    if (!userId || !type || !title) {
      return NextResponse.json(
        { error: "userId, type, and title are required" },
        { status: 400 },
      );
    }

    if (!Object.values(NotificationType).includes(type)) {
      return NextResponse.json(
        { error: `Invalid notification type: ${type}` },
        { status: 400 },
      );
    }

    const db = await connectToDatabase();
    const notification = await createNotification(db, {
      userId,
      type,
      title,
      message,
      link,
      actor,
      icon,
      meta,
    });

    logger.info(
      { notificationId: notification._id, userId, type },
      "Notification created",
    );
    return NextResponse.json({ notification }, { status: 201 });
  } catch (error: any) {
    logger.error({ err: error }, "Error creating notification");
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 },
    );
  }
}
