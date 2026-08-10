import { DateTime } from "luxon";
import { Db, ObjectId } from "mongodb";
import {
  AttributionMode,
  PeriodBounds,
  authorIdMatch,
  classifyReferrer,
  momGrowthRate,
  publicViewReferrerMatch,
  resolveRangeBoundsWib,
  getPreviousEqualBounds,
  roundNumber,
  safePercent,
  parseAttributionMode,
  toObjectIdOrNull,
} from "@/lib/analytics/metrics-core";
import {
  discoverAuthorIdsInPeriod,
  loadUserProfilesByIds,
} from "@/services/reports/kpiUserService";

export type WritingSummary = {
  activeWriters: number;
  published: number;
  pageviews: number;
  viewsPerArticle: number;
  approxUniques: number;
  mom: {
    published: number | null;
    pageviews: number | null;
  };
  attribution: AttributionMode;
  rangeLabel: string;
  alerts: WritingAlert[];
  series: WritingSeriesPoint[];
  ranking: WritingRankItem[];
  categoryShare: { category: string; published: number; pageviews: number }[];
  referrerMix: { class: string; views: number; share: number }[];
};

export type WritingAlert = {
  type: "no_publish" | "low_efficiency" | "concentration";
  severity: "info" | "warning" | "critical";
  message: string;
};

export type WritingSeriesPoint = {
  date: string;
  published: number;
  pageviews: number;
};

export type WritingRankItem = {
  userId: string;
  name: string;
  published: number;
  pageviews: number;
  viewsPerArticle: number;
};

export type WritingAuthorRow = {
  userId: string;
  user: {
    _id: string;
    name: string;
    email: string;
    avatar?: string | null;
    role: string;
  };
  published: number;
  pageviews: number;
  viewsPerArticle: number;
  contributionShare: number;
  revisionRate: number;
  submittedCount: number;
  rejectedCount: number;
  categoryTop: string | null;
  momPublished: number | null;
  momPageviews: number | null;
};

export type WritingArticleRow = {
  articleId: string;
  title: string;
  slug: string;
  status: string;
  publishedAt: string | null;
  authorName: string;
  authorId: string | null;
  categoryName: string;
  views: number;
  lifetimeViews: number;
};

/**
 * Behavior-based authors: anyone with authorId on articles active in bounds.
 * Role is label only — Admin/Pemred who write are included.
 */
async function loadBehaviorAuthors(
  db: Db,
  bounds: PeriodBounds,
  options: { search?: string; scopedUserIds?: string[] | null },
): Promise<{
  users: Record<string, unknown>[];
  authorIds: ObjectId[];
}> {
  const discoveredIds = await discoverAuthorIdsInPeriod(
    db,
    bounds,
    options.scopedUserIds,
  );
  if (discoveredIds.length === 0) {
    return { users: [], authorIds: [] };
  }

  const users = await loadUserProfilesByIds(db, discoveredIds, {
    search: options.search,
    fallbackSource: "author",
  });

  const authorIds = users
    .map((u) => toObjectIdOrNull(u._id))
    .filter((id): id is ObjectId => id != null);

  return { users, authorIds };
}

/** Lookup + resolve nama kategori (join DB, denorm flat, fallback). */
const CATEGORY_NAME_STAGES: Record<string, unknown>[] = [
  {
    $lookup: {
      from: "categories",
      localField: "categoryId",
      foreignField: "_id",
      as: "categoryDoc",
    },
  },
  {
    $addFields: {
      categoryName: {
        $ifNull: [
          { $arrayElemAt: ["$categoryDoc.name", 0] },
          {
            $ifNull: [
              { $getField: { field: "category.name", input: "$$ROOT" } },
              "Tanpa Kategori",
            ],
          },
        ],
      },
    },
  },
];

