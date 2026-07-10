import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/db";
import { getUserFromRequest } from "@/lib/auth";
import { ROLES } from "@/lib/auth-client";
import { listEditorActivities } from "@/services/analytics/editorActivityService";

const ALLOWED_ROLES = [
  ROLES.ADMIN,
  ROLES.EDITOR_IN_CHIEF,
  ROLES.MANAGING_EDITOR,
  ROLES.EDITOR,
  ROLES.HEAD_OF,
] as const;

function parsePositiveInt(raw: string | null, fallback: number): number {
  if (raw == null || raw === "") return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

function parseIsoDate(raw: string | null): Date | null {
  const s = raw?.trim();
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export async function GET(req: NextRequest) {
  try {
    const db = await connectToDatabase();
    const sessionUser = await getUserFromRequest(req);

    const roleOk =
      sessionUser?.role &&
      ALLOWED_ROLES.map((r) => r.toLowerCase()).includes(
        sessionUser.role.toLowerCase(),
      );

    if (!sessionUser || !roleOk) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const sp = req.nextUrl.searchParams;

    const skipRaw = parsePositiveInt(sp.get("skip"), 0);
    const limitRaw = parsePositiveInt(sp.get("limit"), 20);

    const search = sp.get("search") ?? undefined;
    const actionVal = sp.get("action")?.trim();
    const action = actionVal && actionVal !== "ALL" ? actionVal : undefined;
    const entityVal = sp.get("entity")?.trim();
    const entity = entityVal && entityVal !== "ALL" ? entityVal : undefined;
    const userId = sp.get("userId")?.trim() || undefined;

    const startDate = parseIsoDate(sp.get("startDate"));
    const endDate = parseIsoDate(sp.get("endDate"));

    const { data, total } = await listEditorActivities(db, {
      skip: Math.max(0, skipRaw),
      limit: limitRaw,
      search,
      action,
      entity,
      userId,
      createdFrom: startDate ?? undefined,
      createdTo: endDate ?? undefined,
    });

    return NextResponse.json({ data, total });
  } catch (err: unknown) {
    const status =
      typeof err === "object" &&
      err !== null &&
      "status" in err &&
      typeof (err as { status: unknown }).status === "number"
        ? (err as { status: number }).status
        : null;

    const message =
      err instanceof Error
        ? err.message
        : "Gagal memuat aktivitas redaksi";

    if (status === 400) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
