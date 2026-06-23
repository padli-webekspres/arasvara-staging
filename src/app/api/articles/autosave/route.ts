import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/db";
import { getUserFromRequest } from "@/lib/auth";
import { autosaveArticle } from "@/services/article/writeArticleService";
import { mapArticleWriteError } from "@/lib/map-article-write-error";

export async function POST(req: NextRequest) {
	try {
		const user = await getUserFromRequest(req);
		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const db = await connectToDatabase();
		const body = await req.json();

		const result = await autosaveArticle(db, body, user);
		return NextResponse.json(result);
	} catch (error: unknown) {
		const { status, body } = mapArticleWriteError(error);
		return NextResponse.json(body, { status });
	}
}
