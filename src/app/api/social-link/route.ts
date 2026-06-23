import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/db";
import { getAllSocialLinks } from "@/services/socialLinkService";

export async function GET(req: NextRequest) {
  try {
    const db = await connectToDatabase();
    const links = await getAllSocialLinks(db);
    return NextResponse.json({ socialLinks: links });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Internal server error" },
      { status: 500 },
    );
  }
}
