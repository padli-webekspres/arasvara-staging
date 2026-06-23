import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { adminPanelBasePath } from "./lib/admin-panel-path";
import { isValidApiSecret } from "./lib/api-secret";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from "./lib/auth-config";
import { clearAuthCookiesEdge } from "./lib/auth-cookies";
import { buildRequestUrl } from "./lib/request-origin";

const PUBLIC_API_PATHS = [
  "/api/sitemap",
  "/api/auth/login",
  "/api/auth/refresh",
  "/api/media",
  "/api/publish-scheduled"
];

function isPublicApiPath(pathname: string): boolean {
  return PUBLIC_API_PATHS.some((path) => pathname.startsWith(path));
}

function guardApiSecret(request: NextRequest): NextResponse | null {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith("/api")) return null;
  if (isPublicApiPath(pathname)) return null;

  const clientSecret = request.headers.get("x-api-secret");
  if (!isValidApiSecret(clientSecret)) {
    return NextResponse.json(
      { error: "Forbidden: Kunci akses tidak valid atau tidak disertakan" },
      { status: 403 },
    );
  }

  return null;
}

async function isAccessTokenValid(token: string): Promise<boolean> {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) return false;
  try {
    await jwtVerify(token, new TextEncoder().encode(secret));
    return true;
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const secretGuardResponse = guardApiSecret(request);
  if (secretGuardResponse) return secretGuardResponse;

  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;

  const getFullPath = () => {
    const { pathname: p, search } = request.nextUrl;
    return p + (search || "");
  };

  const homeUrl = buildRequestUrl("/", request);

  if (pathname.startsWith(adminPanelBasePath)) {
    if (accessToken && (await isAccessTokenValid(accessToken))) {
      return NextResponse.next();
    }

    if (refreshToken) {
      const refreshUrl = buildRequestUrl("/api/auth/refresh", request);
      refreshUrl.searchParams.set("returnTo", getFullPath());
      return NextResponse.redirect(refreshUrl);
    }

    const fullPath = getFullPath();
    const loginWithRedirect = buildRequestUrl("/login", request);
    if (fullPath.startsWith("/")) {
      loginWithRedirect.searchParams.set("redirect", fullPath);
    }
    const response = NextResponse.redirect(loginWithRedirect);
    clearAuthCookiesEdge(response.cookies);
    return response;
  }

  if (pathname.startsWith("/login")) {
    if (accessToken && (await isAccessTokenValid(accessToken))) {
      return NextResponse.redirect(homeUrl);
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin-xyz/:path*", "/login", "/api/:path*"],
};
