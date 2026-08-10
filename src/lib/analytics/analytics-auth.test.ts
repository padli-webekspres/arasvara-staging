import { describe, expect, it } from "vitest";
import {
  canAccessAggregateAnalytics,
  isFullAnalyticsRole,
  isSelfScopedAnalyticsRole,
  resolveAnalyticsScopeUserIds,
} from "@/lib/analytics/analytics-auth";
import { ROLES } from "@/lib/auth-client";
import type { Db } from "mongodb";

describe("analytics-auth roles", () => {
  it("full roles for admin/pemred/redpel", () => {
    expect(isFullAnalyticsRole(ROLES.ADMIN)).toBe(true);
    expect(isFullAnalyticsRole(ROLES.EDITOR_IN_CHIEF)).toBe(true);
    expect(isFullAnalyticsRole(ROLES.MANAGING_EDITOR)).toBe(true);
    expect(isFullAnalyticsRole(ROLES.EDITOR)).toBe(false);
  });

  it("self-scoped role for editor only (no team/head-of)", () => {
    expect(isSelfScopedAnalyticsRole(ROLES.EDITOR)).toBe(true);
    expect(isSelfScopedAnalyticsRole(ROLES.HEAD_OF)).toBe(false);
    expect(isSelfScopedAnalyticsRole(ROLES.WRITER)).toBe(false);
  });

  it("writers cannot access aggregate analytics", () => {
    expect(canAccessAggregateAnalytics({ role: ROLES.WRITER })).toBe(false);
    expect(canAccessAggregateAnalytics({ role: ROLES.CONTRIBUTOR })).toBe(
      false,
    );
    expect(canAccessAggregateAnalytics({ role: ROLES.ADMIN })).toBe(true);
    expect(canAccessAggregateAnalytics({ role: ROLES.EDITOR })).toBe(true);
    expect(canAccessAggregateAnalytics({ role: ROLES.HEAD_OF })).toBe(false);
    expect(canAccessAggregateAnalytics(null)).toBe(false);
  });

  it("editor scope resolves to self only", async () => {
    const fakeDb = {} as Db;
    const scope = await resolveAnalyticsScopeUserIds(fakeDb, {
      role: ROLES.EDITOR,
      _id: "editor-1",
    });
    expect(scope).toEqual({ mode: "ids", userIds: ["editor-1"] });
  });

  it("full role scope resolves to all", async () => {
    const fakeDb = {} as Db;
    const scope = await resolveAnalyticsScopeUserIds(fakeDb, {
      role: ROLES.ADMIN,
      _id: "admin-1",
    });
    expect(scope).toEqual({ mode: "all", userIds: null });
  });
});
