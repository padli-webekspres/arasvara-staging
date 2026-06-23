import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/db";
import { getAllUsers } from "@/services/userService";
import { createUser } from "@/services/userService";
import { ROLES } from "@/lib/auth-client";
import { getUserFromRequest } from "@/lib/auth";
import { mapUserWriteError } from "@/lib/map-user-write-error";

// POST /api/users - create user with avatar upload, password hash, email unique
export async function POST(req: NextRequest) {
	try {
		const actorUser = await getUserFromRequest(req);
		if (!actorUser) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		// Only accept multipart/form-data
		const contentType = req.headers.get("content-type") || "";
		if (!contentType.includes("multipart/form-data")) {
			return NextResponse.json(
				{ error: "Content-Type must be multipart/form-data" },
				{ status: 400 },
			);
		}

		// Parse form data
		const formData = await req.formData();
		const email = formData.get("email")?.toString().trim().toLowerCase();
		const name = formData.get("name")?.toString().trim();
		const password = formData.get("password")?.toString();
		const role = (formData.get("role")?.toString() ||
			"subscriber") as keyof typeof ROLES;
		const bio = formData.get("bio")?.toString() || undefined;
		const teamId = formData.get("teamId")?.toString() || undefined;
		const isActive =
			formData.get("isActive") !== undefined
				? formData.get("isActive") === "true"
				: true;
		const avatar = formData.get("avatar");

		if (!email || !name || !password) {
			return NextResponse.json(
				{ error: "Missing required fields: email, name, password" },
				{ status: 400 },
			);
		}

		// Only accept File for avatar if present
		let avatarFile: File | null = null;
		if (avatar && typeof avatar === "object" && "arrayBuffer" in avatar) {
			avatarFile = avatar as File;
		}

		const db = await connectToDatabase();
		const user = await createUser(
			db,
			{
				email,
				name,
				password,
				role,
				bio,
				teamId,
				isActive,
				avatar: avatarFile,
			},
			{
				_id: actorUser._id,
				name: actorUser.name,
				email: actorUser.email,
			},
		);

		// Remove password from response
		if (user.password) delete user.password;

		return NextResponse.json({ user });
	} catch (error) {
		const { status, body } = mapUserWriteError(error);
		return NextResponse.json(body, { status });
	}
}

export async function GET(req: NextRequest) {
	try {
		const db = await connectToDatabase();
		const { searchParams } = new URL(req.url);
		const limit = parseInt(searchParams.get("limit") || "10");
		const page = parseInt(searchParams.get("page") || "1");
		const role = searchParams.get("role") || undefined;
		const search = searchParams.get("search") || undefined;
		const cursor = searchParams.get("cursor") || undefined;
		const team = searchParams.get("team") || undefined;

		const { users, nextCursor, total } = await getAllUsers(db, {
			limit,
			page,
			role,
			search,
			cursor,
			team,
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
