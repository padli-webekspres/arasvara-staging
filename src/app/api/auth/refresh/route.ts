import { NextRequest, NextResponse } from "next/server";
import {
  getRefreshTokenFromRequest,
  refreshAuthSession,
} from "@/lib/auth";
import {
  clearAuthCookiesOnResponse,
  setAuthCookiesOnResponse,
} from "@/lib/auth-cookies";
import { adminPanelHref } from "@/lib/admin-panel-path";
import { buildRequestUrl } from "@/lib/request-origin";

function safeReturnTo(returnTo: string | null, request: NextRequest): string {
  if (returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")) {
    return returnTo;
  }
  return adminPanelHref();
}

async function handleRefresh(request: NextRequest) {
  const refreshRaw = getRefreshTokenFromRequest(request);
  if (!refreshRaw) {
    return { ok: false as const };
  }

  const session = await refreshAuthSession(refreshRaw);
  if (!session) {
    return { ok: false as const };
  }

  return {
    ok: true as const,
    accessToken: session.accessToken,
    refreshRaw: session.refreshRaw,
    user: session.user,
  };
}

export async function POST(request: NextRequest) {
  const result = await handleRefresh(request);
  if (!result.ok) {
    const res = NextResponse.json(
      { error: "Sesi tidak valid", loggedIn: false },
      { status: 401 },
    );
    clearAuthCookiesOnResponse(res);
    return res;
  }

  const res = NextResponse.json({ success: true, loggedIn: true });
  setAuthCookiesOnResponse(res, result.accessToken, result.refreshRaw);
  return res;
}

export async function GET(request: NextRequest) {
  const returnTo = request.nextUrl.searchParams.get("returnTo");
  const result = await handleRefresh(request);

  if (!result.ok) {
    const loginUrl = buildRequestUrl("/login", request);
    const path = safeReturnTo(returnTo, request);
    if (path !== adminPanelHref()) {
      loginUrl.searchParams.set("redirect", path);
    }
    const res = NextResponse.redirect(loginUrl);
    clearAuthCookiesOnResponse(res);
    return res;
  }

  const redirectUrl = buildRequestUrl(safeReturnTo(returnTo, request), request);
  const res = NextResponse.redirect(redirectUrl);
  setAuthCookiesOnResponse(res, result.accessToken, result.refreshRaw);
  return res;
}