async function countPublishedByAuthor(
  db: Db,
  authorIds: ObjectId[],
  bounds: PeriodBounds,
  categoryId?: ObjectId | null,
) {
  const match: Record<string, unknown> = {
    authorId: { $in: authorIds },
    status: "PUBLISHED",
    publishedAt: { $gte: bounds.start, $lt: bounds.end },
    deletedAt: { $in: [null, ""] },
  };
  if (categoryId) match.categoryId = categoryId;

  return db
    .collection("articles")
    .aggregate<{ _id: ObjectId; count: number; category?: string }>([
      { $match: match },
      ...CATEGORY_NAME_STAGES,
      {
        $group: {
          _id: { authorId: "$authorId", categoryName: "$categoryName" },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      {
        $group: {
          _id: "$_id.authorId",
          count: { $sum: "$count" },
          category: { $first: "$_id.categoryName" },
        },
      },
    ])
    .toArray();
}

async function buildCategoryShare(
  db: Db,
  authorIds: ObjectId[],
  bounds: PeriodBounds,
  attribution: AttributionMode,
  categoryId?: ObjectId | null,
): Promise<{ category: string; published: number; pageviews: number }[]> {
  const publishedMatch: Record<string, unknown> = {
    authorId: { $in: authorIds },
    status: "PUBLISHED",
    publishedAt: { $gte: bounds.start, $lt: bounds.end },
    deletedAt: { $in: [null, ""] },
  };
  if (categoryId) publishedMatch.categoryId = categoryId;

  const publishedRows = await db
    .collection("articles")
    .aggregate<{ _id: string; published: number }>([
      { $match: publishedMatch },
      ...CATEGORY_NAME_STAGES,
      {
        $group: {
          _id: "$categoryName",
          published: { $sum: 1 },
        },
      },
    ])
    .toArray();

  const articleScopeMatch: Record<string, unknown> = {
    "article.authorId": { $in: authorIds },
    "article.deletedAt": { $in: [null, ""] },
  };
  if (categoryId) articleScopeMatch["article.categoryId"] = categoryId;
  if (attribution === "publish_cohort") {
    articleScopeMatch["article.status"] = "PUBLISHED";
    articleScopeMatch["article.publishedAt"] = {
      $gte: bounds.start,
      $lt: bounds.end,
    };
  }

  const pageviewRows = await db
    .collection("article_views")
    .aggregate<{ _id: string; pageviews: number }>([
      {
        $match: {
          viewedAt: { $gte: bounds.start, $lt: bounds.end },
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
      { $unwind: "$article" },
      { $match: articleScopeMatch },
      {
        $lookup: {
          from: "categories",
          localField: "article.categoryId",
          foreignField: "_id",
          as: "categoryDoc",
        },
      },
      {
        $addFields: {
          categoryName: {
            $ifNull: [
              { $arrayElemAt: ["$categoryDoc.name", 0] },
              {
                $ifNull: [
                  {
                    $getField: {
                      field: "category.name",
                      input: "$article",
                    },
                  },
                  "Tanpa Kategori",
                ],
              },
            ],
          },
        },
      },
      {
        $group: {
          _id: "$categoryName",
          pageviews: { $sum: 1 },
        },
      },
    ])
    .toArray();

  const merged = new Map<string, { published: number; pageviews: number }>();

  for (const row of publishedRows) {
    const key = row._id || "Tanpa Kategori";
    const existing = merged.get(key) || { published: 0, pageviews: 0 };
    existing.published += row.published;
    merged.set(key, existing);
  }

  for (const row of pageviewRows) {
    const key = row._id || "Tanpa Kategori";
    const existing = merged.get(key) || { published: 0, pageviews: 0 };
    existing.pageviews += row.pageviews;
    merged.set(key, existing);
  }

  return [...merged.entries()]
    .map(([category, stats]) => ({
      category,
      published: stats.published,
      pageviews: stats.pageviews,
    }))
    .sort(
      (a, b) =>
        b.pageviews - a.pageviews ||
        b.published - a.published ||
        a.category.localeCompare(b.category, "id-ID"),
    )
    .slice(0, 10);
}

/**
 * Consumption: views in range on author's catalog (exclude admin referrers).
 * Publish cohort: views in range on articles published in range by author.
 */
async function pageviewsByAuthor(
  db: Db,
  authorIds: ObjectId[],
  bounds: PeriodBounds,
  attribution: AttributionMode,
  categoryId?: ObjectId | null,
) {
  if (authorIds.length === 0) return [] as Array<{ _id: ObjectId; views: number; uniques: string[] }>;

  const articleMatch: Record<string, unknown> = {
    ...authorIdMatch(authorIds),
    deletedAt: { $in: [null, ""] },
  };
  if (categoryId) articleMatch.categoryId = categoryId;
  if (attribution === "publish_cohort") {
    articleMatch.status = "PUBLISHED";
    articleMatch.publishedAt = { $gte: bounds.start, $lt: bounds.end };
  }

  const articles = await db
    .collection("articles")
    .find(articleMatch, { projection: { _id: 1, authorId: 1 } })
    .toArray();

  if (articles.length === 0) {
    return [] as Array<{ _id: ObjectId; views: number; uniques: string[] }>;
  }

  const articleIds = articles.map((a) => a._id);
  const authorByArticle = new Map<string, string>();
  for (const a of articles) {
    authorByArticle.set(String(a._id), String(a.authorId));
  }

  const viewRows = await db
    .collection("article_views")
    .aggregate<{
      _id: ObjectId;
      views: number;
      sessions: string[];
    }>([
      {
        $match: {
          articleId: { $in: articleIds },
          viewedAt: { $gte: bounds.start, $lt: bounds.end },
          ...publicViewReferrerMatch(),
        },
      },
      {
        $group: {
          _id: "$articleId",
          views: { $sum: 1 },
          sessions: {
            $addToSet: {
              $ifNull: ["$sessionId", { $ifNull: ["$ip", "unknown"] }],
            },
          },
        },
      },
    ])
    .toArray();

  const byAuthor = new Map<string, { views: number; uniques: Set<string> }>();
  for (const row of viewRows) {
    const authorId = authorByArticle.get(String(row._id));
    if (!authorId) continue;
    const bucket = byAuthor.get(authorId) || { views: 0, uniques: new Set<string>() };
    bucket.views += row.views;
    for (const s of row.sessions || []) bucket.uniques.add(String(s));
    byAuthor.set(authorId, bucket);
  }

  return [...byAuthor.entries()].map(([id, v]) => ({
    _id: new ObjectId(id),
    views: v.views,
    uniques: [...v.uniques],
  }));
}

async function revisionByAuthor(
  db: Db,
  authorIds: ObjectId[],
  bounds: PeriodBounds,
) {
  // Prefer audit_log REJECT on articles; fallback editor_activities
  const audit = await db
    .collection("audit_log")
    .aggregate([
      {
        $match: {
          entity: "articles",
          createdAt: { $gte: bounds.start, $lt: bounds.end },
          action: { $in: ["REJECT", "PUBLISH", "CREATE", "UPDATE"] },
        },
      },
      {
        $group: {
          _id: "$entityId",
          rejects: {
            $sum: { $cond: [{ $eq: ["$action", "REJECT"] }, 1, 0] },
          },
          publishes: {
            $sum: { $cond: [{ $eq: ["$action", "PUBLISH"] }, 1, 0] },
          },
        },
      },
    ])
    .toArray();

  // Map article → author then aggregate — limited path using articles lookup
  if (audit.length > 0) {
    const entityIds = audit
      .map((a) => a._id)
      .filter(Boolean)
      .map((id) => (ObjectId.isValid(String(id)) ? new ObjectId(String(id)) : null))
      .filter(Boolean) as ObjectId[];

    const articles = await db
      .collection("articles")
      .find(
        { _id: { $in: entityIds }, authorId: { $in: authorIds } },
        { projection: { _id: 1, authorId: 1 } },
      )
      .toArray();
    const authorByArticle = new Map(articles.map((a) => [String(a._id), String(a.authorId)]));
    const byAuthor = new Map<string, { submitted: number; rejected: number }>();
    for (const row of audit) {
      const authorId = authorByArticle.get(String(row._id));
      if (!authorId) continue;
      const bucket = byAuthor.get(authorId) || { submitted: 0, rejected: 0 };
      bucket.rejected += row.rejects || 0;
      bucket.submitted += (row.rejects || 0) + (row.publishes || 0);
      byAuthor.set(authorId, bucket);
    }
    if (byAuthor.size > 0) {
      return {
        source: "audit_log" as const,
        map: byAuthor,
      };
    }
  }

  const legacy = await db
    .collection("editor_activities")
    .aggregate([
      {
        $match: {
          authorId: { $in: authorIds },
          timestamp: { $gte: bounds.start, $lt: bounds.end },
          deletedAt: { $in: [null, ""] },
        },
      },
      {
        $group: {
          _id: "$authorId",
          submitted: {
            $sum: {
              $cond: [{ $eq: ["$statusTo", "PENDING_REVIEW"] }, 1, 0],
            },
          },
          rejected: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$statusFrom", "PENDING_REVIEW"] },
                    { $eq: ["$statusTo", "REJECTED"] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ])
    .toArray();

  const map = new Map<string, { submitted: number; rejected: number }>();
  for (const row of legacy) {
    if (!row._id) continue;
    map.set(String(row._id), {
      submitted: row.submitted || 0,
      rejected: row.rejected || 0,
    });
  }
  return { source: "editor_activities" as const, map };
}

export async function getWritingAnalyticsSummary(
  db: Db,
  options: {
    range?: string;
    from?: string;
    to?: string;
    attribution?: string;
    categoryId?: string;
    search?: string;
    scopedUserIds?: string[] | null;
  },
): Promise<WritingSummary> {
  const attribution = parseAttributionMode(options.attribution);
  const bounds = resolveRangeBoundsWib({
    range: options.range,
    from: options.from,
    to: options.to,
  });
  const { previous } = getPreviousEqualBounds(bounds);
  const categoryId =
    options.categoryId && ObjectId.isValid(options.categoryId)
      ? new ObjectId(options.categoryId)
      : null;

  const { users, authorIds } = await loadBehaviorAuthors(db, bounds, {
    search: options.search,
    scopedUserIds: options.scopedUserIds,
  });

  if (authorIds.length === 0) {
    return {
      activeWriters: 0,
      published: 0,
      pageviews: 0,
      viewsPerArticle: 0,
      approxUniques: 0,
      mom: { published: null, pageviews: null },
      attribution,
      rangeLabel: bounds.label,
      alerts: [],
      series: [],
      ranking: [],
      categoryShare: [],
      referrerMix: [],
    };
  }

  const [publishedNow, publishedPrev, viewsNow, viewsPrev] = await Promise.all([
    countPublishedByAuthor(db, authorIds, bounds, categoryId),
    countPublishedByAuthor(db, authorIds, previous, categoryId),
    pageviewsByAuthor(db, authorIds, bounds, attribution, categoryId),
    pageviewsByAuthor(db, authorIds, previous, attribution, categoryId),
  ]);

  const publishedMap = new Map(publishedNow.map((r) => [String(r._id), r.count]));
  const viewsMap = new Map(viewsNow.map((r) => [String(r._id), r.views]));
  const publishedTotal = [...publishedMap.values()].reduce((a, b) => a + b, 0);
  const pageviewsTotal = [...viewsMap.values()].reduce((a, b) => a + b, 0);
  const publishedPrevTotal = publishedPrev.reduce((a, b) => a + (b.count || 0), 0);
  const pageviewsPrevTotal = viewsPrev.reduce((a, b) => a + (b.views || 0), 0);

  const uniqueSet = new Set<string>();
  for (const row of viewsNow) {
    for (const u of row.uniques || []) uniqueSet.add(u);
  }

  // Discovered authors in range (including zero-activity rows)
  const activeWriters = users.length;

  const ranking: WritingRankItem[] = users
    .map((u) => {
      const published = publishedMap.get(String(u._id)) || 0;
      const pageviews = viewsMap.get(String(u._id)) || 0;
      return {
        userId: String(u._id),
        name: String(u.name || "Tanpa Nama"),
        published,
        pageviews,
        viewsPerArticle: published > 0 ? roundNumber(pageviews / published, 1) : 0,
      };
    })
    .sort((a, b) => b.pageviews - a.pageviews || b.published - a.published)
    .slice(0, 10);

  // Category share: output (published in range) + views (attribution-aware)
  const categoryShare = await buildCategoryShare(
    db,
    authorIds,
    bounds,
    attribution,
    categoryId,
  );

  // Referrer mix (public only)
  const articleIdsForReferrer = await db
    .collection("articles")
    .find(
      {
        ...authorIdMatch(authorIds),
        deletedAt: { $in: [null, ""] },
        ...(attribution === "publish_cohort"
          ? {
              status: "PUBLISHED",
              publishedAt: { $gte: bounds.start, $lt: bounds.end },
            }
          : {}),
        ...(categoryId ? { categoryId } : {}),
      },
      { projection: { _id: 1 } },
    )
    .toArray();

  const referrerRows = articleIdsForReferrer.length
    ? await db
        .collection("article_views")
        .find(
          {
            articleId: { $in: articleIdsForReferrer.map((a) => a._id) },
            viewedAt: { $gte: bounds.start, $lt: bounds.end },
          },
          { projection: { referrer: 1 } },
        )
        .toArray()
    : [];

  const referrerCounts = new Map<string, number>();
  let publicTotal = 0;
  for (const row of referrerRows) {
    const cls = classifyReferrer(row.referrer);
    if (cls === "internal_admin") continue;
    publicTotal += 1;
    referrerCounts.set(cls, (referrerCounts.get(cls) || 0) + 1);
  }
  const referrerMix = [...referrerCounts.entries()].map(([cls, views]) => ({
    class: cls,
    views,
    share: safePercent(views, publicTotal),
  }));

  // Daily series (published + views) — simplified using UTC date keys from aggregation
  const publishedDaily = await db
    .collection("articles")
    .aggregate<{ _id: string; count: number }>([
      {
        $match: {
          authorId: { $in: authorIds },
          status: "PUBLISHED",
          publishedAt: { $gte: bounds.start, $lt: bounds.end },
          deletedAt: { $in: [null, ""] },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$publishedAt",
              timezone: "Asia/Jakarta",
            },
          },
          count: { $sum: 1 },
        },
      },
    ])
    .toArray();

  const viewsDaily = articleIdsForReferrer.length
    ? await db
        .collection("article_views")
        .aggregate<{ _id: string; count: number }>([
          {
            $match: {
              articleId: { $in: articleIdsForReferrer.map((a) => a._id) },
              viewedAt: { $gte: bounds.start, $lt: bounds.end },
              ...publicViewReferrerMatch(),
            },
          },
          {
            $group: {
              _id: {
                $dateToString: {
                  format: "%Y-%m-%d",
                  date: "$viewedAt",
                  timezone: "Asia/Jakarta",
                },
              },
              count: { $sum: 1 },
            },
          },
        ])
        .toArray()
    : [];

  const publishedByDay = new Map(publishedDaily.map((r) => [r._id, r.count]));
  const viewsByDay = new Map(viewsDaily.map((r) => [r._id, r.count]));

  // Build series from Jakarta calendar days between bounds
  const series: WritingSeriesPoint[] = [];
  let cursor = DateTime.fromJSDate(bounds.start, { zone: "utc" })
    .setZone("Asia/Jakarta")
    .startOf("day");
  const end = DateTime.fromJSDate(bounds.end, { zone: "utc" }).setZone(
    "Asia/Jakarta",
  );
  while (cursor < end) {
    const key = cursor.toFormat("yyyy-MM-dd");
    series.push({
      date: key,
      published: publishedByDay.get(key) || 0,
      pageviews: viewsByDay.get(key) || 0,
    });
    cursor = cursor.plus({ days: 1 });
  }

  const alerts: WritingAlert[] = [];
  const idleWriters = users.length - activeWriters;
  if (idleWriters > 0 && users.length > 0) {
    alerts.push({
      type: "no_publish",
      severity: "warning",
      message: `${idleWriters} penulis tanpa artikel terbit pada rentang ini.`,
    });
  }
  if (publishedTotal > 0) {
    const topShare = safePercent(ranking[0]?.published || 0, publishedTotal);
    if (topShare >= 50) {
      alerts.push({
        type: "concentration",
        severity: "critical",
        message: `Konsentrasi tinggi: 1 penulis menyumbang ${topShare}% output.`,
      });
    }
  }
  const efficiencies = ranking
    .filter((r) => r.published > 0)
    .map((r) => r.viewsPerArticle);
  if (efficiencies.length >= 2) {
    const sorted = [...efficiencies].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const low = ranking.filter(
      (r) => r.published > 0 && r.viewsPerArticle < median * 0.4,
    );
    if (low.length > 0) {
      alerts.push({
        type: "low_efficiency",
        severity: "info",
        message: `${low.length} penulis memiliki views/artikel jauh di bawah median.`,
      });
    }
  }

  return {
    activeWriters,
    published: publishedTotal,
    pageviews: pageviewsTotal,
    viewsPerArticle:
      publishedTotal > 0 ? roundNumber(pageviewsTotal / publishedTotal, 1) : 0,
    approxUniques: uniqueSet.size,
    mom: {
      published: momGrowthRate(publishedTotal, publishedPrevTotal),
      pageviews: momGrowthRate(pageviewsTotal, pageviewsPrevTotal),
    },
    attribution,
    rangeLabel: bounds.label,
    alerts,
    series,
    ranking,
    categoryShare,
    referrerMix,
  };
}

export async function getWritingAuthorsLeaderboard(
  db: Db,
  options: {
    range?: string;
    from?: string;
    to?: string;
    attribution?: string;
    categoryId?: string;
    search?: string;
    page?: number;
    limit?: number;
    sort?: string;
    scopedUserIds?: string[] | null;
  },
): Promise<{ rows: WritingAuthorRow[]; total: number; page: number; limit: number }> {
  const attribution = parseAttributionMode(options.attribution);
  const bounds = resolveRangeBoundsWib({
    range: options.range,
    from: options.from,
    to: options.to,
  });
  const { previous } = getPreviousEqualBounds(bounds);
  const page = Math.max(1, options.page || 1);
  const limit = Math.min(100, Math.max(1, options.limit || 20));
  const categoryId =
    options.categoryId && ObjectId.isValid(options.categoryId)
      ? new ObjectId(options.categoryId)
      : null;

  const { users, authorIds } = await loadBehaviorAuthors(db, bounds, {
    search: options.search,
    scopedUserIds: options.scopedUserIds,
  });

  if (authorIds.length === 0) {
    return { rows: [], total: 0, page, limit };
  }

  const [publishedNow, publishedPrev, viewsNow, viewsPrev, revisions] =
    await Promise.all([
      countPublishedByAuthor(db, authorIds, bounds, categoryId),
      countPublishedByAuthor(db, authorIds, previous, categoryId),
      pageviewsByAuthor(db, authorIds, bounds, attribution, categoryId),
      pageviewsByAuthor(db, authorIds, previous, attribution, categoryId),
      revisionByAuthor(db, authorIds, bounds),
    ]);

  const publishedMap = new Map(publishedNow.map((r) => [String(r._id), r]));
  const publishedPrevMap = new Map(publishedPrev.map((r) => [String(r._id), r.count]));
  const viewsMap = new Map(viewsNow.map((r) => [String(r._id), r.views]));
  const viewsPrevMap = new Map(viewsPrev.map((r) => [String(r._id), r.views]));
  const totalViews = [...viewsMap.values()].reduce((a, b) => a + b, 0);

  let rows: WritingAuthorRow[] = users.map((u) => {
    const id = String(u._id);
    const published = publishedMap.get(id)?.count || 0;
    const pageviews = viewsMap.get(id) || 0;
    const rev = revisions.map.get(id) || { submitted: 0, rejected: 0 };
    return {
      userId: id,
      user: {
        _id: id,
        name: String(u.name || "Tanpa Nama"),
        email: String(u.email || ""),
        avatar: (u.avatar as string | null | undefined) ?? null,
        role: String(u.role || ""),
      },
      published,
      pageviews,
      viewsPerArticle: published > 0 ? roundNumber(pageviews / published, 1) : 0,
      contributionShare: safePercent(pageviews, totalViews),
      revisionRate: safePercent(rev.rejected, rev.submitted),
      submittedCount: rev.submitted,
      rejectedCount: rev.rejected,
      categoryTop: publishedMap.get(id)?.category || null,
      momPublished: momGrowthRate(published, publishedPrevMap.get(id) || 0),
      momPageviews: momGrowthRate(pageviews, viewsPrevMap.get(id) || 0),
    };
  });

  const sort = options.sort || "pageviews";
  rows.sort((a, b) => {
    switch (sort) {
      case "published":
        return b.published - a.published;
      case "viewsPerArticle":
        return b.viewsPerArticle - a.viewsPerArticle;
      case "revisionRate":
        return b.revisionRate - a.revisionRate;
      case "name":
        return a.user.name.localeCompare(b.user.name, "id-ID");
      case "pageviews":
      default:
        return b.pageviews - a.pageviews;
    }
  });

  const total = rows.length;
  const start = (page - 1) * limit;
  rows = rows.slice(start, start + limit);

  return { rows, total, page, limit };
}

export async function getWritingArticlesEngagement(
  db: Db,
  options: {
    range?: string;
    from?: string;
    to?: string;
    attribution?: string;
    categoryId?: string;
    search?: string;
    page?: number;
    limit?: number;
    sort?: "views" | "lifetime" | "publishedAt";
    scopedUserIds?: string[] | null;
  },
): Promise<{ rows: WritingArticleRow[]; total: number; page: number; limit: number }> {
  const attribution = parseAttributionMode(options.attribution);
  const bounds = resolveRangeBoundsWib({
    range: options.range,
    from: options.from,
    to: options.to,
  });
  const page = Math.max(1, options.page || 1);
  const limit = Math.min(100, Math.max(1, options.limit || 20));

  const { users, authorIds } = await loadBehaviorAuthors(db, bounds, {
    scopedUserIds: options.scopedUserIds,
  });

  if (authorIds.length === 0) {
    return { rows: [], total: 0, page, limit };
  }

  const authorNameById = new Map(
    users.map((u) => [String(u._id), String(u.name || "Tanpa Nama")]),
  );

  const match: Record<string, unknown> = {
    authorId: { $in: authorIds },
    deletedAt: { $in: [null, ""] },
  };
  if (options.categoryId && ObjectId.isValid(options.categoryId)) {
    match.categoryId = new ObjectId(options.categoryId);
  }
  if (attribution === "publish_cohort") {
    match.status = "PUBLISHED";
    match.publishedAt = { $gte: bounds.start, $lt: bounds.end };
  } else {
    match.status = { $in: ["PUBLISHED", "TAKEN_DOWN"] };
  }
  if (options.search && options.search.trim().length >= 2) {
    match.title = { $regex: options.search.trim(), $options: "i" };
  }

  const total = await db.collection("articles").countDocuments(match);
  const articles = await db
    .collection("articles")
    .find(match, {
      projection: {
        title: 1,
        slug: 1,
        status: 1,
        publishedAt: 1,
        authorId: 1,
        "category.name": 1,
        viewCount: 1,
      },
    })
    .toArray();

  const articleIds = articles.map((a) => a._id);
  const viewsAgg = articleIds.length
    ? await db
        .collection("article_views")
        .aggregate<{ _id: ObjectId; views: number }>([
          {
            $match: {
              articleId: { $in: articleIds },
              viewedAt: { $gte: bounds.start, $lt: bounds.end },
              ...publicViewReferrerMatch(),
            },
          },
          { $group: { _id: "$articleId", views: { $sum: 1 } } },
        ])
        .toArray()
    : [];
  const viewsMap = new Map(viewsAgg.map((v) => [String(v._id), v.views]));

  let rows: WritingArticleRow[] = articles.map((a) => ({
    articleId: String(a._id),
    title: a.title || "",
    slug: a.slug || "",
    status: a.status || "",
    publishedAt: a.publishedAt ? new Date(a.publishedAt).toISOString() : null,
    authorId: a.authorId ? String(a.authorId) : null,
    authorName: authorNameById.get(String(a.authorId)) || a.author?.name || "Tanpa Nama",
    categoryName: a.category?.name || "Tanpa Kategori",
    views: viewsMap.get(String(a._id)) || 0,
    lifetimeViews: a.viewCount || 0,
  }));

  const sort = options.sort || "views";
  rows.sort((a, b) => {
    if (sort === "lifetime") return b.lifetimeViews - a.lifetimeViews;
    if (sort === "publishedAt") {
      return (b.publishedAt || "").localeCompare(a.publishedAt || "");
    }
    return b.views - a.views;
  });

  const start = (page - 1) * limit;
  rows = rows.slice(start, start + limit);
  return { rows, total, page, limit };
}
