import { describe, expect, it } from "vitest";
import {
  formatDateReadableJakarta,
  formatDatetimeLocalFromUtc,
  formatDateTimeReadableJakarta,
  formatTimeReadableJakarta,
  parseDatetimeLocalAsWib,
  resolveArticleDateModified,
  roundDatetimeLocalTo5Minutes,
  toIsoStringOrNull,
} from "@/lib/datetime-jakarta";

const SAMPLE_UTC = "2026-07-19T15:35:26.315Z";

describe("format*Jakarta", () => {
  it("formats time as WIB wall-clock from UTC instant", () => {
    expect(formatTimeReadableJakarta(SAMPLE_UTC)).toBe("22:35 WIB");
  });

  it("formats date in Jakarta calendar day", () => {
    // 15:35Z = 22:35 WIB on 19 Jul — still 19 Juli
    expect(formatDateReadableJakarta(SAMPLE_UTC, "id-ID")).toMatch(/19/);
    expect(formatDateReadableJakarta(SAMPLE_UTC, "id-ID")).toMatch(/Juli|July/i);
  });

  it("formats datetime with Jakarta hour", () => {
    const result = formatDateTimeReadableJakarta(SAMPLE_UTC, "id-ID");
    expect(result).toContain("22:35");
    expect(result).toMatch(/19/);
  });

  it("crosses calendar day correctly (late UTC → next WIB day)", () => {
    // 2026-07-19T18:00:00.000Z = 01:00 WIB on 20 Jul
    expect(formatTimeReadableJakarta("2026-07-19T18:00:00.000Z")).toBe(
      "01:00 WIB",
    );
    expect(formatDateReadableJakarta("2026-07-19T18:00:00.000Z", "id-ID")).toMatch(
      /20/,
    );
  });
});

describe("parseDatetimeLocalAsWib", () => {
  it("treats datetime-local as WIB wall-clock → UTC", () => {
    const result = parseDatetimeLocalAsWib("2026-07-19T15:35");
    expect(result).not.toBeNull();
    expect(result!.toISOString()).toBe("2026-07-19T08:35:00.000Z");
  });

  it("rounds minutes to 5 when requested", () => {
    const result = parseDatetimeLocalAsWib("2026-07-19T15:37", {
      roundTo5Minutes: true,
    });
    expect(result!.toISOString()).toBe("2026-07-19T08:35:00.000Z");
  });

  it("returns null for empty/invalid", () => {
    expect(parseDatetimeLocalAsWib("")).toBeNull();
    expect(parseDatetimeLocalAsWib("not-a-date")).toBeNull();
  });
});

describe("formatDatetimeLocalFromUtc + round-trip", () => {
  it("formats UTC instant as WIB datetime-local", () => {
    expect(formatDatetimeLocalFromUtc(SAMPLE_UTC)).toBe("2026-07-19T22:35");
  });

  it("round-trips datetime-local through WIB parse", () => {
    const local = "2026-07-19T15:35";
    const utc = parseDatetimeLocalAsWib(local)!;
    expect(formatDatetimeLocalFromUtc(utc)).toBe(local);
  });
});

describe("roundDatetimeLocalTo5Minutes", () => {
  it("floors minutes to multiple of 5", () => {
    expect(roundDatetimeLocalTo5Minutes("2026-07-19T15:37")).toBe(
      "2026-07-19T15:35",
    );
  });
});

describe("toIsoStringOrNull + resolveArticleDateModified", () => {
  it("returns ISO or null", () => {
    expect(toIsoStringOrNull(SAMPLE_UTC)).toBe(SAMPLE_UTC);
    expect(toIsoStringOrNull(null)).toBeNull();
    expect(toIsoStringOrNull("bad")).toBeNull();
  });

  it("prefers contentUpdatedAt over publishedAt", () => {
    expect(
      resolveArticleDateModified({
        contentUpdatedAt: "2026-07-20T01:00:00.000Z",
        publishedAt: SAMPLE_UTC,
        createdAt: "2026-07-19T10:00:00.000Z",
      }),
    ).toBe("2026-07-20T01:00:00.000Z");
  });

  it("falls back to publishedAt then createdAt", () => {
    expect(
      resolveArticleDateModified({
        publishedAt: SAMPLE_UTC,
        createdAt: "2026-07-19T10:00:00.000Z",
      }),
    ).toBe(SAMPLE_UTC);

    expect(
      resolveArticleDateModified({
        createdAt: "2026-07-19T10:00:00.000Z",
      }),
    ).toBe("2026-07-19T10:00:00.000Z");
  });
});
