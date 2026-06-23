import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { registerPresignedMedia } from "@/services/mediaService";

/**
 * POST /api/media/finalize
 *
 * Daftarkan objek yang sudah berhasil di-PUT ke object storage via presigned URL
 * ke dalam koleksi `media` di MongoDB. Tidak melakukan upload ulang / Sharp.
 *
 * Body: { fileKey: string, size: number, caption?, credit?, watermark? }
 */
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { fileKey, size, caption, credit, watermark } = body as {
      fileKey?: string;
      size?: number;
      caption?: string;
      credit?: string;
      watermark?: boolean;
    };

    if (!fileKey || typeof fileKey !== "string" || fileKey.trim() === "") {
      return NextResponse.json(
        { error: "fileKey is required" },
        { status: 400 },
      );
    }

    if (typeof size !== "number" || size <= 0) {
      return NextResponse.json(
        { error: "size must be a positive number" },
        { status: 400 },
      );
    }

    const media = await registerPresignedMedia(fileKey, {
      size,
      caption,
      credit,
      watermark,
    });

    return NextResponse.json({ success: true, media }, { status: 201 });
  } catch (error: any) {
    const status = error?.status ?? 500;
    return NextResponse.json(
      { error: error?.message || "Failed to finalize media" },
      { status },
    );
  }
}
