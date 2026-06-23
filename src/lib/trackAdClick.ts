/**
 * Fire-and-forget pencatatan klik iklan (tidak memblokir navigasi pengguna).
 */
export function trackAdClick(
  adId: string,
  adType: "homepage" | "article",
): void {
  const id = adId?.trim();
  if (!id) return;

  try {
    const payload = JSON.stringify({ adId: id, adType });
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      const blob = new Blob([payload], { type: "application/json" });
      navigator.sendBeacon("/api/ads/click", blob);
      return;
    }
  } catch {
    // fallback ke fetch
  }

  void fetch("/api/ads/click", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ adId: id, adType }),
    keepalive: true,
  }).catch(() => {
    /* abaikan — analitik tidak boleh mengganggu UX */
  });
}
