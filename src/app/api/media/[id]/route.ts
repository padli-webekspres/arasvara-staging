import { getUserFromRequest } from "@/lib/auth";
import { ROLES } from "@/lib/auth-client";
import { connectToDatabase } from "@/lib/db/db";
import logger from "@/lib/logger";
import { hardDeleteMediaIfUnused, updateMedia } from "@/services/mediaService";
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
		const updatedMedia = await updateMedia(
			db,
			id,
			{
				caption: body.caption,
				credit: body.credit,
			},
			{
				_id: user._id,
				name: user.name,
				email: user.email,
			},
		);
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

/**
 * DELETE /api/media/[id]
 * Hard delete (DB + object storage) — hanya admin, hanya jika tidak dipakai artikel aktif.
 */
export async function DELETE(req: NextRequest, { params }: RouteContext) {
	let mediaId = "unknown";
	try {
		const { id } = await params;
		mediaId = id;
		const user = await getUserFromRequest(req);
		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const userRole = (
			user.role?.toLowerCase?.() ||
			user.role ||
			""
		).toString();
		if (userRole !== ROLES.ADMIN.toLowerCase()) {
			logger.warn(
				{ mediaId, role: userRole, userId: user._id },
				"DELETE /api/media/[id]: forbidden — hanya admin",
			);
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}

		const db = await connectToDatabase();
		await hardDeleteMediaIfUnused(db, id, {
			_id: user._id,
			name: user.name,
			email: user.email,
		});

		return NextResponse.json({
			success: true,
			message: "Media berhasil dihapus.",
		});
	} catch (error: unknown) {
		const err = error as {
			message?: string;
			status?: number;
			blockingArticles?: unknown;
		};
		const status = err?.status || 500;

		if (status === 409) {
			logger.warn(
				{ mediaId, message: err?.message },
				"DELETE /api/media/[id]: diblokir (media masih dipakai)",
			);
		} else if (status >= 500) {
			logger.error(
				{ err, mediaId },
				"DELETE /api/media/[id]: gagal",
			);
		} else {
			logger.warn(
				{ mediaId, status, message: err?.message },
				"DELETE /api/media/[id]: ditolak",
			);
		}

		return NextResponse.json(
			{
				error: err?.message || "Internal server error",
				...(err?.blockingArticles
					? { blockingArticles: err.blockingArticles }
					: {}),
			},
			{ status },
		);
	}
}
