import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { deleteMedia } from "@/services/mediaService";
import { connectToDatabase } from "@/lib/db/db";

/**
 * POST /api/media/cleanup
 *
 * Hapus objek dari object storage (R2/S3) dan dokumen terkait dari koleksi `media`
 * di MongoDB berdasarkan daftar fileKey. Digunakan untuk rollback ketika upload
 * berhasil tapi penyimpanan artikel gagal.
 *
 * Body: { fileKeys: string[] }
 */
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { fileKeys } = body as { fileKeys?: string[] };

    if (!Array.isArray(fileKeys) || fileKeys.length === 0) {
      return NextResponse.json(
        { error: "fileKeys must be a non-empty array" },
        { status: 400 },
      );
    }

    const db = await connectToDatabase();
    let deleted = 0;

    await Promise.allSettled(
      fileKeys.map(async (key) => {
        if (!key || typeof key !== "string") return;

        // Hapus dari object storage (best-effort)
        try {
          await deleteMedia(key);
        } catch {
          // Abaikan error jika objek tidak ditemukan di storage
        }

        // Hapus dokumen dari koleksi media jika ada
        try {
          const result = await db
            .collection("media")
            .deleteOne({ filename: key });
          if (result.deletedCount > 0) deleted++;
        } catch {
          // Abaikan error DB — kemungkinan finalize belum sempat dijalankan
        }
      }),
    );

    return NextResponse.json({ success: true, deleted });
  } catch (error: any) {
    const status = error?.status ?? 500;
    return NextResponse.json(
      { error: error?.message || "Cleanup failed" },
      { status },
    );
  }
}
