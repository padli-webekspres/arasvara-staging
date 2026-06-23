import type { NextRequest } from "next/server";

/** Host yang tidak boleh dipakai sebagai target redirect browser. */
const INVALID_REDIRECT_HOSTS = new Set(["0.0.0.0", "[::]", "::"]);

function firstHeaderValue(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.split(",")[0]?.trim();
  return trimmed || null;
}

function isValidRedirectHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase().trim();
  if (!normalized) return false;
  return !INVALID_REDIRECT_HOSTS.has(normalized);
}

function originFromHostHeader(
  host: string,
  request: NextRequest,
): string | null {
  try {
    const parsed = new URL(`http://${host}`);
    if (!isValidRedirectHost(parsed.hostname)) return null;

    const proto =
      firstHeaderValue(request.headers.get("x-forwarded-proto")) ||
      request.nextUrl.protocol.replace(":", "") ||
      "http";

    return parsed.port
      ? `${proto}://${parsed.hostname}:${parsed.port}`
      : `${proto}://${parsed.hostname}`;
  } catch {
    return null;
  }
}

function originFromEnvBaseUrl(): string | null {
  const base = process.env.NEXT_PUBLIC_BASE_URL?.trim();
  if (!base) return null;
  try {
    return new URL(base).origin;
  } catch {
    return null;
  }
}

function sanitizeNextUrlOrigin(request: NextRequest): string {
  const { protocol, hostname, port } = request.nextUrl;

  if (isValidRedirectHost(hostname)) {
    return request.nextUrl.origin;
  }

  const safeHost = "localhost";
  return port ? `${protocol}//${safeHost}:${port}` : `${protocol}//${safeHost}`;
}

/**
 * Origin absolut untuk redirect auth (proxy, refresh GET).
 * Prioritas: X-Forwarded-Host / Host → NEXT_PUBLIC_BASE_URL → nextUrl (sans 0.0.0.0).
 */
export function getRequestOrigin(request: NextRequest): string {
  const forwardedHost = firstHeaderValue(
    request.headers.get("x-forwarded-host"),
  );
  const hostHeader = request.headers.get("host")?.trim() || null;

  for (const host of [forwardedHost, hostHeader]) {
    if (!host) continue;
    const origin = originFromHostHeader(host, request);
    if (origin) return origin;
  }

  const envOrigin = originFromEnvBaseUrl();
  if (envOrigin) return envOrigin;

  return sanitizeNextUrlOrigin(request);
}

/** Bangun URL absolut dari path relatif + origin request yang aman. */
export function buildRequestUrl(
  path: string,
  request: NextRequest,
): URL {
  return new URL(path, getRequestOrigin(request));
}
