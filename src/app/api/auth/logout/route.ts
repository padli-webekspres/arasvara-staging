import { NextRequest, NextResponse } from "next/server";
import { deletePushToken } from "@/services/pushNotifService";
import { connectToDatabase } from "@/lib/db/db";
import {
  getRefreshTokenFromRequest,
  getUserFromRequest,
} from "@/lib/auth";
import { revokeRefreshToken, revokeAllRefreshTokensForUser } from "@/services/refreshTokenService";
import { clearAuthCookiesOnResponse } from "@/lib/auth-cookies";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const pushToken: string | undefined = body?.pushToken;

    if (pushToken) {
      const db = await connectToDatabase();
      await deletePushToken(db, pushToken);
    }
  } catch {
    // Logout tetap berhasil meski push token gagal dihapus
  }

  const refreshRaw = getRefreshTokenFromRequest(req);
  if (refreshRaw) {
    await revokeRefreshToken(refreshRaw);
  }

  const user = await getUserFromRequest(req);
  if (user?._id) {
    await revokeAllRefreshTokensForUser(user._id);
  }

  const response = NextResponse.json({ success: true });
  clearAuthCookiesOnResponse(response);
  return response;
}
