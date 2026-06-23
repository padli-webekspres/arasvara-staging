import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/db";
import {
  ensureAdClickEventIndexes,
  recordAdClick,
  type AdClickType,
} from "@/services/ads/adClickService";
import logger from "@/lib/logger";

let indexesEnsured = false;

/**
 * POST /api/ads/click
 * Mencatat klik iklan (publik, tanpa auth) untuk counter & tren dashboard AE.
 *
 * Body: `{ adId: string, adType: "homepage" | "article" }`
 */
export async function POST(req: NextRequest) {
  try {
    let body: Record<string, unknown> | null = null;
    try {
      const raw = await req.text();
      body = raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
    } catch {
      body = null;
    }
    const adId = typeof body?.adId === "string" ? body.adId.trim() : "";
    const adType = body?.adType as AdClickType;

    if (!adId) {
      return NextResponse.json(
        { success: false, error: "adId wajib diisi" },
        { status: 400 },
      );
    }

    if (adType !== "homepage" && adType !== "article") {
      return NextResponse.json(
        { success: false, error: "adType harus homepage atau article" },
        { status: 400 },
      );
    }

    const db = await connectToDatabase();

    if (!indexesEnsured) {
      await ensureAdClickEventIndexes(db);
      indexesEnsured = true;
    }

    const result = await recordAdClick(db, { adId, adType });

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.reason },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, "POST /api/ads/click gagal");
    return NextResponse.json(
      { success: false, error: "Gagal mencatat klik iklan" },
      { status: 500 },
    );
  }
}
