const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isPrivateIpv4(hostname: string): boolean {
  return (
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname) ||
    /^169\.254\./.test(hostname)
  );
}

function toPublicOrigin(rawUrl: string | undefined): string | null {
  if (!rawUrl) return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    const hostname = url.hostname.toLowerCase();
    if (LOCAL_HOSTS.has(hostname) || isPrivateIpv4(hostname)) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function getPublicStorageOrigins(): string[] {
  const candidates = [
    process.env.NEXT_PUBLIC_STORAGE_MEDIA,
    process.env.NEXT_PUBLIC_STORAGE_CONFIGURATION,
  ];

  const origins = candidates
    .map((value) => toPublicOrigin(value))
    .filter((origin): origin is string => Boolean(origin));

  return [...new Set(origins)];
}
