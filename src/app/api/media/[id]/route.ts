import { getUserFromRequest } from "@/lib/auth";
import { ROLES } from "@/lib/auth-client";
import { connectToDatabase } from "@/lib/db/db";
import { updateMedia } from "@/services/mediaService";
import { NextRequest, NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

// PATCH /api/media/[id]
export async function PATCH(req: NextRequest, { params }: RouteContext) {
	try {
		const { id } = await params;
		const db = await connectToDatabase();
		const user = await getUserFromRequest(req);
		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}
		// Only ADMIN and EDITOR_IN_CHIEF can edit
		const allowedRoles = [ROLES.ADMIN, ROLES.EDITOR_IN_CHIEF];
		const userRole = user.role?.toLowerCase?.() || user.role;
		if (!allowedRoles.includes(userRole)) {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}
		const body = await req.json();
		const updatedMedia = await updateMedia(db, id, {
			caption: body.caption,
			credit: body.credit,
		}, {
			_id: user._id,
			name: user.name,
			email: user.email,
		});
		return NextResponse.json({
			media: updatedMedia,
			status: "success",
		});
	} catch (error: any) {
		// Tangani error dari service (sudah ada status)
		return NextResponse.json(
			{ error: error?.message || "Internal server error" },
			{ status: error?.status || 500 },
		);
	}
}
