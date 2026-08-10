import { DateTime } from "luxon";
import { ObjectId } from "mongodb";
import { JAKARTA_ZONE } from "@/lib/datetime-jakarta";

export type AttributionMode = "consumption" | "publish_cohort";
export type ReferrerClass = "search" | "social" | "direct" | "internal_admin" | "other";

export interface PeriodBounds {
  /** Inclusive start (UTC Date) */
  start: Date;
  /** Exclusive end (UTC Date) */
  end: Date;
  /** Period label, e.g. YYYY-MM or YYYY-MM-DD..YYYY-MM-DD */
  label: string;
  zone: typeof JAKARTA_ZONE;
}

export interface PreviousPeriodBounds extends PeriodBounds {
  previous: PeriodBounds;
}

const PERIOD_MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const RANGE_PRESETS = new Set(["7d", "30d", "90d", "this_year"]);

/** Max inclusive calendar days for custom ranges (safety). */
export const MAX_RANGE_DAYS = 366;

export function isValidPeriodMonth(period: string): boolean {
  if (!PERIOD_MONTH_RE.test(period)) return false;
  const [y, m] = period.split("-").map(Number);
  const dt = DateTime.fromObject({ year: y, month: m, day: 1 }, { zone: JAKARTA_ZONE });
  return dt.isValid;
}

/**
 * Monthly period bounds in Asia/Jakarta.
 * Example: 2026-08 → [2026-08-01 00:00 WIB, 2026-09-01 00:00 WIB)
 */
export function getMonthBoundsWib(period: string): PeriodBounds {
  if (!isValidPeriodMonth(period)) {
    throw new Error(`Invalid period '${period}'. Expected YYYY-MM.`);
  }
  const [year, month] = period.split("-").map(Number);
  const start = DateTime.fromObject(
    { year, month, day: 1, hour: 0, minute: 0, second: 0, millisecond: 0 },
    { zone: JAKARTA_ZONE },
  );
  const end = start.plus({ months: 1 });
  return {
    start: start.toUTC().toJSDate(),
    end: end.toUTC().toJSDate(),
    label: period,
    zone: JAKARTA_ZONE,
  };
}

/** Previous calendar month with same length semantics. */
export function getPreviousMonthBoundsWib(period: string): PreviousPeriodBounds {
  const current = getMonthBoundsWib(period);
  const [year, month] = period.split("-").map(Number);
  const prev = DateTime.fromObject(
    { year, month, day: 1 },
    { zone: JAKARTA_ZONE },
  ).minus({ months: 1 });
  const previous = getMonthBoundsWib(prev.toFormat("yyyy-MM"));
  return { ...current, previous };
}

/**
 * Resolve range presets or explicit from/to (YYYY-MM-DD) as WIB day bounds.
 * End day is inclusive in UI; stored as exclusive next-day start.
 */
export function resolveRangeBoundsWib(options: {
  range?: string | null;
  from?: string | null;
  to?: string | null;
  now?: Date;
}): PeriodBounds {
  const now = options.now
    ? DateTime.fromJSDate(options.now, { zone: "utc" }).setZone(JAKARTA_ZONE)
    : DateTime.now().setZone(JAKARTA_ZONE);

  if (options.from || options.to) {
    const fromStr = options.from?.trim();
    const toStr = options.to?.trim();
    if (!fromStr || !toStr) {
      throw new Error("Parameter 'from' dan 'to' harus diisi bersamaan (YYYY-MM-DD).");
    }
    const start = DateTime.fromISO(fromStr, { zone: JAKARTA_ZONE }).startOf("day");
    const endDay = DateTime.fromISO(toStr, { zone: JAKARTA_ZONE }).startOf("day");
    if (!start.isValid || !endDay.isValid) {
      throw new Error("Format tanggal from/to tidak valid. Gunakan YYYY-MM-DD.");
    }
    if (endDay < start) {
      throw new Error("Parameter 'to' tidak boleh sebelum 'from'.");
    }
    const days = endDay.diff(start, "days").days + 1;
    if (days > MAX_RANGE_DAYS) {
      throw new Error(`Rentang tanggal maksimal ${MAX_RANGE_DAYS} hari.`);
    }
    const end = endDay.plus({ days: 1 });
    return {
      start: start.toUTC().toJSDate(),
      end: end.toUTC().toJSDate(),
      label: `${fromStr}..${toStr}`,
      zone: JAKARTA_ZONE,
    };
  }

  const range = (options.range || "30d").trim();
  if (!RANGE_PRESETS.has(range)) {
    throw new Error("Parameter 'range' tidak valid. Gunakan 7d, 30d, 90d, atau this_year.");
  }

  let start: DateTime;
  const endExclusive = now.startOf("day").plus({ days: 1 });

  if (range === "this_year") {
    start = now.startOf("year");
  } else {
    const days = Number(range.replace("d", ""));
    start = endExclusive.minus({ days });
  }

  const fromLabel = start.toFormat("yyyy-MM-dd");
  const toLabel = endExclusive.minus({ days: 1 }).toFormat("yyyy-MM-dd");

  return {
    start: start.toUTC().toJSDate(),
    end: endExclusive.toUTC().toJSDate(),
    label: `${fromLabel}..${toLabel}`,
    zone: JAKARTA_ZONE,
  };
}

