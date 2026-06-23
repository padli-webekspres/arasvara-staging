import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { uploadMedia } from "@/services/mediaService";

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const result = await uploadMedia(file);
    return NextResponse.json({ success: true, fileName: result.fileName });
  } catch (error) {
    const message = (error as Error).message;
    if (message === "Unsupported file type") {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error("S3 Upload Error:", error);
    return NextResponse.json(
      { error: "Upload failed", details: message },
      { status: 500 },
    );
  }
}
