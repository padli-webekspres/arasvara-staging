import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/db";
import { getUserFromRequest } from "@/lib/auth";
import { markOneRead } from "@/services/notificationService";
import logger from "@/lib/logger";

// ─── PATCH /api/notification/[id]/read ───────────────────────────────────────
// Tandai satu notifikasi sebagai sudah dibaca.

export async function PATCH(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const user = await getUserFromRequest(req);
		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { id } = await params;
		if (!id) {
			return NextResponse.json(
				{ error: "Notification ID is required" },
				{ status: 400 },
			);
		}

		const db = await connectToDatabase();
		const updated = await markOneRead(db, id, user._id.toString());

		if (!updated) {
			return NextResponse.json(
				{ error: "Notification not found or already read" },
				{ status: 404 },
			);
		}

		return NextResponse.json({ success: true });
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	} catch (error: any) {
		logger.error({ err: error }, "Error marking notification as read");
		return NextResponse.json(
			{ error: error?.message || "Internal server error" },
			{ status: 500 },
		);
	}
}
