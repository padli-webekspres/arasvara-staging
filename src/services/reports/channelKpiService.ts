import type { Db, ObjectId } from "mongodb";
import {
  AttributionMode,
  buildCategoryRootMap,
  buildChannelTargetDisplay,
  getPreviousMonthBoundsWib,
  momGrowthRate,
  parseAttributionMode,
  publicViewReferrerMatch,
  resolveRootCategoryId,
  roundNumber,
  type PeriodBounds,
} from "@/lib/analytics/metrics-core";
import type { KPIChannelResponse, KPIChannelRow } from "@/types/reports/kpiUser";
import { MonthlyTargetKey, TargetScopeType } from "@/types/monthlyTarget";

type CategoryDoc = {
  _id: ObjectId;
  name?: string;
  slug?: string;
  parentId?: ObjectId | string | null;
  order?: number;
};

type ChannelTargetDoc = {
  key: string;
  value: number;
  category?: { _id?: ObjectId | string; name?: string; slug?: string };
};

function isRootCategory(cat: CategoryDoc): boolean {
  return cat.parentId == null || cat.parentId === "";
}

async function countPublishedByCategoryLeaf(
  db: Db,
  bounds: PeriodBounds,
): Promise<Map<string, number>> {
  const rows = await db
    .collection("articles")
    .aggregate<{ _id: unknown; count: number }>([
      {
        $match: {
          status: "PUBLISHED",
          publishedAt: { $gte: bounds.start, $lt: bounds.end },
          deletedAt: { $in: [null, ""] },
          categoryId: { $ne: null },
        },
      },
      { $group: { _id: "$categoryId", count: { $sum: 1 } } },
    ])
    .toArray();

  const map = new Map<string, number>();
  for (const row of rows) {
    if (row._id == null) continue;
    map.set(String(row._id), row.count);
  }
  return map;
}

async function pageviewsByCategoryLeaf(
  db: Db,
  bounds: PeriodBounds,
  attribution: AttributionMode,
): Promise<Map<string, number>> {
  const pipeline: Record<string, unknown>[] = [
    {
      $match: {
        viewedAt: { $gte: bounds.start, $lt: bounds.end },
        deletedAt: { $in: [null, ""] },
        ...publicViewReferrerMatch(),
      },
    },
    {
      $lookup: {
        from: "articles",
        localField: "articleId",
        foreignField: "_id",
        as: "article",
      },
    },
    { $unwind: { path: "$article", preserveNullAndEmptyArrays: false } },
    {
      $match: {
        "article.deletedAt": { $in: [null, ""] },
        ...(attribution === "publish_cohort"
          ? {
              "article.status": "PUBLISHED",
              "article.publishedAt": { $gte: bounds.start, $lt: bounds.end },
            }
          : {
              "article.status": { $in: ["PUBLISHED", "TAKEN_DOWN"] },
            }),
      },
    },
    {
      $group: {
        _id: "$article.categoryId",
        views: { $sum: 1 },
      },
    },
  ];

  const rows = await db
    .collection("article_views")
    .aggregate<{ _id: unknown; views: number }>(pipeline)
    .toArray();

  const map = new Map<string, number>();
  for (const row of rows) {
    if (row._id == null) continue;
    map.set(String(row._id), row.views);
  }
  return map;
}

function rollupToRoot(
  leafCounts: Map<string, number>,
  rootMap: Map<string, string>,
): Map<string, number> {
  const rolled = new Map<string, number>();
  for (const [leafId, count] of leafCounts) {
    const rootId = resolveRootCategoryId(leafId, rootMap) ?? leafId;
    rolled.set(rootId, (rolled.get(rootId) ?? 0) + count);
  }
  return rolled;
}

function categoryTargetId(doc: ChannelTargetDoc): string | null {
  const raw = doc.category?._id;
  if (raw == null) return null;
  return String(raw);
}

/**
 * Scorecard per root kanal vs CHANNEL monthly targets.
 * Sub-rubrik articles/views roll up to their root parent.
 */
