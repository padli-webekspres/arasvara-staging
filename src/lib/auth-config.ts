/** Nama cookie & TTL autentikasi — sumber tunggal. */

export const ACCESS_TOKEN_COOKIE = "access_token";
export const REFRESH_TOKEN_COOKIE = "refresh_token";
/** Cookie legacy — dihapus saat logout / clear session. */
export const LEGACY_TOKEN_COOKIE = "token";

export const ACCESS_TOKEN_MAX_AGE = 15 * 60; // 15 menit
export const REFRESH_TOKEN_MAX_AGE = 3 * 24 * 60 * 60; // 3 hari

export const JWT_ACCESS_EXPIRES_IN = "15m" as const;

export type AuthCookieOptions = {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax" | "strict" | "none";
  path: string;
  maxAge: number;
};

export function getAuthCookieOptions(maxAge: number): AuthCookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  };
}
