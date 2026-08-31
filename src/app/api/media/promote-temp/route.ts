import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { promoteTempMedia } from "@/services/mediaService";
import {
  articleUploadScopeToFolder,
  isAllowedArticleUploadFolder,
  type ArticleObjectStorageFolder,
} from "@/lib/media/articleUploadScopes";
import { isValidTempMediaId } from "@/lib/media/tempMedia";

/**
 * POST /api/media/promote-temp
 *
 * Promosikan media temp (`temp/{id}.webp`) ke folder final artikel
 * dan buat row di koleksi `media`. Dipanggil saat submit artikel
 * (featured / content / gallery) — payload artikel hanya berisi mediaId.
 *
 * Body: { tempMediaId, scope: "featured" | "content" | "gallery",
 *          caption?, credit?, watermark?, applyWatermark? }
 */
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { tempMediaId, scope: scopeRaw, folder: folderRaw, caption, credit, watermark, applyWatermark } = body as {
      tempMediaId?: unknown;
      scope?: unknown;
      folder?: unknown;
      caption?: string;
      credit?: string;
      watermark?: boolean;
      applyWatermark?: boolean;
    };

    if (!isValidTempMediaId(tempMediaId)) {
      return NextResponse.json(
        { error: "Invalid tempMediaId" },
        { status: 400 },
      );
    }

    const inputScopeOrFolder = scopeRaw ?? folderRaw;
    let folder: ArticleObjectStorageFolder | undefined =
      articleUploadScopeToFolder(inputScopeOrFolder);

    if (!folder && typeof inputScopeOrFolder === "string" && isAllowedArticleUploadFolder(inputScopeOrFolder)) {
      folder = inputScopeOrFolder;
    }

    if (!folder) {
      return NextResponse.json(
        { error: "Invalid scope or folder — use featured, content, gallery, media-library, socmed, avatars, or configuration" },
        { status: 400 },
      );
    }

    const media = await promoteTempMedia({
      tempMediaId,
      folder,
      caption: typeof caption === "string" ? caption : undefined,
      credit: typeof credit === "string" ? credit : undefined,
      watermark: typeof watermark === "boolean" ? watermark : undefined,
      applyWatermark: applyWatermark === true,
    });

    return NextResponse.json({ success: true, media }, { status: 201 });
  } catch (error) {
    const err = error as { status?: number; message?: string };
    const status = err?.status ?? 500;
    return NextResponse.json(
      { error: err?.message || "Failed to promote temp media" },
      { status },
    );
  }
}
