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

/**
 * Cookie `Secure` harus mengikuti protokol, bukan `NODE_ENV`.
 * `next start` selalu production — di HTTP LAN (192.168.x.x) browser menolak
 * Set-Cookie Secure, login “berhasil” tapi session tidak tersimpan.
 */
export function shouldUseSecureAuthCookies(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  if (env.AUTH_COOKIE_SECURE === "true") return true;
  if (env.AUTH_COOKIE_SECURE === "false") return false;

  const base = env.NEXT_PUBLIC_BASE_URL?.trim() ?? "";
  if (base.startsWith("http://")) return false;
  if (base.startsWith("https://")) return true;

  return env.NODE_ENV === "production";
}

export function getAuthCookieOptions(maxAge: number): AuthCookieOptions {
  return {
    httpOnly: true,
    secure: shouldUseSecureAuthCookies(),
    sameSite: "lax",
    path: "/",
    maxAge,
  };
}

const AUTH_COOKIE_NAMES = [
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  LEGACY_TOKEN_COOKIE,
] as const;

/** Cookie auth httpOnly — cek di server, jangan baca document.cookie. */
export function cookieJarHasAuthSession(
  getValue: (name: string) => string | undefined,
): boolean {
  return AUTH_COOKIE_NAMES.some((name) => Boolean(getValue(name)?.trim()));
}
