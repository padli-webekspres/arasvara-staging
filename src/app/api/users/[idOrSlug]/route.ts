import { ROLES } from "@/lib/auth-client";
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/db";
import {
	editUser,
	getUserByIdOrEmail,
	softDeleteUser,
} from "@/services/userService";
import { getUserFromRequest } from "@/lib/auth";

export async function GET(
	req: NextRequest,
	context: { params: Promise<{ idOrSlug: string }> },
) {
	const { idOrSlug } = await context.params;
	if (!idOrSlug) {
		return NextResponse.json(
			{ error: "Missing user id or email" },
			{ status: 400 },
		);
	}
	try {
		const db = await connectToDatabase();
		const user = await getUserByIdOrEmail(db, idOrSlug);
		if (!user) {
			return NextResponse.json({ error: "User not found" }, { status: 404 });
		}
		return NextResponse.json({ user });
	} catch (error) {
		return NextResponse.json(
			{ error: (error as Error).message || "Internal server error" },
			{ status: 500 },
		);
	}
}

export async function DELETE(
	req: NextRequest,
	context: { params: Promise<{ idOrSlug: string }> },
) {
	try {
		const actorUser = await getUserFromRequest(req);
		if (!actorUser) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { idOrSlug } = await context.params;
		if (!idOrSlug) {
			return NextResponse.json(
				{ error: "User id is required" },
				{ status: 400 },
			);
		}
		const db = await connectToDatabase();
		const result = await softDeleteUser(db, idOrSlug, {
			_id: actorUser._id,
			name: actorUser.name,
			email: actorUser.email,
		});
		if (!result) {
			return NextResponse.json({ error: "User not found" }, { status: 404 });
		}
		return NextResponse.json({ success: true });
	} catch (error) {
		return NextResponse.json(
			{ error: (error as Error).message || "Internal server error" },
			{ status: 500 },
		);
	}
}

export async function PATCH(
	req: NextRequest,
	context: { params: Promise<{ idOrSlug: string }> },
) {
	const { idOrSlug } = await context.params;
	if (!idOrSlug) {
		return NextResponse.json(
			{ error: "User id or email is required" },
			{ status: 400 },
		);
	}
	try {
		const userLogin = await getUserFromRequest(req);
		if (!userLogin) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		// Cek role: hanya ADMIN & EDITOR_IN_CHIEF bisa edit siapa saja
		const canEditAnyone =
			userLogin.role === ROLES.ADMIN ||
			userLogin.role === ROLES.EDITOR_IN_CHIEF;

		// Jika bukan, hanya boleh edit dirinya sendiri
		let isSelf = false;
		if (!canEditAnyone) {
			// idOrSlug bisa _id atau email
			isSelf = idOrSlug === userLogin._id || idOrSlug === userLogin.email;
			if (!isSelf) {
				return NextResponse.json(
					{ error: "Forbidden: You can only edit your own profile" },
					{ status: 403 },
				);
			}
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
		const name = formData.get("name")?.toString().trim();
		const role = (formData.get("role")?.toString() ||
			"subscriber") as keyof typeof ROLES;
		const bio = formData.get("bio")?.toString() || undefined;
		// Ambil teamId (bisa kosong string untuk hapus tim)
		const teamIdRaw = formData.get("teamId");
		const teamId =
			teamIdRaw !== undefined && teamIdRaw !== null
				? teamIdRaw.toString()
				: undefined;
		// Jika user edit dirinya sendiri, abaikan perubahan isActive
		let isActive: boolean | undefined = undefined;
		if (!isSelf) {
			isActive =
				formData.get("isActive") !== undefined
					? formData.get("isActive") === "true"
					: undefined;
		}
		const avatar = formData.get("avatar");

		// Do not allow password or email update
		if (formData.has("password")) {
			return NextResponse.json(
				{ error: "Password cannot be updated here" },
				{ status: 400 },
			);
		}
		if (formData.has("email")) {
			return NextResponse.json(
				{ error: "Email cannot be updated here" },
				{ status: 400 },
			);
		}

		// Only accept File for avatar if present
		let avatarFile: File | null = null;
		if (avatar && typeof avatar === "object" && "arrayBuffer" in avatar) {
			avatarFile = avatar as File;
		}

		// At least one field must be provided
		if (
			!name &&
			!role &&
			!bio &&
			isActive === undefined &&
			!avatarFile &&
			teamId === undefined
		) {
			return NextResponse.json(
				{ error: "No fields to update" },
				{ status: 400 },
			);
		}

		const db = await connectToDatabase();
		const updatedUser = await editUser(
			db,
			idOrSlug,
			{
				name,
				role,
				bio,
				...(isActive !== undefined ? { isActive } : {}),
				avatar: avatarFile,
				teamId,
			},
			!isSelf,
			{
				_id: userLogin._id,
				name: userLogin.name,
				email: userLogin.email,
			},
		);

		// Remove password from response if present
		if (updatedUser.password) delete updatedUser.password;

		return NextResponse.json({ user: updatedUser });
	} catch (error) {
		return NextResponse.json(
			{ error: (error as Error).message || "Internal server error" },
			{ status: 500 },
		);
	}
}
