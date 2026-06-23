import { getUserFromRequest } from "@/lib/auth";
import { ROLES } from "@/lib/auth-client";
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/db";
import {
	getCategoryByIdOrSlug,
	updateCategory,
	deleteCategory,
} from "@/services/categoryService";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/categories/[id]
export async function GET(req: NextRequest, { params }: RouteContext) {
	try {
		const { id } = await params;
		const db = await connectToDatabase();
		const result = await getCategoryByIdOrSlug(db, id);
		if (!result) {
			return NextResponse.json(
				{ error: "Category not found" },
				{ status: 404 },
			);
		}
		return NextResponse.json(result);
	} catch (error: any) {
		return NextResponse.json(
			{ error: error?.message || "Internal server error" },
			{ status: 500 },
		);
	}
}

// PATCH /api/categories/[id]
export async function PATCH(req: NextRequest, { params }: RouteContext) {
	try {
		const { id } = await params;
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
			const updatedCategory = await updateCategory(db, id, body, {
				_id: user._id,
				name: user.name,
				email: user.email,
			});
			return NextResponse.json({
				category: updatedCategory,
				status: "success",
			});
		} catch (err: any) {
			return NextResponse.json(
				{ error: err.message, message: err.message },
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

// DELETE /api/categories/[id]
export async function DELETE(req: NextRequest, { params }: RouteContext) {
	try {
		const { id } = await params;
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
		try {
			const result = await deleteCategory(db, id, {
				_id: user._id,
				name: user.name,
				email: user.email,
			});
			return NextResponse.json(result);
		} catch (err: any) {
			return NextResponse.json(
				{ error: err.message, message: err.message },
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
