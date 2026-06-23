import { NextRequest, NextResponse } from "next/server";
import {
  getAllSelectedTopics,
  createSelectedTopic,
} from "@/services/selectedTopicService";
import { getUserFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 },
      );
    }
    const topics = await getAllSelectedTopics(user._id);
    return NextResponse.json({ success: true, data: topics });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch selected topics",
        error: (error as Error).message,
      },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 },
      );
    }
    const body = await req.json();
    if (!body.categoryId) {
      return NextResponse.json(
        { success: false, message: "categoryId is required" },
        { status: 400 },
      );
    }
    const topic = await createSelectedTopic({
      categoryId: body.categoryId,
      selectedBy: user._id,
    });
    return NextResponse.json({ success: true, data: topic }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: "Failed to create selected topic",
        error: (error as Error).message,
      },
      { status: 500 },
    );
  }
}
