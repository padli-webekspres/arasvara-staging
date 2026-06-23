import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { canManageAdsHomepage } from "@/lib/ads-homepage-access";
import logger from "@/lib/logger";
import type {
  AdsHomepageFinalizeRequestBody,
  AdsHomepagePresignRequestBody,
} from "@/types/ads";
import { AdsManagementService } from "@/services/ads/AdsHomepageService";

function parseMediaBody(
  json: unknown,
): AdsHomepagePresignRequestBody | AdsHomepageFinalizeRequestBody | null {
  if (!json || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;

  if (o.action === "presign") {
    if (typeof o.filename !== "string" || typeof o.contentType !== "string") {
      return null;
    }
    return {
      action: "presign",
      filename: o.filename,
      contentType: o.contentType,
    };
  }

  if (o.action === "finalize") {
    if (typeof o.fileKey !== "string") return null;
    return { action: "finalize", fileKey: o.fileKey };
  }

  return null;
}

/**
 * POST /api/ads/media
 *
 * Dua aksi dalam satu endpoint:
 * - `{ "action": "presign", "filename": "...", "contentType": "image/jpeg" }`
 *   → Hasilkan presigned PUT URL ke `ads/homepage/incoming/...`.
 * - `{ "action": "finalize", "fileKey": "ads/homepage/incoming/..." }`
 *   → Konversi ke WebP dengan Sharp, simpan ke `ads/homepage/`, hapus incoming.
 */
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageAdsHomepage(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let parsed: ReturnType<typeof parseMediaBody>;
  try {
    parsed = parseMediaBody(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!parsed) {
    return NextResponse.json(
      {
        error:
          'Body tidak valid. Gunakan action "presign" (filename, contentType) atau "finalize" (fileKey).',
      },
      { status: 400 },
    );
  }

  try {
    if (parsed.action === "presign") {
      const result = await AdsManagementService.generatePresignedUrl(
        parsed.filename,
        parsed.contentType,
      );
      return NextResponse.json({ success: true, ...result }, { status: 200 });
    }

    const result = await AdsManagementService.finalizeMedia(parsed.fileKey);
    return NextResponse.json({ success: true, ...result }, { status: 200 });
  } catch (error: unknown) {
    const err = error as Error & { status?: number };
    const status = typeof err.status === "number" ? err.status : 500;
    logger.error({ err, userId: user._id }, "POST /api/ads/media failed");
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status },
    );
  }
}
