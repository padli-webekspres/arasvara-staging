import { NextRequest, NextResponse } from "next/server";
import { createPushSent } from "@/services/analytics/pushNotifService";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.notificationId || !body.userId) {
      return NextResponse.json(
        { error: "notificationId dan userId wajib diisi" },
        { status: 400 },
      );
    }
    const result = await createPushSent(body);
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Gagal menyimpan event push sent" },
      { status: 500 },
    );
  }
}