export async function getKPIChannel(
  db: Db,
  options: { period: string; attribution?: string } = { period: "" },
): Promise<KPIChannelResponse> {
  const period = options.period;
  const attribution = parseAttributionMode(options.attribution);
  const { previous, ...bounds } = getPreviousMonthBoundsWib(period);

  const categories = (await db
    .collection("categories")
    .find({}, { projection: { _id: 1, name: 1, slug: 1, parentId: 1, order: 1 } })
    .toArray()) as CategoryDoc[];

  const rootMap = buildCategoryRootMap(categories);
  const roots = categories
    .filter(isRootCategory)
    .sort((a, b) => {
      const orderA = typeof a.order === "number" ? a.order : 999;
      const orderB = typeof b.order === "number" ? b.order : 999;
      if (orderA !== orderB) return orderA - orderB;
      return String(a.name ?? "").localeCompare(String(b.name ?? ""), "id");
    });

  const [publishedLeaf, publishedPrevLeaf, viewsLeaf, viewsPrevLeaf, targets] =
    await Promise.all([
      countPublishedByCategoryLeaf(db, bounds),
      countPublishedByCategoryLeaf(db, previous),
      pageviewsByCategoryLeaf(db, bounds, attribution),
      pageviewsByCategoryLeaf(db, previous, attribution),
      db
        .collection("monthly_targets")
        .find({
          period,
          scopeType: TargetScopeType.CHANNEL,
          key: {
            $in: [
              MonthlyTargetKey.CHANNEL_ARTICLES,
              MonthlyTargetKey.CHANNEL_PAGEVIEWS,
            ],
          },
        })
        .toArray() as unknown as Promise<ChannelTargetDoc[]>,
    ]);

  const publishedByRoot = rollupToRoot(publishedLeaf, rootMap);
  const publishedPrevByRoot = rollupToRoot(publishedPrevLeaf, rootMap);
  const viewsByRoot = rollupToRoot(viewsLeaf, rootMap);
  const viewsPrevByRoot = rollupToRoot(viewsPrevLeaf, rootMap);

  const articlesTargetByRoot = new Map<string, number>();
  const pageviewsTargetByRoot = new Map<string, number>();
  for (const t of targets) {
    const catId = categoryTargetId(t);
    if (!catId) continue;
    const rootId = resolveRootCategoryId(catId, rootMap) ?? catId;
    if (t.key === MonthlyTargetKey.CHANNEL_ARTICLES) {
      articlesTargetByRoot.set(rootId, Number(t.value) || 0);
    } else if (t.key === MonthlyTargetKey.CHANNEL_PAGEVIEWS) {
      pageviewsTargetByRoot.set(rootId, Number(t.value) || 0);
    }
  }

  const rows: KPIChannelRow[] = roots.map((root) => {
    const categoryId = String(root._id);
    const articlesPublished = publishedByRoot.get(categoryId) ?? 0;
    const pageviews = viewsByRoot.get(categoryId) ?? 0;
    const prevPublished = publishedPrevByRoot.get(categoryId) ?? 0;
    const prevPageviews = viewsPrevByRoot.get(categoryId) ?? 0;

    return {
      categoryId,
      categoryName: String(root.name ?? "Tanpa nama"),
      categorySlug: String(root.slug ?? ""),
      period,
      articlesPublished,
      pageviews,
      viewsPerArticle:
        articlesPublished > 0 ? roundNumber(pageviews / articlesPublished, 1) : 0,
      targets: {
        articles: buildChannelTargetDisplay(
          articlesPublished,
          articlesTargetByRoot.get(categoryId) ?? null,
        ),
        pageviews: buildChannelTargetDisplay(
          pageviews,
          pageviewsTargetByRoot.get(categoryId) ?? null,
        ),
      },
      momPublished: momGrowthRate(articlesPublished, prevPublished),
      momPageviews: momGrowthRate(pageviews, prevPageviews),
    };
  });

  // Include orphan bucket if any leaf counts didn't map to a known root
  const rootIds = new Set(roots.map((r) => String(r._id)));
  let orphanPublished = 0;
  let orphanPageviews = 0;
  let orphanPrevPublished = 0;
  let orphanPrevPageviews = 0;
  for (const [rootId, count] of publishedByRoot) {
    if (!rootIds.has(rootId)) orphanPublished += count;
  }
  for (const [rootId, count] of viewsByRoot) {
    if (!rootIds.has(rootId)) orphanPageviews += count;
  }
  for (const [rootId, count] of publishedPrevByRoot) {
    if (!rootIds.has(rootId)) orphanPrevPublished += count;
  }
  for (const [rootId, count] of viewsPrevByRoot) {
    if (!rootIds.has(rootId)) orphanPrevPageviews += count;
  }

  if (orphanPublished > 0 || orphanPageviews > 0) {
    rows.push({
      categoryId: "__uncategorized__",
      categoryName: "Tanpa kanal",
      categorySlug: "",
      period,
      articlesPublished: orphanPublished,
      pageviews: orphanPageviews,
      viewsPerArticle:
        orphanPublished > 0
          ? roundNumber(orphanPageviews / orphanPublished, 1)
          : 0,
      targets: {
        articles: buildChannelTargetDisplay(orphanPublished, null),
        pageviews: buildChannelTargetDisplay(orphanPageviews, null),
      },
      momPublished: momGrowthRate(orphanPublished, orphanPrevPublished),
      momPageviews: momGrowthRate(orphanPageviews, orphanPrevPageviews),
    });
  }

  return {
    period,
    attribution,
    rows,
    dataFreshness: { computedAt: new Date().toISOString() },
  };
}

/** Exported for unit tests — rollup leaf map through root map. */
export function rollupCategoryCountsForTest(
  leafCounts: Map<string, number>,
  rootMap: Map<string, string>,
): Map<string, number> {
  return rollupToRoot(leafCounts, rootMap);
}
