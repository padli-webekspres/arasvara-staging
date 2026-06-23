import { NextResponse } from "next/server";
import { getAccessTokenFromCookieStore, getUserFromToken } from "@/lib/auth";

export async function GET() {
  try {
    const token = await getAccessTokenFromCookieStore();
    if (!token) {
      return NextResponse.json({ user: null, loggedIn: false });
    }
    const user = await getUserFromToken(token);
    if (!user) {
      return NextResponse.json({ user: null, loggedIn: false });
    }
    return NextResponse.json({ user, loggedIn: true });
  } catch {
    return NextResponse.json({ user: null, loggedIn: false });
  }
}
