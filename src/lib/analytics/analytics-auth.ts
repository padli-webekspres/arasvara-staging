import { NextResponse } from "next/server";
import { ROLES, hasPermission } from "@/lib/auth-client";
import type { Db, ObjectId } from "mongodb";

export type AnalyticsUser = {
  _id?: string | ObjectId;
  id?: string;
  role?: string;
  name?: string;
  email?: string;
};

/** Full org analytics (Pemred / Redpel / Admin). */
export const FULL_ANALYTICS_ROLES = [
  ROLES.ADMIN,
  ROLES.EDITOR_IN_CHIEF,
  ROLES.MANAGING_EDITOR,
] as const;

/** Self-scoped analytics roles (Editor sees only own metrics). */
export const SELF_SCOPED_ANALYTICS_ROLES = [ROLES.EDITOR] as const;

export const AGGREGATE_ANALYTICS_ROLES = [
  ...FULL_ANALYTICS_ROLES,
  ...SELF_SCOPED_ANALYTICS_ROLES,
] as const;

export function normalizeRole(role?: string | null): string {
  return (role || "").toLowerCase().trim();
}

export function isFullAnalyticsRole(role?: string | null): boolean {
  const r = normalizeRole(role);
  return FULL_ANALYTICS_ROLES.some((x) => x === r);
}

export function isSelfScopedAnalyticsRole(role?: string | null): boolean {
  const r = normalizeRole(role);
  return SELF_SCOPED_ANALYTICS_ROLES.some((x) => x === r);
}

/** @deprecated Use isSelfScopedAnalyticsRole — team analytics removed. */
export function isTeamAnalyticsRole(role?: string | null): boolean {
  return isSelfScopedAnalyticsRole(role);
}

export function canAccessAggregateAnalytics(user: AnalyticsUser | null | undefined): boolean {
  if (!user?.role) return false;
  const role = normalizeRole(user.role);
  if (isFullAnalyticsRole(role) || isSelfScopedAnalyticsRole(role)) return true;
  // Full org analytics permission only (team analytics permission no longer grants access)
  return hasPermission(role, "view_analytics");
}

export function forbiddenAnalyticsResponse() {
  return NextResponse.json(
    { error: "Forbidden: Anda tidak memiliki hak akses ke laporan agregat ini." },
    { status: 403 },
  );
}

export function unauthorizedAnalyticsResponse() {
  return NextResponse.json(
    { error: "Unauthorized: Authentication required." },
    { status: 401 },
  );
}

export function badRequestAnalyticsResponse(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

/**
 * Resolve author/editor user IDs visible to the requester.
 * - Full roles: null (no filter)
 * - Self-scoped roles (Editor): only self id
 */
export async function resolveAnalyticsScopeUserIds(
  _db: Db,
  user: AnalyticsUser,
): Promise<{ mode: "all" | "ids"; userIds: string[] | null }> {
  if (isFullAnalyticsRole(user.role)) {
    return { mode: "all", userIds: null };
  }

  if (isSelfScopedAnalyticsRole(user.role)) {
    const selfId = String(user._id ?? user.id ?? "");
    return { mode: "ids", userIds: selfId ? [selfId] : [] };
  }

  // Permission-only full access (view_analytics without a listed role)
  if (hasPermission(normalizeRole(user.role), "view_analytics")) {
    return { mode: "all", userIds: null };
  }

  const selfId = String(user._id ?? user.id ?? "");
  return { mode: "ids", userIds: selfId ? [selfId] : [] };
}
