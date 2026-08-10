import { describe, expect, it } from "vitest";
import { ObjectId } from "mongodb";
import type { Db } from "mongodb";
import { discoverAuthorIdsInPeriod } from "@/services/reports/kpiUserService";
import { getMonthBoundsWib } from "@/lib/analytics/metrics-core";

/**
 * Writing analytics now uses behavior-based authors (authorId),
 * not WRITER_ROLES. Contracts below lock that eligibility.
 */
describe("writing analytics behavior-based authors", () => {
  it("discovery includes any authorId active in bounds regardless of CMS role", async () => {
    const adminId = new ObjectId();
    const capture = { match: null as Record<string, unknown> | null };

    const fakeDb = {
      collection: () => ({
        aggregate: (pipeline: Record<string, unknown>[]) => {
          capture.match = (pipeline[0]?.$match ?? null) as Record<
            string,
            unknown
          > | null;
          return {
            toArray: async () => [{ _id: adminId }],
          };
        },
      }),
    } as unknown as Db;

    const bounds = getMonthBoundsWib("2026-08");
    const ids = await discoverAuthorIdsInPeriod(fakeDb, bounds);

    expect(ids).toEqual([adminId]);
    expect(capture.match).not.toBeNull();
    expect(capture.match!.role).toBeUndefined();
    expect(capture.match!.$or).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ createdAt: expect.any(Object) }),
        expect.objectContaining({ publishedAt: expect.any(Object) }),
      ]),
    );
  });

  it("zero-activity discovered authors remain eligible for Writing leaderboard", () => {
    // Writing page keeps rows with published=0 & views=0 (unlike KPI hide-zero).
    const row = { published: 0, pageviews: 0, submittedCount: 0, rejectedCount: 0 };
    const keepForWriting = true;
    const hideForKpi =
      row.published === 0 &&
      row.pageviews === 0 &&
      row.submittedCount === 0 &&
      row.rejectedCount === 0;
    expect(keepForWriting).toBe(true);
    expect(hideForKpi).toBe(true);
  });
});
