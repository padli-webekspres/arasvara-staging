import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/db";
import { getUsersByTeam } from "@/services/teamService";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/teams/:id/users
 * Mengambil daftar user berdasarkan teamId, mendukung pagination (page/limit) dan cursor.
 * Query: ?page=1&limit=10&cursor=xxx&search=nama
 */
export async function GET(req: NextRequest, { params }: RouteContext) {
	try {
		const { id } = await params;
		const db = await connectToDatabase();

		// Ambil query params
		const { searchParams } = new URL(req.url);
		const page = searchParams.get("page");
		const limit = searchParams.get("limit");
		const cursor = searchParams.get("cursor");
		const search = searchParams.get("search");

		try {
			const result = await getUsersByTeam(db, id, {
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
