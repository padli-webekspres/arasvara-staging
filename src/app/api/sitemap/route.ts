import { NextResponse } from "next/server";
import { getSitemapData } from "@/services/sitemapService";

export async function GET() {
	try {
		const result = await getSitemapData();
		return NextResponse.json(result);
	} catch (error) {
		return NextResponse.json(
			{ error: (error as Error).message || "Internal server error" },
			{ status: 500 },
		);
	}
}
