import { describe, expect, it } from "vitest";
import {
  classifyReferrer,
  getMonthBoundsWib,
  getPreviousMonthBoundsWib,
  isPublicReferrer,
  isValidPeriodMonth,
  momGrowthRate,
  parseAttributionMode,
  resolveRangeBoundsWib,
  safePercent,
  buildUnsetIndividualTarget,
  buildSiteTargetDisplay,
  parsePagination,
  parseSort,
} from "@/lib/analytics/metrics-core";

describe("period bounds WIB", () => {
  it("validates YYYY-MM", () => {
    expect(isValidPeriodMonth("2026-08")).toBe(true);
    expect(isValidPeriodMonth("2026-13")).toBe(false);
    expect(isValidPeriodMonth("2026-8")).toBe(false);
  });

  it("builds exclusive end at next month WIB midnight", () => {
    const bounds = getMonthBoundsWib("2026-08");
    // 2026-08-01 00:00 WIB = 2026-07-31 17:00 UTC
    expect(bounds.start.toISOString()).toBe("2026-07-31T17:00:00.000Z");
    // 2026-09-01 00:00 WIB = 2026-08-31 17:00 UTC
    expect(bounds.end.toISOString()).toBe("2026-08-31T17:00:00.000Z");
    expect(bounds.label).toBe("2026-08");
  });

  it("previous month is July for August", () => {
    const { previous } = getPreviousMonthBoundsWib("2026-08");
    expect(previous.label).toBe("2026-07");
  });

  it("resolves 7d range ending exclusive tomorrow WIB", () => {
    const now = new Date("2026-08-10T05:00:00.000Z"); // 12:00 WIB
    const bounds = resolveRangeBoundsWib({ range: "7d", now });
    expect(bounds.label).toMatch(/\.\./);
    expect(bounds.end.getTime()).toBeGreaterThan(bounds.start.getTime());
  });

  it("rejects inverted custom range", () => {
    expect(() =>
      resolveRangeBoundsWib({ from: "2026-08-10", to: "2026-08-01" }),
    ).toThrow(/tidak boleh sebelum/);
  });
});

describe("attribution + referrer", () => {
  it("parses attribution modes", () => {
    expect(parseAttributionMode(undefined)).toBe("consumption");
    expect(parseAttributionMode("publish_cohort")).toBe("publish_cohort");
    expect(() => parseAttributionMode("lifetime")).toThrow(/attribution/);
  });

  it("classifies search social direct admin", () => {
    expect(classifyReferrer("https://www.google.com/")).toBe("search");
    expect(classifyReferrer("http://m.facebook.com")).toBe("social");
    expect(classifyReferrer("")).toBe("direct");
    expect(classifyReferrer("https://arasvara.id/admin-xyz/articles")).toBe(
      "internal_admin",
    );
    expect(isPublicReferrer("https://arasvara.id/admin-xyz/articles")).toBe(
      false,
    );
    expect(isPublicReferrer("https://www.google.com/")).toBe(true);
  });
});

describe("math helpers", () => {
  it("safePercent handles zero denominator", () => {
    expect(safePercent(5, 0)).toBe(0);
    expect(safePercent(1, 4)).toBe(25);
  });

  it("momGrowthRate handles zero baseline", () => {
    expect(momGrowthRate(0, 0)).toBe(0);
    expect(momGrowthRate(10, 0)).toBeNull();
    expect(momGrowthRate(120, 100)).toBe(20);
  });
});

describe("target display", () => {
  it("never invents individual target from site target", () => {
    const unset = buildUnsetIndividualTarget({ label: "site", value: 300 });
    expect(unset.status).toBe("unset");
    expect(unset.achievementRate).toBeNull();
    expect(unset.contextValue).toBe(300);
  });

  it("site target unset vs set", () => {
    expect(buildSiteTargetDisplay(10, null).status).toBe("unset");
    expect(buildSiteTargetDisplay(50, 100).achievementRate).toBe(50);
  });
});

describe("pagination/sort", () => {
  it("clamps pagination", () => {
    expect(parsePagination({ page: "0", limit: "999" })).toEqual({
      page: 1,
      limit: 100,
      skip: 0,
    });
  });

  it("allowlists sort", () => {
    expect(parseSort("hack", ["pageviews", "name"], "pageviews")).toBe(
      "pageviews",
    );
    expect(parseSort("name", ["pageviews", "name"], "pageviews")).toBe("name");
  });
});