/** Equal-length previous window immediately before `bounds`. */
export function getPreviousEqualBounds(bounds: PeriodBounds): PreviousPeriodBounds {
  const start = DateTime.fromJSDate(bounds.start, { zone: "utc" });
  const end = DateTime.fromJSDate(bounds.end, { zone: "utc" });
  const durationMs = end.toMillis() - start.toMillis();
  const prevEnd = start;
  const prevStart = DateTime.fromMillis(start.toMillis() - durationMs, { zone: "utc" });
  const previous: PeriodBounds = {
    start: prevStart.toJSDate(),
    end: prevEnd.toJSDate(),
    label: `${prevStart.setZone(JAKARTA_ZONE).toFormat("yyyy-MM-dd")}..${prevEnd
      .setZone(JAKARTA_ZONE)
      .minus({ days: 1 })
      .toFormat("yyyy-MM-dd")}`,
    zone: JAKARTA_ZONE,
  };
  return { ...bounds, previous };
}

export function parseAttributionMode(
  value: string | null | undefined,
): AttributionMode {
  if (!value || value === "consumption") return "consumption";
  if (value === "publish_cohort") return "publish_cohort";
  throw new Error(
    "Parameter 'attribution' harus 'consumption' atau 'publish_cohort'.",
  );
}

/** Classify referrer for public audience mix. */
export function classifyReferrer(referrer: string | null | undefined): ReferrerClass {
  const raw = (referrer ?? "").trim().toLowerCase();
  if (!raw) return "direct";

  if (
    raw.includes("/admin-xyz") ||
    raw.includes("localhost") && raw.includes("admin")
  ) {
    return "internal_admin";
  }

  try {
    const host = new URL(raw.startsWith("http") ? raw : `https://${raw}`).hostname
      .replace(/^www\./, "");
    if (
      host.includes("google.") ||
      host === "google.com" ||
      host.includes("bing.") ||
      host.includes("yahoo.") ||
      host.includes("duckduckgo.") ||
      host.includes("googleusercontent") ||
      raw.includes("android-app://com.google")
    ) {
      return "search";
    }
    if (
      host.includes("facebook.") ||
      host.includes("fb.") ||
      host.includes("instagram.") ||
      host.includes("threads.") ||
      host.includes("twitter.") ||
      host.includes("x.com") ||
      host.includes("t.co") ||
      host.includes("tiktok.") ||
      host.includes("linkedin.") ||
      host.includes("youtube.")
    ) {
      return "social";
    }
  } catch {
    // fall through
  }

  if (raw.includes("/admin-xyz")) return "internal_admin";
  return "other";
}

export function isPublicReferrer(referrer: string | null | undefined): boolean {
  return classifyReferrer(referrer) !== "internal_admin";
}

/** Mongo match fragment: exclude admin preview traffic when referrer present. */
export function publicViewReferrerMatch(): Record<string, unknown> {
  return {
    $or: [
      { referrer: { $exists: false } },
      { referrer: null },
      { referrer: "" },
      {
        referrer: {
          $not: { $regex: "/admin-xyz", $options: "i" },
        },
      },
    ],
  };
}

export function safePercent(
  numerator: number,
  denominator: number,
  digits = 2,
): number {
  if (!denominator || !Number.isFinite(denominator) || denominator <= 0) return 0;
  if (!Number.isFinite(numerator)) return 0;
  const value = (numerator / denominator) * 100;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function momGrowthRate(
  current: number,
  previous: number,
  digits = 1,
): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  if (previous === 0) {
    if (current === 0) return 0;
    return null; // undefined growth from zero baseline
  }
  return safePercent(current - previous, previous, digits);
}

export function roundNumber(value: number, digits = 1): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function toObjectIdOrNull(value: unknown): ObjectId | null {
  if (value instanceof ObjectId) return value;
  if (typeof value === "string" && ObjectId.isValid(value)) {
    return new ObjectId(value);
  }
  return null;
}

