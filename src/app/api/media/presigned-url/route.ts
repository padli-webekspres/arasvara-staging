import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { parseArticleUploadScopeForPresign } from "@/lib/media/articleUploadScopes";
import { getPresignedUploadUrl } from "@/services/mediaService";

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { filename, contentType, articleUploadScope } = body as {
      filename?: string;
      contentType?: string;
      /** featured | content | gallery — dipetakan ke folder bucket (whitelist). Opsional untuk kompatibilitas. */
      articleUploadScope?: string;
    };

    if (!filename || !contentType) {
      return NextResponse.json(
        { error: "filename and contentType are required" },
        { status: 400 },
      );
    }

    let objectFolder:
      | ReturnType<typeof parseArticleUploadScopeForPresign>
      | undefined;
    try {
      objectFolder = parseArticleUploadScopeForPresign(articleUploadScope);
    } catch {
      return NextResponse.json(
        {
          error:
            "Invalid articleUploadScope — use featured, content, or gallery",
        },
        { status: 400 },
      );
    }

    const result = await getPresignedUploadUrl(filename, contentType, {
      objectFolder,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = (error as Error).message;
    if (
      message === "Unsupported file type" ||
      message === "Invalid object folder for presigned upload"
    ) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error("Presigned URL error:", error);
    return NextResponse.json(
      { error: "Failed to generate presigned URL", details: message },
      { status: 500 },
    );
  }
}
