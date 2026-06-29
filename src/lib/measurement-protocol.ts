/**
 * Google Analytics 4 Measurement Protocol helper (server-side).
 *
 * Dipakai untuk mengirim event `view_article` dari server (/api/analytics/view-article)
 * sehingga tidak terpengaruh adblock dan lebih reliable daripada gtag browser.
 *
 * Docs: https://developers.google.com/analytics/devguides/collection/protocol/ga4
 */

const MP_ENDPOINT = "https://www.google-analytics.com/mp/collect";
const MP_DEBUG_ENDPOINT = "https://www.google-analytics.com/debug/mp/collect";

export type MpEvent = {
  name: string;
  params: Record<string, unknown>;
};

type MpPayload = {
  client_id: string;
  user_id?: string;
  events: MpEvent[];
};

function isMpConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID && process.env.GA_MP_API_SECRET,
  );
}

function buildEndpointUrl(debug = false): string {
  const base = debug ? MP_DEBUG_ENDPOINT : MP_ENDPOINT;
  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? "";
  const apiSecret = process.env.GA_MP_API_SECRET ?? "";
  return `${base}?measurement_id=${measurementId}&api_secret=${apiSecret}`;
}

/**
 * Kirim satu atau lebih event ke GA4 via Measurement Protocol.
 *
 * - Non-blocking: panggil dengan `void sendMpEvent(...)` agar tidak menunda respons.
 * - Jika env tidak terkonfigurasi, no-op (tidak throw).
 * - `clientId` harus diisi dari cookie `_ga` browser; jika kosong, event tidak dikirim.
 */
export async function sendMpEvent(
  clientId: string,
  events: MpEvent[],
  userId?: string,
  debug = false,
): Promise<void> {
  if (!isMpConfigured()) return;
  if (!clientId || events.length === 0) return;

  const payload: MpPayload = {
    client_id: clientId,
    events,
  };
  if (userId) {
    payload.user_id = userId;
  }

  try {
    const res = await fetch(buildEndpointUrl(debug), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (debug && !res.ok) {
      const text = await res.text();
      console.error("[GA MP] debug response:", text);
    }
  } catch (err) {
    console.error("[GA MP] sendMpEvent error:", err);
  }
}
