import { NextRequest, NextResponse } from "next/server";
import {
  addArticleView,
  incrementArticleViewCount,
} from "@/services/analytics/viewArticleService";
import { ArticleView } from "@/types/analytics/viewArticle";
import { ObjectId } from "mongodb";
import { ACCESS_TOKEN_COOKIE } from "@/lib/auth-config";
import { getUserFromRequest } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db/db";

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    if (!data.articleId) {
      return NextResponse.json(
        { error: "articleId is required" },
        { status: 400 },
      );
    }

    // Get userId from JWT (if available)
    let userId: ObjectId | undefined = undefined;
    try {
      const user = await getUserFromRequest(req);
      if (user?._id) {
        userId = new ObjectId(user._id);
      }
    } catch (e) {
      // Ignore if user not available
    }

    let sessionId: string | undefined = undefined;
    try {
      const cookie = req.cookies.get(ACCESS_TOKEN_COOKIE);
      if (cookie && typeof cookie.value === "string") sessionId = cookie.value;
    } catch (e) {
      // Ignore if not available
    }

    // Get IP address from request
    let ip: string | undefined = undefined;
    try {
      ip =
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        req.headers.get("x-real-ip") ||
        undefined;
    } catch (e) {
      // Ignore if not available
    }

    const view: ArticleView = {
      articleId: new ObjectId(data.articleId),
      userId,
      sessionId,
      ip,
      userAgent: data.userAgent,
      referrer: data.referrer,
      viewedAt: data.viewedAt ? new Date(data.viewedAt) : new Date(),
    };

    // Simpan log view
    const savedView = await addArticleView(view);
    try {
      // Increment viewCount
      await incrementArticleViewCount(data.articleId);
    } catch (err: any) {
      // Compensating action: rollback log view jika increment gagal
      try {
        const db = await connectToDatabase();
        // Ensure _id is ObjectId for the filter
        const _id =
          typeof savedView._id === "string"
            ? new ObjectId(savedView._id)
            : savedView._id;
        await db.collection("article_views").deleteOne({ _id });
      } catch (rollbackErr) {
        // Log rollback error, tapi tetap utamakan error utama
        console.error("Rollback log view gagal:", rollbackErr);
      }
      return NextResponse.json(
        {
          error:
            err.message ||
            "Failed to increment viewCount, log view rolled back",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, view: savedView });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 },
    );
  }
}
