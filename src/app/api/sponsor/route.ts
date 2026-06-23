import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getSponsors, upsertSponsors } from "@/services/sponsor/sponsorService";
import logger from "@/lib/logger";
import { connectToDatabase } from "@/lib/db/db";

/**
 * GET /api/sponsor
 *
 * Ambil daftar sponsor
 *
 * Response: Array sponsor
 */
export async function GET() {
  try {
    const db = await connectToDatabase();
    const result = await getSponsors(db);
    return NextResponse.json({ data: result }, { status: 200 });
  } catch (error) {
    logger.error({ error }, "Error in GET /api/sponsor");
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/sponsor
 *
 * Upsert daftar sponsor (Bulk Replace)
 * Menghapus semua sponsor lama dan menggantinya dengan yang baru.
 * Otomatis menghapus image S3 yang sudah tidak terpakai.
 *
 * Request: { sponsors: [{ name, image_url }] }
 * Authorization: Logged in user
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      logger.warn("Unauthorized attempt to upsert sponsors");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const db = await connectToDatabase();

    const result = await upsertSponsors(db, body, {
      _id: user._id,
      name: user.name,
      email: user.email,
    });

    return NextResponse.json(
      {
        message: "Sponsors berhasil diupdate",
        data: result,
      },
      { status: 200 },
    );
  } catch (error: any) {
    logger.error({ error }, "Error in POST /api/sponsor");
    const status = error.status || 500;
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status },
    );
  }
}
