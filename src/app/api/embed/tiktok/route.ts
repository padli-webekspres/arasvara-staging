import { NextRequest, NextResponse } from "next/server";
import {
  normalizeTikTokUrl,
  parseTikTokVideoId,
  tiktokOembedRequestUrl,
} from "@/lib/social-embed-url";
import logger from "@/lib/logger";

export type TikTokOembedPreview = {
  title: string | null;
  authorName: string | null;
  thumbnailUrl: string | null;
  canonicalUrl: string;
};

/**
 * GET /api/embed/tiktok?url=
 * Proxy oEmbed TikTok (thumbnail/judul) — browser tidak bisa fetch tiktok.com karena CORS.
 */
export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("url")?.trim() ?? "";
  const videoId = parseTikTokVideoId(raw);
  if (!videoId) {
    return NextResponse.json({ error: "URL TikTok tidak valid" }, { status: 400 });
  }

  const canonicalUrl = normalizeTikTokUrl(raw);

  try {
    const upstream = await fetch(tiktokOembedRequestUrl(canonicalUrl), {
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (compatible; Arasvara/1.0; +https://arasvara.id)",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { canonicalUrl, title: null, authorName: null, thumbnailUrl: null },
        { status: 200 },
      );
    }

    const data = (await upstream.json()) as {
      title?: string;
      author_name?: string;
      thumbnail_url?: string;
    };

    const preview: TikTokOembedPreview = {
      canonicalUrl,
      title: data.title?.trim() || null,
      authorName: data.author_name?.trim() || null,
      thumbnailUrl: data.thumbnail_url?.trim() || null,
    };

    return NextResponse.json(preview, {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
    });
  } catch (error) {
    logger.warn({ error, videoId }, "Gagal mengambil oEmbed TikTok");
    return NextResponse.json(
      { canonicalUrl, title: null, authorName: null, thumbnailUrl: null },
      { status: 200 },
    );
  }
}
