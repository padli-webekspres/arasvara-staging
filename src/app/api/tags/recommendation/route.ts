import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { isApproverRole } from "@/lib/auth-client";
import { getRecommendedTags, updateRecommendedTags } from "@/services/tagsService";
import logger from "@/lib/logger";

/**
 * GET /api/tags/recommendation
 * Mengambil daftar rekomendasi tag terpopuler dari cache.
 * Akses publik (tidak perlu login).
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const limitParam = url.searchParams.get("limit") || "10";
    let limit = parseInt(limitParam, 10);
    
    if (isNaN(limit) || limit <= 0) {
      limit = 10;
    } else if (limit > 10) {
      limit = 10; // Maksimal hanya 10 tag terpopuler
    }

    const tags = await getRecommendedTags(limit);
    return NextResponse.json({ success: true, tags }, { status: 200 });
  } catch (error: any) {
    logger.error("Error fetching recommended tags:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tags/recommendation
 * Melakukan agregasi ulang dan memperbarui cache rekomendasi tag.
 * Terbatas untuk Admin dan Editorial (Editor, Head-of, Managing Editor, Editor-in-Chief).
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Hanya ijinkan role Approver (Editor ke atas) atau Admin yang bisa mentrigger update
    if (!isApproverRole(user.role)) {
      return NextResponse.json(
        { success: false, error: "Forbidden: insufficient permissions" },
        { status: 403 }
      );
    }

    const updatedTags = await updateRecommendedTags();
    
    return NextResponse.json(
      { 
        success: true, 
        message: "Rekomendasi tag berhasil diperbarui!", 
        totalTags: updatedTags.length 
      }, 
      { status: 200 }
    );
  } catch (error: any) {
    logger.error("Error updating recommended tags:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
