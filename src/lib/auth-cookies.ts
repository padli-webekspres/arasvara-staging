import type { NextResponse } from "next/server";
import {
  ACCESS_TOKEN_COOKIE,
  ACCESS_TOKEN_MAX_AGE,
  getAuthCookieOptions,
  LEGACY_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_MAX_AGE,
} from "@/lib/auth-config";

type CookieStoreLike = {
  set: (
    name: string,
    value: string,
    options: ReturnType<typeof getAuthCookieOptions>,
  ) => void;
  delete: (name: string) => void;
};

function applyAuthCookies(
  store: CookieStoreLike,
  accessToken: string,
  refreshRaw: string,
): void {
  store.set(
    ACCESS_TOKEN_COOKIE,
    accessToken,
    getAuthCookieOptions(ACCESS_TOKEN_MAX_AGE),
  );
  store.set(
    REFRESH_TOKEN_COOKIE,
    refreshRaw,
    getAuthCookieOptions(REFRESH_TOKEN_MAX_AGE),
  );
}

export function setAuthCookies(
  store: CookieStoreLike,
  accessToken: string,
  refreshRaw: string,
): void {
  applyAuthCookies(store, accessToken, refreshRaw);
}

export function setAuthCookiesOnResponse(
  response: NextResponse,
  accessToken: string,
  refreshRaw: string,
): void {
  const optsAccess = getAuthCookieOptions(ACCESS_TOKEN_MAX_AGE);
  const optsRefresh = getAuthCookieOptions(REFRESH_TOKEN_MAX_AGE);
  response.cookies.set(ACCESS_TOKEN_COOKIE, accessToken, optsAccess);
  response.cookies.set(REFRESH_TOKEN_COOKIE, refreshRaw, optsRefresh);
}

export function clearAuthCookies(store: CookieStoreLike): void {
  for (const name of [
    ACCESS_TOKEN_COOKIE,
    REFRESH_TOKEN_COOKIE,
    LEGACY_TOKEN_COOKIE,
  ]) {
    store.delete(name);
  }
}

export function clearAuthCookiesOnResponse(response: NextResponse): void {
  const expired = { path: "/", maxAge: 0 };
  response.cookies.set(ACCESS_TOKEN_COOKIE, "", expired);
  response.cookies.set(REFRESH_TOKEN_COOKIE, "", expired);
  response.cookies.set(LEGACY_TOKEN_COOKIE, "", expired);
}

/** Cookie jar middleware (Edge). */
export function clearAuthCookiesEdge(cookies: {
  delete: (name: string) => void;
}): void {
  cookies.delete(ACCESS_TOKEN_COOKIE);
  cookies.delete(REFRESH_TOKEN_COOKIE);
  cookies.delete(LEGACY_TOKEN_COOKIE);
}
