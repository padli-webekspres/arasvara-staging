import { getUserFromRequest } from "@/lib/auth";
import { ROLES } from "@/lib/auth-client";
import { getMediaUsageSplit } from "@/services/mediaService";
import { NextRequest, NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/media/[id]/usage
 * Admin only — daftar artikel yang memakai media (blocking vs safe).
 */
export async function GET(req: NextRequest, { params }: RouteContext) {
	try {
		const { id } = await params;
		const user = await getUserFromRequest(req);
		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const userRole = (user.role?.toLowerCase?.() || user.role || "").toString();
		if (userRole !== ROLES.ADMIN.toLowerCase()) {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}

		if (!/^[a-f\d]{24}$/i.test(id)) {
			return NextResponse.json({ error: "Invalid media ID" }, { status: 400 });
		}

		const usage = await getMediaUsageSplit(id);
		return NextResponse.json({
			success: true,
			blockingArticles: usage.blockingArticles,
			safeArticles: usage.safeArticles,
		});
	} catch (error: unknown) {
		const err = error as { message?: string; status?: number };
		return NextResponse.json(
			{ error: err?.message || "Internal server error" },
			{ status: err?.status || 500 },
		);
	}
}
