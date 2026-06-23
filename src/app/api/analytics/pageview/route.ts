import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/db";
import { trackPageView } from "@/services/analytics";

export async function POST(req: NextRequest) {
  const db = await connectToDatabase();
  const body = await req.json();
  const { articleId } = body;
  if (!articleId) {
    return NextResponse.json(
      { error: "Article ID is required" },
      { status: 400 },
    );
  }
  try {
    const userAgent = req.headers.get("user-agent");
    const referrer = req.headers.get("referer");
    const result = await trackPageView(db, { articleId, userAgent, referrer });
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
