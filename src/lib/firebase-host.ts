/** Host lokal/LAN yang memakai Firebase project dev (arasvara-web). */
export function isLocalFirebaseDevHost(hostname?: string): boolean {
  const host =
    hostname ??
    (typeof window !== "undefined" ? window.location.hostname : "");
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    /^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)
  );
}

/**
 * Push/FCM web hanya berjalan di secure context (HTTPS atau localhost).
 * IP LAN via HTTP (mis. http://192.168.x.x) tidak memenuhi syarat browser.
 */
export function isSecurePushContext(): boolean {
  if (typeof window === "undefined") return false;
  return window.isSecureContext;
}

/** Pesan singkat jika lingkungan browser tidak bisa meminta izin push. */
export function getPushEnvironmentIssue(): string | null {
  if (typeof window === "undefined") return null;

  if (!isSecurePushContext()) {
    return "Push notification memerlukan HTTPS atau localhost. Buka http://localhost:3000/admin-xyz (bukan IP LAN HTTP).";
  }

  if (
    !("Notification" in window) ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window)
  ) {
    return "Browser ini tidak mendukung notifikasi web push.";
  }

  return null;
}
