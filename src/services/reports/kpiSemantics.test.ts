import { describe, expect, it } from "vitest";
import {
  buildUnsetIndividualTarget,
  buildSiteTargetDisplay,
  DEFAULT_SLA_MINUTES,
} from "@/lib/analytics/metrics-core";

/**
 * KPI edge-case contracts locked by DSS refactor decisions.
 */
describe("KPI target semantics", () => {
  it("individual target stays unset even when site target exists", () => {
    const individual = buildUnsetIndividualTarget({
      label: "site ARTICLES_PUBLISHED",
      value: 300,
    });
    expect(individual.status).toBe("unset");
    expect(individual.value).toBeNull();
    expect(individual.achievementRate).toBeNull();
    expect(individual.contextValue).toBe(300);
  });

  it("site attainment is null when target missing (not fake 0% failure UI)", () => {
    const site = buildSiteTargetDisplay(42, null);
    expect(site.status).toBe("unset");
    expect(site.achievementRate).toBeNull();
  });

  it("default SLA minutes is 120 not hardcoded 30", () => {
    expect(DEFAULT_SLA_MINUTES).toBe(120);
  });
});
