import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { changePassword } from "@/services/authService";
import { createNotification } from "@/services/notificationService";
import { sendPushToUser } from "@/services/pushNotifService";
import { connectToDatabase } from "@/lib/db/db";
import logger from "@/lib/logger";
import { adminPanelHref } from "@/lib/admin-panel-path";

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { oldPassword, newPassword, targetUserId, isAdminPageReset } = body;

    if (!newPassword) {
      return NextResponse.json(
        { error: "Password baru harus diisi" },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "Password baru minimal 8 karakter" },
        { status: 400 }
      );
    }

    const requesterId = user._id.toString();
    const requesterRole = user.role?.toLowerCase() ?? "";
    const finalTargetUserId = targetUserId || requesterId;
    const isSelf = finalTargetUserId === requesterId;

    let bypassOldPasswordCheck = false;

    if (isAdminPageReset) {
      // Hanya admin dan editor-in-chief yang bisa melakukan reset dari halaman manajemen pengguna tanpa password lama
      if (requesterRole !== "admin" && requesterRole !== "editor-in-chief") {
        return NextResponse.json(
          { error: "Forbidden: Anda tidak memiliki akses untuk mereset password tanpa password lama" },
          { status: 403 }
        );
      }
      bypassOldPasswordCheck = true;
    } else {
      // Logic normal (di luar halaman manajemen pengguna)
      if (!isSelf && requesterRole !== "admin") {
        return NextResponse.json(
          { error: "Forbidden: Hanya Administrator yang dapat mengganti password pengguna lain" },
          { status: 403 }
        );
      }
      bypassOldPasswordCheck = !isSelf && requesterRole === "admin";
    }

    if (!bypassOldPasswordCheck && !oldPassword) {
      return NextResponse.json(
        { error: "Password lama harus diisi" },
        { status: 400 }
      );
    }

    // Eksekusi perubahan password
    try {
      const result = await changePassword(
        finalTargetUserId,
        oldPassword || null,
        newPassword,
        bypassOldPasswordCheck
      );

      const targetUser = result.targetUser;
      const db = await connectToDatabase();

      // Buat pesan notifikasi
      const messageText = isSelf
        ? "Password Anda berhasil diperbarui. Jika bukan Anda yang melakukan ini, segera amankan akun Anda."
        : `Password Anda telah disetel ulang oleh Administrator (${user.name}).`;

      // 1. Kirim Log Keamanan
      logger.info(
        {
          requesterEmail: user.email,
          targetUserEmail: targetUser.email,
          isSelf,
        },
        "Keamanan: Password berhasil diperbarui"
      );

      // 2. Kirim In-App Notification
      try {
        await createNotification(db, {
          userId: finalTargetUserId,
          type: "system",
          title: "Keamanan Akun",
          message: messageText,
          actor: {
            _id: user._id.toString(),
            name: user.name,
            email: user.email,
          },
          link: adminPanelHref(`profile/${finalTargetUserId}`),
        });
      } catch (notifErr) {
        logger.error({ err: notifErr }, "Gagal mengirim in-app notification saat ganti password");
      }

      // 3. Kirim Push Notification
      try {
        await sendPushToUser(db, finalTargetUserId, {
          title: "Keamanan Akun Arasvara",
          body: messageText,
          link: adminPanelHref(`profile/${finalTargetUserId}`),
        });
      } catch (pushErr) {
        logger.error({ err: pushErr }, "Gagal mengirim push notification saat ganti password");
      }

      return NextResponse.json({
        success: true,
        message: isSelf
          ? "Password Anda berhasil diperbarui!"
          : `Password untuk user ${targetUser.name} berhasil diperbarui oleh Administrator!`,
      });
    } catch (err: any) {
      if (err.message === "INCORRECT_OLD_PASSWORD") {
        return NextResponse.json({ error: "Password lama yang Anda masukkan salah" }, { status: 400 });
      }
      if (err.message === "USER_NOT_FOUND") {
        return NextResponse.json({ error: "Pengguna tidak ditemukan" }, { status: 404 });
      }
      return NextResponse.json({ error: err.message || "Gagal mengubah password" }, { status: 400 });
    }
  } catch (error: any) {
    logger.error({ err: error }, "Error changing password");
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
