import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/db";
import { getAllAuthors } from "@/services/userService";
import { ROLES } from "@/lib/auth-client";
export async function GET(req: NextRequest) {
	try {
		const db = await connectToDatabase();
		const { searchParams } = new URL(req.url);
		const limit = parseInt(searchParams.get("limit") || "10");
		const page = parseInt(searchParams.get("page") || "1");
		const search = searchParams.get("search") || undefined;
		const cursor = searchParams.get("cursor") || undefined;

		// Ambil data author
		const { users, nextCursor, total } = await getAllAuthors(db, {
			limit,
			page,
			cursor,
			search,
		});

		const totalPages = total && limit ? Math.ceil(total / limit) : 1;

		return NextResponse.json({ users, nextCursor, total, totalPages });
	} catch (error) {
		return NextResponse.json(
			{ error: (error as Error).message || "Internal server error" },
			{ status: 500 },
		);
	}
}
