import { NextRequest, NextResponse } from "next/server";
import {
	getSelectedTopicById,
	deleteSelectedTopic,
} from "@/services/selectedTopicService";
import { getUserFromRequest } from "@/lib/auth";

export async function GET(
	req: NextRequest,
	context: { params: Promise<{ id: string }> },
) {
	try {
		const { id } = await context.params;
		const topic = await getSelectedTopicById(id);
		if (!topic) {
			return NextResponse.json(
				{ success: false, message: "Selected topic not found" },
				{ status: 404 },
			);
		}
		return NextResponse.json({ success: true, data: topic });
	} catch (error) {
		return NextResponse.json(
			{
				success: false,
				message: "Failed to fetch selected topic",
				error: (error as Error).message,
			},
			{ status: 500 },
		);
	}
}

export async function DELETE(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const user = await getUserFromRequest(req);
		if (!user) {
			return NextResponse.json(
				{ success: false, message: "Unauthorized" },
				{ status: 401 },
			);
		}
		const { id } = await params;
		const deleted = await deleteSelectedTopic(id);
		if (!deleted) {
			return NextResponse.json(
				{ success: false, message: "Selected topic not found" },
				{ status: 404 },
			);
		}
		return NextResponse.json({ success: true, data: deleted });
	} catch (error) {
		return NextResponse.json(
			{
				success: false,
				message: "Failed to delete selected topic",
				error: (error as Error).message,
			},
			{ status: 500 },
		);
	}
}
