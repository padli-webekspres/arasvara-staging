import { describe, expect, it } from "vitest";
import {
  authorProfileSubtitle,
  formatCoverageAreas,
  normalizeJobTitle,
  parseCoverageAreas,
} from "./user-profile-fields";

describe("normalizeJobTitle", () => {
  it("trims and drops empty", () => {
    expect(normalizeJobTitle("  Senior Reporter  ")).toBe("Senior Reporter");
    expect(normalizeJobTitle("   ")).toBeUndefined();
    expect(normalizeJobTitle(null)).toBeUndefined();
  });
});

describe("parseCoverageAreas", () => {
  it("splits commas, trims, and dedupes case-insensitively", () => {
    expect(parseCoverageAreas("Politik,  Ekonomi, politik")).toEqual([
      "Politik",
      "Ekonomi",
    ]);
    expect(parseCoverageAreas([" Lifestyle ", ""])).toEqual(["Lifestyle"]);
    expect(parseCoverageAreas("")).toEqual([]);
  });
});

describe("formatCoverageAreas", () => {
  it("joins with comma", () => {
    expect(formatCoverageAreas(["Politik", "Ekonomi"])).toBe(
      "Politik, Ekonomi",
    );
    expect(formatCoverageAreas([])).toBe("");
  });
});

describe("authorProfileSubtitle", () => {
  it("returns both parts when present", () => {
    expect(
      authorProfileSubtitle("  Senior Reporter  ", ["Politik", "Ekonomi"]),
    ).toEqual({
      jobTitle: "Senior Reporter",
      coverageAreas: ["Politik", "Ekonomi"],
    });
  });

  it("returns title only", () => {
    expect(authorProfileSubtitle("Editor", [])).toEqual({
      jobTitle: "Editor",
      coverageAreas: [],
    });
  });

  it("returns areas only", () => {
    expect(authorProfileSubtitle("", ["Tekno"])).toEqual({
      coverageAreas: ["Tekno"],
    });
  });

  it("returns null when both empty", () => {
    expect(authorProfileSubtitle("  ", [])).toBeNull();
    expect(authorProfileSubtitle(undefined, undefined)).toBeNull();
  });
});
