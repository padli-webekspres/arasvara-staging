import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/db";
import { bulkApplyNavbarCategorySort } from "@/services/categoryService";
import { getUserFromRequest } from "@/lib/auth";
import { ROLES } from "@/lib/auth-client";

/** POST body: `{ items: { categoryId, showOnNavbar, order }[] }` — hanya kategori di navbar. */
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

    await bulkApplyNavbarCategorySort(db, rawItems, {
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