/** Match authorId stored as ObjectId or string. */
export function authorIdMatch(ids: Array<string | ObjectId>): Record<string, unknown> {
  const objectIds: ObjectId[] = [];
  const strings: string[] = [];
  for (const id of ids) {
    const oid = toObjectIdOrNull(id);
    if (oid) objectIds.push(oid);
    strings.push(String(id));
  }
  return {
    $or: [
      { authorId: { $in: objectIds } },
      { authorId: { $in: strings } },
    ],
  };
}

export function parsePagination(options: {
  page?: string | null;
  limit?: string | null;
  defaultLimit?: number;
  maxLimit?: number;
}): { page: number; limit: number; skip: number } {
  const defaultLimit = options.defaultLimit ?? 20;
  const maxLimit = options.maxLimit ?? 100;
  const page = Math.max(1, Number.parseInt(options.page || "1", 10) || 1);
  const limit = Math.min(
    maxLimit,
    Math.max(1, Number.parseInt(options.limit || String(defaultLimit), 10) || defaultLimit),
  );
  return { page, limit, skip: (page - 1) * limit };
}

export function parseSort(
  sort: string | null | undefined,
  allowlist: readonly string[],
  fallback: string,
): string {
  if (sort && allowlist.includes(sort)) return sort;
  return fallback;
}

export function currentPeriodMonthWib(now = new Date()): string {
  return DateTime.fromJSDate(now, { zone: "utc" })
    .setZone(JAKARTA_ZONE)
    .toFormat("yyyy-MM");
}

export const WRITER_ROLES = ["reporter", "writer", "contributor"] as const;
export const EDITOR_ROLES = ["editor"] as const;

export const DEFAULT_SLA_MINUTES = 120;

export type TargetStatus = "set" | "unset";

export interface TargetDisplay {
  status: TargetStatus;
  value: number | null;
  scopeLabel: string;
  achievementRate: number | null;
}

/** Individual target is never derived from GLOBAL site target. */
export function buildUnsetIndividualTarget(
  siteOrChannelContext?: { label: string; value: number | null },
): TargetDisplay & { contextValue: number | null; contextLabel: string } {
  return {
    status: "unset",
    value: null,
    scopeLabel: "individual",
    achievementRate: null,
    contextValue: siteOrChannelContext?.value ?? null,
    contextLabel: siteOrChannelContext?.label ?? "site",
  };
}

export function buildSiteTargetDisplay(
  actual: number,
  targetValue: number | null | undefined,
): TargetDisplay {
  if (targetValue == null || targetValue <= 0) {
    return {
      status: "unset",
      value: null,
      scopeLabel: "GLOBAL",
      achievementRate: null,
    };
  }
  return {
    status: "set",
    value: targetValue,
    scopeLabel: "GLOBAL",
    achievementRate: safePercent(actual, targetValue),
  };
}

export function buildChannelTargetDisplay(
  actual: number,
  targetValue: number | null | undefined,
): TargetDisplay {
  if (targetValue == null || targetValue <= 0) {
    return {
      status: "unset",
      value: null,
      scopeLabel: "CHANNEL",
      achievementRate: null,
    };
  }
  return {
    status: "set",
    value: targetValue,
    scopeLabel: "CHANNEL",
    achievementRate: safePercent(actual, targetValue),
  };
}

/** Category node used for root rollup. */
export type CategoryTreeNode = {
  _id: string | ObjectId;
  parentId?: string | ObjectId | null;
};

/**
 * Build map: every categoryId → its root categoryId (walk parentId until null).
 * Orphan / missing parents resolve to themselves.
 */
export function buildCategoryRootMap(
  categories: CategoryTreeNode[],
): Map<string, string> {
  const byId = new Map<string, CategoryTreeNode>();
  for (const cat of categories) {
    byId.set(String(cat._id), cat);
  }

  const rootMap = new Map<string, string>();

  function resolveRoot(id: string, visiting = new Set<string>()): string {
    if (rootMap.has(id)) return rootMap.get(id)!;
    if (visiting.has(id)) return id; // cycle guard
    visiting.add(id);

    const node = byId.get(id);
    if (!node) {
      rootMap.set(id, id);
      return id;
    }

    const parentRaw = node.parentId;
    if (parentRaw == null || parentRaw === "") {
      rootMap.set(id, id);
      return id;
    }

    const parentId = String(parentRaw);
    if (!byId.has(parentId)) {
      rootMap.set(id, id);
      return id;
    }

    const root = resolveRoot(parentId, visiting);
    rootMap.set(id, root);
    return root;
  }

  for (const id of byId.keys()) {
    resolveRoot(id);
  }

  return rootMap;
}

export function resolveRootCategoryId(
  articleCategoryId: string | ObjectId | null | undefined,
  rootMap: Map<string, string>,
): string | null {
  if (articleCategoryId == null || articleCategoryId === "") return null;
  const id = String(articleCategoryId);
  return rootMap.get(id) ?? id;
}
