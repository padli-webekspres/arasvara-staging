import { NextRequest, NextResponse } from "next/server";
import {
  isAllowedFacebookHost,
  isFacebookShareShortLink,
  normalizeFacebookUrl,
} from "@/lib/social-embed-url";
import logger from "@/lib/logger";

/**
 * GET /api/embed/facebook?url=
 * Pecah short link /share/v|p|r/ ke URL kanonikal (reel/video/post).
 */
export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("url")?.trim() ?? "";
  const start = normalizeFacebookUrl(raw);

  try {
    const parsed = new URL(start);
    if (!isAllowedFacebookHost(parsed.hostname)) {
      return NextResponse.json({ error: "URL bukan Facebook" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "URL tidak valid" }, { status: 400 });
  }

  if (!isFacebookShareShortLink(start)) {
    return NextResponse.json({ url: start });
  }

  try {
    const upstream = await fetch(start, {
      method: "GET",
      redirect: "follow",
      headers: {
        Accept: "text/html",
        "User-Agent":
          "Mozilla/5.0 (compatible; Arasvara/1.0; +https://arasvara.id)",
      },
      signal: AbortSignal.timeout(8000),
    });

    const resolved = normalizeFacebookUrl(upstream.url || start);
    const resolvedHost = new URL(resolved).hostname;
    if (!isAllowedFacebookHost(resolvedHost)) {
      return NextResponse.json({ url: start });
    }

    return NextResponse.json(
      { url: resolved },
      {
        headers: {
          "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
        },
      },
    );
  } catch (error) {
    logger.warn({ error }, "Gagal resolve short link Facebook");
    return NextResponse.json({ url: start });
  }
}
