import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/db";
import { updateTeam, deleteTeam } from "@/services/teamService";
import { getUserFromRequest } from "@/lib/auth";
import { ROLES } from "@/lib/auth-client";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PATCH /api/teams/[id]
 * Update tim berdasarkan ID. Name dan slug diupdate otomatis.
 */
export async function PATCH(req: NextRequest, { params }: RouteContext) {
	try {
		const { id } = await params;
		const db = await connectToDatabase();
		const user = await getUserFromRequest(req);

		// Check authentication
		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		// Check authorization - only EDITOR_IN_CHIEF and MANAGING_EDITOR
		const allowedRoles = [
			ROLES.ADMIN,
			ROLES.EDITOR_IN_CHIEF,
			ROLES.MANAGING_EDITOR,
		];
		if (!allowedRoles.includes(user.role?.toLowerCase?.() || user.role)) {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}

		const body = await req.json();

		try {
			const updatedTeam = await updateTeam(db, id, body);
			return NextResponse.json(updatedTeam, { status: 200 });
		} catch (err) {
			return NextResponse.json(
				{ error: (err as Error & { status?: number }).message },
				{ status: (err as Error & { status?: number }).status || 400 },
			);
		}
	} catch (error) {
		return NextResponse.json(
			{ error: (error as Error)?.message || "Internal server error" },
			{ status: 500 },
		);
	}
}

/**
 * DELETE /api/teams/[id]
 * Hapus tim berdasarkan ID. Cek apakah ada user yang tertaut ke tim ini.
 */
export async function DELETE(req: NextRequest, { params }: RouteContext) {
	try {
		const { id } = await params;
		const db = await connectToDatabase();
		const user = await getUserFromRequest(req);

		// Check authentication
		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		// Check authorization - only EDITOR_IN_CHIEF and MANAGING_EDITOR
		const allowedRoles = [
			ROLES.ADMIN,
			ROLES.EDITOR_IN_CHIEF,
			ROLES.MANAGING_EDITOR,
		];
		if (!allowedRoles.includes(user.role?.toLowerCase?.() || user.role)) {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}

		try {
			await deleteTeam(db, id);
			return NextResponse.json(
				{ message: "Tim berhasil dihapus" },
				{ status: 200 },
			);
		} catch (err) {
			return NextResponse.json(
				{ error: (err as Error & { status?: number }).message },
				{ status: (err as Error & { status?: number }).status || 400 },
			);
		}
	} catch (error) {
		return NextResponse.json(
			{ error: (error as Error)?.message || "Internal server error" },
			{ status: 500 },
		);
	}
}
