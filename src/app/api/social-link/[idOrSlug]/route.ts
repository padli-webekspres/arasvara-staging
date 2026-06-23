import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/db";
import { getSocialLinkByIdOrSlug } from "@/services/socialLinkService";

type Context = { params: Promise<{ idOrSlug: string }> };

export async function GET(req: NextRequest, context: Context) {
  try {
    const db = await connectToDatabase();
    const { idOrSlug } = await context.params;
    const link = await getSocialLinkByIdOrSlug(db, idOrSlug);
    if (!link) {
      return NextResponse.json(
        { error: "Social link not found" },
        { status: 404 },
      );
    }
    return NextResponse.json(link);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Internal server error" },
      { status: 500 },
    );
  }
}
