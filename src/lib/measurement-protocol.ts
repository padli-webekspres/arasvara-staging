/**
 * Google Analytics 4 Measurement Protocol helper (server-side).
 *
 * Dipakai untuk mengirim event `view_article` dari server (/api/analytics/view-article)
 * sehingga tidak terpengaruh adblock dan lebih reliable daripada gtag browser.
 *
 * Docs: https://developers.google.com/analytics/devguides/collection/protocol/ga4
 *
 * Debug: set `GA_MP_DEBUG=true` di Vercel env → pakai endpoint
 * `https://www.google-analytics.com/debug/mp/collect` dan log validationMessages.
 */

const MP_ENDPOINT = "https://www.google-analytics.com/mp/collect";
const MP_DEBUG_ENDPOINT = "https://www.google-analytics.com/debug/mp/collect";

/** GA4 membatasi maks. 25 event parameter per event; nilai string maks. 100 karakter. */
const MP_MAX_PARAMS = 25;
const MP_MAX_STRING_LENGTH = 100;

/** Parameter yang boleh di-drop dulu jika melebihi batas 25 (redundan / prioritas rendah). */
const MP_PARAMS_DROP_PRIORITY = [
  "page_title",
  "category_id",
  "author_id",
  "page_location",
  "tag_3",
  "tag_2",
] as const;

export type MpEvent = {
  name: string;
  params: Record<string, unknown>;
};

type MpPayload = {
  client_id: string;
  user_id?: string;
  events: MpEvent[];
};

type MpValidationMessage = {
  fieldPath?: string;
  description?: string;
  validationCode?: string;
};

type MpDebugResponse = {
  validationMessages?: MpValidationMessage[];
};

export function isMpConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID && process.env.GA_MP_API_SECRET,
  );
}

function isMpDebugEnabled(): boolean {
  return process.env.GA_MP_DEBUG === "true";
}

function buildEndpointUrl(debug = false): string {
  const base = debug ? MP_DEBUG_ENDPOINT : MP_ENDPOINT;
  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? "";
  const apiSecret = process.env.GA_MP_API_SECRET ?? "";
  return `${base}?measurement_id=${measurementId}&api_secret=${apiSecret}`;
}

function truncateMpValue(value: unknown): unknown {
  if (typeof value === "string" && value.length > MP_MAX_STRING_LENGTH) {
    return value.slice(0, MP_MAX_STRING_LENGTH);
  }
  return value;
}

/**
 * Sanitasi parameter event agar memenuhi batas GA4 MP (≤25 param, string ≤100 char).
 */
export function sanitizeMpEventParams(
  params: Record<string, unknown>,
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    sanitized[key] = truncateMpValue(value);
  }

  const keys = Object.keys(sanitized);
  if (keys.length <= MP_MAX_PARAMS) return sanitized;

  const dropSet = new Set<string>(MP_PARAMS_DROP_PRIORITY);
  const kept: Record<string, unknown> = {};
  for (const key of keys) {
    if (!dropSet.has(key)) kept[key] = sanitized[key];
  }
  for (const key of keys) {
    if (dropSet.has(key) && Object.keys(kept).length < MP_MAX_PARAMS) {
      kept[key] = sanitized[key];
    }
  }
  return kept;
}

function sanitizeEvents(events: MpEvent[]): MpEvent[] {
  return events.map((event) => ({
    name: event.name,
    params: sanitizeMpEventParams(event.params),
  }));
}

function logMpDebugResponse(
  eventName: string,
  payload: MpPayload,
  body: MpDebugResponse,
): void {
  const messages = body.validationMessages ?? [];
  if (messages.length === 0) {
    console.info("[GA MP] debug OK — no validation errors", {
      event: eventName,
      client_id: payload.client_id,
      paramCount: Object.keys(payload.events[0]?.params ?? {}).length,
    });
    return;
  }

  console.error("[GA MP] debug validation errors", {
    event: eventName,
    client_id: payload.client_id,
    measurement_id: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
    paramCount: Object.keys(payload.events[0]?.params ?? {}).length,
    validationMessages: messages,
    payload,
  });
}

export type MpSendResult = {
  sent: boolean;
  debug: boolean;
  reason?: string;
  validationMessages?: MpValidationMessage[];
};

/**
 * Kirim satu atau lebih event ke GA4 via Measurement Protocol.
 *
 * - Non-blocking: panggil dengan `void sendMpEvent(...)` agar tidak menunda respons.
 * - Jika env tidak terkonfigurasi, no-op (tidak throw).
 * - `clientId` harus diisi dari cookie `_ga` browser; jika kosong, event tidak dikirim.
 * - `GA_MP_DEBUG=true` → endpoint debug + log validationMessages ke Vercel console.
 */
export async function sendMpEvent(
  clientId: string,
  events: MpEvent[],
  userId?: string,
  debug?: boolean,
): Promise<MpSendResult> {
  const useDebug = debug ?? isMpDebugEnabled();

  if (!isMpConfigured()) {
    const reason = "GA_MP not configured (missing NEXT_PUBLIC_GA_MEASUREMENT_ID or GA_MP_API_SECRET)";
    if (useDebug) console.warn("[GA MP] skip:", reason);
    return { sent: false, debug: useDebug, reason };
  }

  if (!clientId) {
    const reason = "client_id kosong — cookie _ga belum tersedia saat POST";
    if (useDebug) console.warn("[GA MP] skip:", reason);
    return { sent: false, debug: useDebug, reason };
  }

  if (events.length === 0) {
    return { sent: false, debug: useDebug, reason: "events array kosong" };
  }

  const sanitizedEvents = sanitizeEvents(events);
  const payload: MpPayload = {
    client_id: String(clientId),
    events: sanitizedEvents,
  };
  if (userId) {
    payload.user_id = String(userId);
  }

  try {
    const res = await fetch(buildEndpointUrl(useDebug), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const text = await res.text();

    if (useDebug) {
      let parsed: MpDebugResponse = {};
      try {
        parsed = JSON.parse(text) as MpDebugResponse;
      } catch {
        console.error("[GA MP] debug non-JSON response:", {
          status: res.status,
          text,
        });
        return {
          sent: false,
          debug: true,
          reason: "debug endpoint returned non-JSON",
        };
      }

      logMpDebugResponse(events[0]?.name ?? "unknown", payload, parsed);

      const hasErrors = (parsed.validationMessages?.length ?? 0) > 0;
      return {
        sent: !hasErrors,
        debug: true,
        validationMessages: parsed.validationMessages,
        reason: hasErrors ? "GA validation errors — lihat validationMessages" : undefined,
      };
    }

    if (!res.ok) {
      console.error("[GA MP] collect failed:", { status: res.status, text });
      return { sent: false, debug: false, reason: `HTTP ${res.status}` };
    }

    return { sent: true, debug: false };
  } catch (err) {
    console.error("[GA MP] sendMpEvent error:", err);
    return { sent: false, debug: useDebug, reason: String(err) };
  }
}
