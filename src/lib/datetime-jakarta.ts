import { DateTime } from "luxon";

export const JAKARTA_ZONE = "Asia/Jakarta";

/** Parse ISO string or JS Date as UTC instant → Luxon DateTime (invalid-safe). */
export function toLuxonUtc(
  dateValue: string | Date | null | undefined,
): DateTime | null {
  if (dateValue == null || dateValue === "") return null;

  const dt =
    dateValue instanceof Date
      ? DateTime.fromJSDate(dateValue, { zone: "utc" })
      : DateTime.fromISO(String(dateValue), { zone: "utc" });

  return dt.isValid ? dt : null;
}

/** Instant → Asia/Jakarta DateTime. */
export function toJakartaDateTime(
  dateValue: string | Date | null | undefined,
): DateTime | null {
  const utc = toLuxonUtc(dateValue);
  if (!utc) return null;
  return utc.setZone(JAKARTA_ZONE);
}

/** Format tanggal penuh di WIB (mis. 19 Juli 2026). */
export function formatDateReadableJakarta(
  dateValue: string | Date,
  locale = "id-ID",
): string {
  const dt = toJakartaDateTime(dateValue);
  if (!dt) return "";
  return dt.setLocale(locale).toLocaleString(DateTime.DATE_FULL);
}

/** Format tanggal + jam di WIB (mis. 19 Juli 2026, 22:35). */
export function formatDateTimeReadableJakarta(
  dateValue: string | Date,
  locale = "id-ID",
): string {
  const dt = toJakartaDateTime(dateValue);
  if (!dt) return "";
  return dt.setLocale(locale).toFormat("d MMMM yyyy, HH:mm");
}

/** Format jam di WIB dengan suffix " WIB" (mis. 22:35 WIB). */
export function formatTimeReadableJakarta(
  dateValue: string | Date,
  locale = "id-ID",
): string {
  const dt = toJakartaDateTime(dateValue);
  if (!dt) return "";
  return dt.setLocale(locale).toFormat("HH:mm") + " WIB";
}

/**
 * Parse `datetime-local` value (`yyyy-MM-ddTHH:mm`) sebagai wall-clock WIB → UTC Date.
 * Seconds/ms di-zero; menit dibulatkan ke bawah kelipatan 5 jika roundMinutes=true (default false).
 */
export function parseDatetimeLocalAsWib(
  datetimeLocal: string,
  options?: { roundTo5Minutes?: boolean },
): Date | null {
  const trimmed = datetimeLocal?.trim();
  if (!trimmed) return null;

  const [datePart, timePart] = trimmed.split("T");
  if (!datePart || !timePart) return null;

  const [year, month, day] = datePart.split("-").map(Number);
  const timeBits = timePart.split(":");
  const hour = Number(timeBits[0]);
  let minute = Number(timeBits[1]);

  if (
    [year, month, day, hour, minute].some(
      (n) => typeof n !== "number" || Number.isNaN(n),
    )
  ) {
    return null;
  }

  if (options?.roundTo5Minutes) {
    minute = Math.floor(minute / 5) * 5;
  }

  const dt = DateTime.fromObject(
    { year, month, day, hour, minute, second: 0, millisecond: 0 },
    { zone: JAKARTA_ZONE },
  );

  if (!dt.isValid) return null;
  return dt.toUTC().toJSDate();
}

/**
 * UTC instant → string untuk input `datetime-local` (wall-clock WIB).
 */
export function formatDatetimeLocalFromUtc(
  dateValue: string | Date | null | undefined,
): string {
  const dt = toJakartaDateTime(dateValue);
  if (!dt) return "";
  return dt.toFormat("yyyy-MM-dd'T'HH:mm");
}

/**
 * Round `datetime-local` wall-clock string ke kelipatan 5 menit (tetap WIB wall-clock).
 */
export function roundDatetimeLocalTo5Minutes(datetimeLocal: string): string {
  const trimmed = datetimeLocal?.trim();
  if (!trimmed) return "";

  const parsed = parseDatetimeLocalAsWib(trimmed, { roundTo5Minutes: true });
  if (!parsed) return trimmed;
  return formatDatetimeLocalFromUtc(parsed);
}

/** Safe ISO string for metadata (null if invalid). */
export function toIsoStringOrNull(
  dateValue: string | Date | null | undefined,
): string | null {
  if (dateValue == null || dateValue === "") return null;
  const d =
    dateValue instanceof Date ? dateValue : new Date(String(dateValue));
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export type ArticleDateModifiedSource = {
  contentUpdatedAt?: string | Date | null;
  publishedAt?: string | Date | null;
  createdAt?: string | Date | null;
};

/**
 * Tanggal untuk dateModified / modifiedTime:
 * contentUpdatedAt → publishedAt → createdAt.
 */
export function resolveArticleDateModified(
  article: ArticleDateModifiedSource,
): string | null {
  return (
    toIsoStringOrNull(article.contentUpdatedAt) ??
    toIsoStringOrNull(article.publishedAt) ??
    toIsoStringOrNull(article.createdAt)
  );
}
