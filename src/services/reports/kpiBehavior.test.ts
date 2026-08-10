import { describe, expect, it } from "vitest";
import { ObjectId } from "mongodb";
import type { Db } from "mongodb";
import {
  EDITOR_PROCESS_ACTIONS,
  compareEditorsByProcessedDesc,
  compareWritersByPublishedDesc,
  discoverAuthorIdsInPeriod,
  discoverEditorIdsInPeriod,
  editorRowHasActivity,
  writerRowHasActivity,
} from "@/services/reports/kpiUserService";
import { getMonthBoundsWib } from "@/lib/analytics/metrics-core";

describe("KPI behavior-based eligibility helpers", () => {
  it("hides writer rows with all-zero activity", () => {
    expect(
      writerRowHasActivity({
        articlePublishedThisMonth: 0,
        pageViewsThisMonth: 0,
        submittedCount: 0,
        rejectedCount: 0,
      }),
    ).toBe(false);
    expect(
      writerRowHasActivity({
        articlePublishedThisMonth: 0,
        pageViewsThisMonth: 3,
        submittedCount: 0,
        rejectedCount: 0,
      }),
    ).toBe(true);
  });

  it("hides editor rows with all-zero activity", () => {
    expect(
      editorRowHasActivity({
        articlesProcessedThisMonth: 0,
        articlesRevisionCountThisMonth: 0,
        totalDraftsReviewedThisMonth: 0,
      }),
    ).toBe(false);
    expect(
      editorRowHasActivity({
        articlesProcessedThisMonth: 0,
        articlesRevisionCountThisMonth: 2,
        totalDraftsReviewedThisMonth: 2,
      }),
    ).toBe(true);
  });

  it("sorts writers by published desc then name", () => {
    const rows = [
      { articlePublishedThisMonth: 1, user: { name: "Budi" } },
      { articlePublishedThisMonth: 5, user: { name: "Ani" } },
      { articlePublishedThisMonth: 5, user: { name: "Citra" } },
    ];
    rows.sort(compareWritersByPublishedDesc);
    expect(rows.map((r) => r.user.name)).toEqual(["Ani", "Citra", "Budi"]);
  });

  it("sorts editors by processed desc then name", () => {
    const rows = [
      { articlesProcessedThisMonth: 2, user: { name: "Zaki" } },
      { articlesProcessedThisMonth: 9, user: { name: "Maya" } },
    ];
    rows.sort(compareEditorsByProcessedDesc);
    expect(rows[0].user.name).toBe("Maya");
  });

  it("keeps current editor process actions", () => {
    expect([...EDITOR_PROCESS_ACTIONS]).toEqual([
      "PUBLISH",
      "SCHEDULE",
      "REJECT",
      "UPDATE",
    ]);
  });
});

describe("discoverAuthorIdsInPeriod", () => {
  it("includes draft authors via createdAt in period and applies scope", async () => {
    const adminId = new ObjectId();
    const writerId = new ObjectId();
    const capture = { match: null as Record<string, unknown> | null };

    const fakeDb = {
      collection: () => ({
        aggregate: (pipeline: Record<string, unknown>[]) => {
          capture.match = (pipeline[0]?.$match ?? null) as Record<
            string,
            unknown
          > | null;
          return {
            toArray: async () => [{ _id: adminId }, { _id: writerId }],
          };
        },
      }),
    } as unknown as Db;

    const bounds = getMonthBoundsWib("2026-08");
    const ids = await discoverAuthorIdsInPeriod(fakeDb, bounds);

    expect(ids).toHaveLength(2);
    expect(capture.match).not.toBeNull();
    expect(capture.match!.deletedAt).toEqual({ $in: [null, ""] });
    expect(capture.match!.$or).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ createdAt: expect.any(Object) }),
        expect.objectContaining({ publishedAt: expect.any(Object) }),
      ]),
    );

    const scoped = await discoverAuthorIdsInPeriod(fakeDb, bounds, [
      String(adminId),
    ]);
    expect(scoped).toHaveLength(2); // mock returns same; match uses scoped authorId
    expect(capture.match!.authorId).toEqual({
      $in: [expect.any(ObjectId)],
    });
  });
});

describe("discoverEditorIdsInPeriod", () => {
  it("discovers actors from audit process actions not by CMS role", async () => {
    const actorId = new ObjectId();
    const capture = { match: null as Record<string, unknown> | null };

    const fakeDb = {
      collection: () => ({
        aggregate: (pipeline: Record<string, unknown>[]) => {
          capture.match = (pipeline[0]?.$match ?? null) as Record<
            string,
            unknown
          > | null;
          return {
            toArray: async () => [{ _id: actorId }],
          };
        },
      }),
    } as unknown as Db;

    const bounds = getMonthBoundsWib("2026-08");
    const ids = await discoverEditorIdsInPeriod(fakeDb, bounds);

    expect(ids).toEqual([actorId]);
    expect(capture.match).not.toBeNull();
    expect(capture.match!.action).toEqual({
      $in: ["PUBLISH", "SCHEDULE", "REJECT", "UPDATE"],
    });
    expect(capture.match!.entity).toBe("articles");
  });
});

describe("loadUserProfilesByIds fallback", () => {
  it("builds denorm author profile when user doc missing", async () => {
    const orphanId = new ObjectId();
    const { loadUserProfilesByIds } = await import(
      "@/services/reports/kpiUserService"
    );

    const fakeDb = {
      collection: (name: string) => {
        if (name === "users") {
          return {
            find: () => ({
              toArray: async () => [],
            }),
          };
        }
        if (name === "articles") {
          return {
            aggregate: () => ({
              toArray: async () => [
                {
                  _id: orphanId,
                  author: { name: "Orphan Author", email: "o@ex.com" },
                },
              ],
            }),
          };
        }
        return {
          aggregate: () => ({ toArray: async () => [] }),
          find: () => ({ toArray: async () => [] }),
        };
      },
    } as unknown as Db;

    const profiles = await loadUserProfilesByIds(fakeDb, [orphanId], {
      fallbackSource: "author",
    });

    expect(profiles).toHaveLength(1);
    expect(profiles[0].name).toBe("Orphan Author");
    expect(profiles[0].email).toBe("o@ex.com");
  });
});
