import { NextRequest, NextResponse } from "next/server";
import { resolvePublicMediaUrl } from "@/lib/media/public-media-url";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key");

  if (!key) {
    return NextResponse.json(
      { error: "Missing 'key' query parameter" },
      { status: 400 },
    );
  }

  let decodedKey: string;
  try {
    decodedKey = decodeURIComponent(key);
  } catch {
    decodedKey = key;
  }

  const cdnUrl = resolvePublicMediaUrl(decodedKey);
  if (!cdnUrl) {
    console.error(
      "media/view redirect gagal: key tidak valid atau NEXT_PUBLIC_STORAGE_MEDIA kosong",
      { key: decodedKey },
    );
    return NextResponse.json(
      { error: "Media not found or CDN not configured" },
      { status: 404 },
    );
  }

  return NextResponse.redirect(cdnUrl, 302);
}
