import { NextRequest, NextResponse } from "next/server";
import { getPushStats } from "@/services/analytics/pushNotifService";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const params = {
      notificationId: searchParams.get("notificationId") || undefined,
      articleId: searchParams.get("articleId") || undefined,
      userId: searchParams.get("userId") || undefined,
      startDate: searchParams.get("startDate") || undefined,
      endDate: searchParams.get("endDate") || undefined,
    };
    const stats = await getPushStats(params);
    return NextResponse.json({ success: true, data: stats });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Gagal mengambil statistik push notif" },
      { status: 500 },
    );
  }
}
