import { NextRequest, NextResponse } from "next/server";
import { getAvatarViewStream } from "@/services/mediaService";

export async function GET(req: NextRequest) {
	const { searchParams } = new URL(req.url);
	const key = searchParams.get("key");

	if (!key) {
		return NextResponse.json(
			{ error: "Missing 'key' query parameter" },
			{ status: 400 },
		);
	}

	try {
		const { body, contentType, contentLength } = await getAvatarViewStream(key);
		return new NextResponse(body, {
			headers: {
				"Content-Type": contentType,
				...(contentLength && { "Content-Length": contentLength.toString() }),
				"Cache-Control": "public, max-age=31536000, immutable",
			},
		});
	} catch (error) {
		console.error("Error proxying avatar from MinIO:", error);
		return NextResponse.json(
			{ error: "Failed to fetch avatar" },
			{ status: 500 },
		);
	}
}
