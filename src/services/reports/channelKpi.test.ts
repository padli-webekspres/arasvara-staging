import { describe, expect, it } from "vitest";
import {
  buildCategoryRootMap,
  buildChannelTargetDisplay,
  resolveRootCategoryId,
} from "@/lib/analytics/metrics-core";
import { rollupCategoryCountsForTest } from "@/services/reports/channelKpiService";

describe("category root rollup", () => {
  it("maps child rubrik to root kanal", () => {
    const rootMap = buildCategoryRootMap([
      { _id: "aneka", parentId: null },
      { _id: "opini", parentId: "aneka" },
      { _id: "lensa", parentId: "aneka" },
      { _id: "news", parentId: null },
    ]);

    expect(resolveRootCategoryId("opini", rootMap)).toBe("aneka");
    expect(resolveRootCategoryId("lensa", rootMap)).toBe("aneka");
    expect(resolveRootCategoryId("aneka", rootMap)).toBe("aneka");
    expect(resolveRootCategoryId("news", rootMap)).toBe("news");
  });

  it("handles deep nesting and orphan parents", () => {
    const rootMap = buildCategoryRootMap([
      { _id: "root", parentId: null },
      { _id: "mid", parentId: "root" },
      { _id: "leaf", parentId: "mid" },
      { _id: "orphan", parentId: "missing-parent" },
    ]);

    expect(resolveRootCategoryId("leaf", rootMap)).toBe("root");
    expect(resolveRootCategoryId("orphan", rootMap)).toBe("orphan");
  });

  it("rolls leaf counts into root totals", () => {
    const rootMap = buildCategoryRootMap([
      { _id: "aneka", parentId: null },
      { _id: "opini", parentId: "aneka" },
      { _id: "news", parentId: null },
    ]);
    const leaf = new Map([
      ["opini", 3],
      ["aneka", 2],
      ["news", 5],
    ]);
    const rolled = rollupCategoryCountsForTest(leaf, rootMap);
    expect(rolled.get("aneka")).toBe(5);
    expect(rolled.get("news")).toBe(5);
  });
});

describe("channel target display", () => {
  it("marks unset when target missing", () => {
    const d = buildChannelTargetDisplay(10, null);
    expect(d.status).toBe("unset");
    expect(d.achievementRate).toBeNull();
    expect(d.scopeLabel).toBe("CHANNEL");
  });

  it("computes achievement when target set", () => {
    const d = buildChannelTargetDisplay(50, 100);
    expect(d.status).toBe("set");
    expect(d.value).toBe(100);
    expect(d.achievementRate).toBe(50);
  });
});
