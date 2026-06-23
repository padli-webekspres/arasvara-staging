import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/db";
import {
  bulkApplyFeaturedCategorySort,
  getFeaturedCategoriesWithLatestArticles,
} from "@/services/categoryService";
import { getUserFromRequest } from "@/lib/auth";
import { ROLES } from "@/lib/auth-client";

/**
 * GET `/api/categories/featured`
 * Mengambil daftar kategori unggulan beserta 4 artikel terbaru masing-masing secara efisien.
 * Endpoint ini bersifat publik (untuk digunakan di halaman depan).
 */
export async function GET() {
  try {
    const db = await connectToDatabase();
    const result = await getFeaturedCategoriesWithLatestArticles(db, 4);
    return NextResponse.json(result, {
      status: 200,
      headers: {
        "Cache-Control": "s-maxage=60, stale-while-revalidate=30",
      },
    });
  } catch (err: unknown) {
    const e = err as { message?: string };
    return NextResponse.json(
      { error: e?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST `/api/categories/featured`
 * body: `{ items: { categoryId, featured, featuredOrder }[] }`
 * Mengatur status unggulan dan urutannya secara massal.
 * Hanya dapat diakses oleh Admin atau Editor-in-Chief.
 */
export async function POST(req: NextRequest) {
  try {
    const db = await connectToDatabase();
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const roleNorm = user.role?.toLowerCase?.() || user.role;
    if (![ROLES.ADMIN, ROLES.EDITOR_IN_CHIEF].includes(roleNorm)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const body = await req.json();
    const rawItems = body?.items;

    await bulkApplyFeaturedCategorySort(db, rawItems, {
      _id: user._id,
      name: user.name,
      email: user.email,
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number };
    const msg = typeof e?.message === "string" ? e.message : "Internal server error";
    const status = typeof e?.status === "number" ? e.status : 500;
    if (status >= 400 && status < 500) {
      return NextResponse.json({ error: msg }, { status });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
