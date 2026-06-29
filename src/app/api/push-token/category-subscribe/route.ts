import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/db";
import { getUserFromRequest } from "@/lib/auth";
import {
  saveCategoryPushSubscription,
  savePushToken,
} from "@/services/pushNotifService";
import logger from "@/lib/logger";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// POST /api/push-token/category-subscribe — subscribe push per kategori (guest atau login)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = typeof body.token === "string" ? body.token.trim() : "";
    const categorySlug =
      typeof body.categorySlug === "string"
        ? body.categorySlug.trim().toLowerCase()
        : "";

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    if (!categorySlug || !SLUG_PATTERN.test(categorySlug)) {
      return NextResponse.json(
        { error: "Invalid categorySlug" },
        { status: 400 },
      );
    }

    const db = await connectToDatabase();
    const category = await db
      .collection("categories")
      .findOne({ slug: categorySlug }, { projection: { _id: 1, slug: 1 } });

    if (!category) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 },
      );
    }

    const user = await getUserFromRequest(req);
    const userAgent = req.headers.get("user-agent") ?? undefined;

    if (user) {
      await savePushToken(db, user._id.toString(), token, userAgent);
    }

    const subscribed = await saveCategoryPushSubscription(db, {
      token,
      categorySlug,
      userId: user?._id?.toString() ?? null,
      userAgent,
    });

    if (!subscribed) {
      return NextResponse.json(
        {
          error:
            "Gagal subscribe ke topic kategori. Periksa konfigurasi Firebase server.",
        },
        { status: 503 },
      );
    }

    logger.info(
      {
        categorySlug,
        userId: user?._id?.toString() ?? null,
      },
      "Category push subscription registered",
    );

    return NextResponse.json({
      success: true,
      categorySlug,
      topic: `cat-${categorySlug}`,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    logger.error({ err: error }, "Error subscribing category push");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
