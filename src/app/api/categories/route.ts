import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/db";

import { getCategories, createCategory } from "@/services/categoryService";
import { getUserFromRequest } from "@/lib/auth";
import { ROLES } from "@/lib/auth-client";

export async function GET(req: NextRequest) {
	const db = await connectToDatabase();
	const url = new URL(req.url);
	const limit = parseInt(url.searchParams.get("limit") || "20");
	const page = parseInt(url.searchParams.get("page") || "1");
	const isRoot = url.searchParams.get("isRoot") === "true";
	const onlyShowOnNavbar = url.searchParams.get("onlyShowOnNavbar") === "true";
	const onlyFeatured = url.searchParams.get("onlyFeatured") === "true";
	const query =
		url.searchParams.get("query") || url.searchParams.get("search") || "";
	const withChildren = url.searchParams.get("child") === "true";
	const sortByParam = url.searchParams.get("sortBy") || "order";
	const sortBy = ["name", "order", "featuredOrder"].includes(sortByParam)
		? (sortByParam as "name" | "order" | "featuredOrder")
		: "order";

	const result = await getCategories(db, {
		limit,
		page,
		isRoot,
		onlyShowOnNavbar,
		onlyFeatured,
		query,
		withChildren,
		sortBy,
	});
	return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
	try {
		const db = await connectToDatabase();
		const user = await getUserFromRequest(req);
		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}
		if (
			![ROLES.ADMIN, ROLES.EDITOR_IN_CHIEF].includes(
				user.role?.toLowerCase?.() || user.role,
			)
		) {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}
		const body = await req.json();
		try {
			const category = await createCategory(db, body, {
				_id: user._id,
				name: user.name,
				email: user.email,
			});
			return NextResponse.json(category, { status: 201 });
		} catch (err: any) {
			return NextResponse.json(
				{ error: err.message },
				{ status: err.status || 400 },
			);
		}
	} catch (error: any) {
		return NextResponse.json(
			{ error: error?.message || "Internal server error" },
			{ status: 500 },
		);
	}
}
