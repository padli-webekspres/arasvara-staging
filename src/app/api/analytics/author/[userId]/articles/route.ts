import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/db";
import { getUserFromRequest } from "@/lib/auth";
import { getAuthorArticles } from "@/services/analytics/authorAnalyticService";

export async function GET(
	req: NextRequest,
	context: { params: Promise<{ userId: string }> },
) {
	try {
		// Auth: Only allow logged-in user
		const user = await getUserFromRequest(req);
		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { userId } = await context.params;
		const db = await connectToDatabase();
		const result = await getAuthorArticles(db, userId);
		if (!result) {
			return NextResponse.json(
				{ error: "User or articles not found" },
				{ status: 404 },
			);
		}
		return NextResponse.json(result);
	} catch (error) {
		return NextResponse.json(
			{ error: (error as Error).message || "Internal server error" },
			{ status: 500 },
		);
	}
}
