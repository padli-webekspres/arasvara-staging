import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { deleteMedia } from "@/services/mediaService";

export async function DELETE(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const filename = searchParams.get("filename");

  if (!filename) {
    return NextResponse.json(
      { error: "filename is required" },
      { status: 400 },
    );
  }

  try {
    await deleteMedia(filename);
    return NextResponse.json({
      success: true,
      message: "File deleted successfully",
      deletedFile: filename,
    });
  } catch (error) {
    console.error("S3 Delete Error:", error);
    return NextResponse.json(
      { error: "Failed to delete file", details: (error as Error).message },
      { status: 500 },
    );
  }
}
