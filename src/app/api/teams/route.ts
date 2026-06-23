import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/db";
import { createTeam, getTeams } from "@/services/teamService";
import { getUserFromRequest } from "@/lib/auth";
import { ROLES } from "@/lib/auth-client";

/**
 * GET /api/teams
 * Mengambil daftar tim dengan dukungan pagination (page/limit), cursor, dan fuzzy search.
 * Query: ?page=1&limit=10&cursor=xxx&search=nama
 */
export async function GET(req: NextRequest) {
	try {
		const db = await connectToDatabase();

		// Ambil query parameters
		const { searchParams } = new URL(req.url);
		const page = searchParams.get("page");
		const limit = searchParams.get("limit");
		const cursor = searchParams.get("cursor");
		const search = searchParams.get("search");

		try {
			const result = await getTeams(db, {
				page: page ? Number(page) : undefined,
				limit: limit ? Number(limit) : undefined,
				cursor: cursor || undefined,
				search: search || undefined,
			});
			return NextResponse.json(result, { status: 200 });
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

export async function POST(req: NextRequest) {
	try {
		const db = await connectToDatabase();
		const user = await getUserFromRequest(req);
		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}
		// Only allow EDITOR_IN_CHIEF and MANAGING_EDITOR
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
			const team = await createTeam(db, body);
			return NextResponse.json(team, { status: 201 });
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
