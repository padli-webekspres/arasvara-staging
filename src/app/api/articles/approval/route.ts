import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/db";
import { getUserFromRequest } from "@/lib/auth";
import { getApprovalQueue } from "@/services/article/getArticleService";
import logger from "@/lib/logger";

// Allowed roles for approval queue
const APPROVER_ROLES = [
	"editor",
	"head-of",
	"managing-editor",
	"editor-in-chief",
	"admin",
];

export async function GET(req: NextRequest) {
	try {
		const user = await getUserFromRequest(req);
		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}
		const role = (user.role || "").toString().toLowerCase();
		const { searchParams } = new URL(req.url);
		const parsedLimit = Number.parseInt(searchParams.get("limit") || "10", 10);
		const parsedPage = Number.parseInt(searchParams.get("page") || "1", 10);
		const limit = Number.isFinite(parsedLimit)
			? Math.min(Math.max(parsedLimit, 1), 100)
			: 10;
		const page = Number.isFinite(parsedPage) ? Math.max(parsedPage, 1) : 1;
		const categorySlug = searchParams.get("category") || undefined;
		const search = searchParams.get("search") || undefined;
		const cursor = searchParams.get("cursor") || undefined;

		const db = await connectToDatabase();
		const isApprover = APPROVER_ROLES.includes(role);
		let authorId: string | undefined = undefined;
		let restrictToAuthorIfNotApprover = false;
		if (!isApprover) {
			// Hanya boleh akses approval queue milik sendiri
			restrictToAuthorIfNotApprover = true;
			authorId = user._id;
		}
		try {
			const { articles, nextCursor, total } = await getApprovalQueue(db, {
				limit,
				page,
				categorySlug,
				search,
				cursor,
				authorId,
				isApprover,
				restrictToAuthorIfNotApprover,
			});
			const totalPages = total && limit ? Math.ceil(total / limit) : 1;
			return NextResponse.json({ articles, nextCursor, total, totalPages });
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		} catch (err: any) {
			if (err?.status === 403) {
				return NextResponse.json(
					{ error: err.message || "Forbidden" },
					{ status: 403 },
				);
			}
			throw err;
		}
	} catch (error) {
		logger.error({ err: error }, "Error fetching approval queue");
		return NextResponse.json(
			{ error: (error as Error).message || "Internal server error" },
			{ status: 500 },
		);
	}
}
