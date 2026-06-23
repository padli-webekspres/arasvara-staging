import { getApprovalQueueArticleByIdOrSlug } from "@/services/article/getArticleService";
import { isApproverRole } from "@/lib/auth-client";
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { ApprovalPayload, ArticleStatus } from "@/types/article";
import { connectToDatabase } from "@/lib/db/db";
import { approveArticleStatus } from "@/services/article/writeArticleService";

export async function PATCH(
	req: NextRequest,
	context: { params: Promise<{ idOrSlug: string }> },
) {
	try {
		const db = await connectToDatabase();
		const user = await getUserFromRequest(req);
		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}
		const { idOrSlug } = await context.params;
		const body = await req.json();
		const {
			status,
			scheduledAt,
			reason,
			authorId,
			editorId,
			contributorIds,
		} = body as ApprovalPayload & Record<string, unknown>;
		if (!status || !(status in ArticleStatus)) {
			return NextResponse.json(
				{ error: "Invalid or missing status" },
				{ status: 400 },
			);
		}
		const article = await approveArticleStatus(
			db,
			idOrSlug,
			{
				status,
				scheduledAt,
				reason,
				authorId,
				editorId,
				contributorIds: Array.isArray(contributorIds)
					? contributorIds
					: undefined,
			},
			user,
		);
		return NextResponse.json({ article });

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	} catch (err: any) {
		const status = err.status || 500;
		return NextResponse.json(
			{ error: err.message || "Internal server error" },
			{ status },
		);
	}
}
export async function GET(
	req: NextRequest,
	context: { params: Promise<{ idOrSlug: string }> },
) {
	try {
		const db = await connectToDatabase();
		const user = await getUserFromRequest(req);
		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}
		const { idOrSlug } = await context.params;
		const isApprover = isApproverRole(user.role);
		// Non-approver hanya boleh akses milik sendiri
		const restrictToAuthorIfNotApprover = true;
		const article = await getApprovalQueueArticleByIdOrSlug(db, idOrSlug, {
			authorId: user._id,
			isApprover,
			restrictToAuthorIfNotApprover,
		});
		return NextResponse.json({ article });
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	} catch (err: any) {
		const status = err.status || 500;
		return NextResponse.json(
			{ error: err.message || "Internal server error" },
			{ status },
		);
	}
}
