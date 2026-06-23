import { Db, ObjectId } from "mongodb";
import { ADS_HOMEPAGE_COLLECTION } from "@/services/ads/AdsHomepageService";
import { ADS_ARTICLE_COLLECTION } from "@/services/ads/AdsSingleArticleService";
import { AD_CLICK_EVENTS_COLLECTION } from "@/services/ads/adClickService";
import type {
  AEDashboardData,
  AEDashboardStats,
  AEAdClickContributor,
  AEArticleCategoryClicks,
  AEClicksTrendDay,
  AEExpiringAdItem,
  AEPlatformClicks,
  AERunningAdItem,
} from "@/types/analytics/aeDashboard";

const JAKARTA_TZ = "Asia/Jakarta";
const DEFAULT_TREND_DAYS = 30;
const EXPIRING_LIMIT = 20;
const RUNNING_LIMIT = 50;
const TOP_ADS_PER_DAY = 3;
const TOP_ADS_PER_CATEGORY = 3;
const TOP_PLATFORM_ADS = 3;

const MONTHS_SHORT_ID = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
] as const;

const NOT_DELETED = {
  $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
};

function startOfDayInJakarta(date: Date): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: JAKARTA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const y = Number(parts.find((p) => p.type === "year")?.value);
  const m = Number(parts.find((p) => p.type === "month")?.value);
  const d = Number(parts.find((p) => p.type === "day")?.value);

  return new Date(Date.UTC(y, m - 1, d, -7, 0, 0, 0));
}

function toDateKeyJakarta(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: JAKARTA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function formatTrendLabel(dateKey: string): string {
  const [, month, day] = dateKey.split("-");
  const monthIndex = Math.max(0, Math.min(11, parseInt(month, 10) - 1));
  return `${parseInt(day, 10)} ${MONTHS_SHORT_ID[monthIndex]}`;
}

function formatRemaining(endedAt: Date, now: Date): string {
  const ms = endedAt.getTime() - now.getTime();
  if (ms <= 0) return "Berakhir";

  const totalMinutes = Math.floor(ms / 60_000);
  if (totalMinutes < 60) {
    return `${totalMinutes} menit`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours < 24) {
    return minutes > 0 ? `${hours} jam ${minutes} menit` : `${hours} jam`;
  }

  const days = Math.floor(hours / 24);
  const remainHours = hours % 24;
  return remainHours > 0 ? `${days} hari ${remainHours} jam` : `${days} hari`;
}

function formatEndsAt(endedAt: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: JAKARTA_TZ,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(endedAt);
}

function bannerUrlFromDoc(doc: Record<string, unknown>): string {
  const banner = doc.banner as { url?: string } | undefined;
  return typeof banner?.url === "string" ? banner.url : "";
}

function mapRunningRow(
  doc: Record<string, unknown>,
  now: Date,
): AERunningAdItem {
  const endedAt =
    doc.endedAt instanceof Date ? doc.endedAt : new Date(String(doc.endedAt));

  return {
    id: String(doc._id),
    name: typeof doc.name === "string" ? doc.name : "Iklan",
    clicks: typeof doc.clicks === "number" ? doc.clicks : 0,
    remaining: formatRemaining(endedAt, now),
    bannerUrl: bannerUrlFromDoc(doc),
    positionOrPlacement:
      typeof doc.position === "string"
        ? doc.position
        : typeof doc.placement === "string"
          ? doc.placement
          : undefined,
  };
}

function mapExpiringRow(
  doc: Record<string, unknown> & { source?: string },
  now: Date,
): AEExpiringAdItem {
  const endedAt =
    doc.endedAt instanceof Date ? doc.endedAt : new Date(String(doc.endedAt));

  return {
    id: String(doc._id),
    name: typeof doc.name === "string" ? doc.name : "Iklan",
    type: doc.source === "article" ? "article" : "homepage",
    remaining: formatRemaining(endedAt, now),
    endsAt: formatEndsAt(endedAt),
    bannerUrl: bannerUrlFromDoc(doc),
  };
}

function buildDateKeysRange(now: Date, days: number): string[] {
  const keys: string[] = [];
  const start = startOfDayInJakarta(now);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() - i);
    keys.push(toDateKeyJakarta(d));
  }
  return keys;
}

function fillClicksTrend(
  dailyRows: Array<{
    dateKey: string;
    clicks: number;
    homepageClicks: number;
    articleClicks: number;
  }>,
  topByDay: Map<string, AEAdClickContributor[]>,
  dateKeys: string[],
): AEClicksTrendDay[] {
  const byKey = new Map(dailyRows.map((r) => [r.dateKey, r]));

  return dateKeys.map((dateKey) => {
    const row = byKey.get(dateKey);
    return {
      dateKey,
      date: formatTrendLabel(dateKey),
      clicks: row?.clicks ?? 0,
      homepageClicks: row?.homepageClicks ?? 0,
      articleClicks: row?.articleClicks ?? 0,
      topAds: topByDay.get(dateKey) ?? [],
    };
  });
}

async function aggregateAdsUnionFacet(
  db: Db,
  now: Date,
  thirtyDaysAgo: Date,
  threeDaysLater: Date,
) {
  const facetResult = await db.collection(ADS_HOMEPAGE_COLLECTION).aggregate([
    { $match: NOT_DELETED },
    {
      $project: {
        source: { $literal: "homepage" },
        name: 1,
        clicks: { $ifNull: ["$clicks", 0] },
        banner: 1,
        position: "$position",
        placement: { $literal: null },
        createdAt: 1,
        startedAt: 1,
        endedAt: 1,
        isActive: { $ifNull: ["$isActive", true] },
      },
    },
    {
      $unionWith: {
        coll: ADS_ARTICLE_COLLECTION,
        pipeline: [
          { $match: NOT_DELETED },
          {
            $project: {
              source: { $literal: "article" },
              name: 1,
              clicks: { $ifNull: ["$clicks", 0] },
              banner: 1,
              position: { $literal: null },
              placement: "$placement",
              createdAt: 1,
              startedAt: 1,
              endedAt: 1,
              isActive: { $ifNull: ["$isActive", true] },
            },
          },
        ],
      },
    },
    {
      $addFields: {
        isRunning: {
          $and: [
            { $eq: ["$isActive", true] },
            { $lte: ["$startedAt", now] },
            { $gte: ["$endedAt", now] },
          ],
        },
      },
    },
    {
      $facet: {
        kpi: [
          {
            $group: {
              _id: null,
              totalClicks: { $sum: "$clicks" },
              activeAdsCount: {
                $sum: { $cond: ["$isRunning", 1, 0] },
              },
              adsAddedLast30Days: {
                $sum: {
                  $cond: [{ $gte: ["$createdAt", thirtyDaysAgo] }, 1, 0],
                },
              },
            },
          },
        ],
        expiringSoon: [
          {
            $match: {
              isRunning: true,
              endedAt: { $lte: threeDaysLater, $gte: now },
            },
          },
          { $sort: { endedAt: 1 } },
          { $limit: EXPIRING_LIMIT },
        ],
        runningHomepage: [
          { $match: { source: "homepage", isRunning: true } },
          { $sort: { clicks: -1 } },
          { $limit: RUNNING_LIMIT },
        ],
        runningArticle: [
          { $match: { source: "article", isRunning: true } },
          { $sort: { clicks: -1 } },
          { $limit: RUNNING_LIMIT },
        ],
        platformLifetime: [
          {
            $group: {
              _id: "$source",
              clicks: { $sum: "$clicks" },
            },
          },
        ],
        topHomepageLifetime: [
          { $match: { source: "homepage" } },
          { $sort: { clicks: -1 } },
          { $limit: TOP_PLATFORM_ADS },
          { $project: { name: 1, clicks: 1 } },
        ],
        topArticleLifetime: [
          { $match: { source: "article" } },
          { $sort: { clicks: -1 } },
          { $limit: TOP_PLATFORM_ADS },
          { $project: { name: 1, clicks: 1 } },
        ],
      },
    },
  ]).toArray();

  return facetResult[0] as {
    kpi: Array<{
      totalClicks: number;
      activeAdsCount: number;
      adsAddedLast30Days: number;
    }>;
    expiringSoon: Record<string, unknown>[];
    runningHomepage: Record<string, unknown>[];
    runningArticle: Record<string, unknown>[];
    platformLifetime: Array<{ _id: string; clicks: number }>;
    topHomepageLifetime: Array<{ name: string; clicks: number }>;
    topArticleLifetime: Array<{ name: string; clicks: number }>;
  };
}

async function aggregateArticleClicksByCategory(
  db: Db,
  now: Date,
): Promise<AEArticleCategoryClicks[]> {
  const [categoryAgg, categoryDocs] = await Promise.all([
    db.collection(ADS_ARTICLE_COLLECTION).aggregate([
      { $match: NOT_DELETED },
      {
        $addFields: {
          refNow: now,
          categoryCount: {
            $max: [{ $size: { $ifNull: ["$categories", []] } }, 1],
          },
        },
      },
      { $unwind: "$categories" },
      {
        $addFields: {
          attributedClicks: {
            $divide: [{ $ifNull: ["$clicks", 0] }, "$categoryCount"],
          },
          isRunning: {
            $and: [
              { $eq: [{ $ifNull: ["$isActive", true] }, true] },
              { $lte: ["$startedAt", "$refNow"] },
              { $gte: ["$endedAt", "$refNow"] },
            ],
          },
        },
      },
      {
        $group: {
          _id: "$categories.slug",
          categoryId: { $first: "$categories._id" },
          clicks: { $sum: "$attributedClicks" },
          activeAdsCount: {
            $sum: { $cond: ["$isRunning", 1, 0] },
          },
        },
      },
      { $sort: { clicks: -1 } },
      { $limit: 20 },
    ]).toArray(),
    db
      .collection("categories")
      .find({})
      .project({ slug: 1, name: 1 })
      .toArray(),
  ]);

  const nameBySlug = new Map<string, string>();
  for (const cat of categoryDocs) {
    const slug = typeof cat.slug === "string" ? cat.slug : "";
    if (slug) {
      nameBySlug.set(
        slug,
        typeof cat.name === "string" ? cat.name : slug,
      );
    }
  }

  const slugs = categoryAgg
    .map((row) => String(row._id ?? "").trim())
    .filter(Boolean);

  const topAdsBySlug = new Map<string, AEAdClickContributor[]>();

  if (slugs.length > 0) {
    const topAdsRaw = await db.collection(ADS_ARTICLE_COLLECTION).aggregate([
      { $match: NOT_DELETED },
      { $unwind: "$categories" },
      { $match: { "categories.slug": { $in: slugs } } },
      {
        $group: {
          _id: { slug: "$categories.slug", adId: "$_id" },
          name: { $first: "$name" },
          clicks: { $first: { $ifNull: ["$clicks", 0] } },
        },
      },
      { $sort: { clicks: -1 } },
      {
        $group: {
          _id: "$_id.slug",
          topAds: {
            $push: { name: "$name", clicks: "$clicks" },
          },
        },
      },
      {
        $project: {
          topAds: { $slice: ["$topAds", TOP_ADS_PER_CATEGORY] },
        },
      },
    ]).toArray();

    for (const row of topAdsRaw) {
      const slug = String(row._id ?? "");
      const ads = Array.isArray(row.topAds) ? row.topAds : [];
      topAdsBySlug.set(
        slug,
        ads.map((a: { name?: string; clicks?: number }) => ({
          name: typeof a.name === "string" ? a.name : "Iklan",
          clicks: typeof a.clicks === "number" ? a.clicks : 0,
        })),
      );
    }
  }

  return categoryAgg.map((row) => {
    const slug = String(row._id ?? "");
    const categoryId =
      row.categoryId instanceof ObjectId
        ? row.categoryId.toString()
        : String(row.categoryId ?? slug);

    return {
      categoryId,
      categorySlug: slug,
      categoryName: nameBySlug.get(slug) ?? slug,
      clicks: Math.round(Number(row.clicks) || 0),
      activeAdsCount: Number(row.activeAdsCount) || 0,
      topAds: topAdsBySlug.get(slug) ?? [],
    };
  });
}

async function aggregateClickEvents(
  db: Db,
  rangeStart: Date,
  dateKeys: string[],
): Promise<{
  daily: Array<{
    dateKey: string;
    clicks: number;
    homepageClicks: number;
    articleClicks: number;
  }>;
  topByDay: Map<string, AEAdClickContributor[]>;
  platformPeriod: AEPlatformClicks;
}> {
  const eventsCol = db.collection(AD_CLICK_EVENTS_COLLECTION);

  const [dailyRaw, topRaw, platformPeriodRaw, topHpPeriod, topArtPeriod] =
    await Promise.all([
      eventsCol
        .aggregate([
          { $match: { clickedAt: { $gte: rangeStart } } },
          {
            $group: {
              _id: {
                $dateToString: {
                  format: "%Y-%m-%d",
                  date: "$clickedAt",
                  timezone: JAKARTA_TZ,
                },
              },
              clicks: { $sum: 1 },
              homepageClicks: {
                $sum: {
                  $cond: [{ $eq: ["$adType", "homepage"] }, 1, 0],
                },
              },
              articleClicks: {
                $sum: {
                  $cond: [{ $eq: ["$adType", "article"] }, 1, 0],
                },
              },
            },
          },
          { $sort: { _id: 1 } },
        ])
        .toArray(),
      eventsCol
        .aggregate([
          { $match: { clickedAt: { $gte: rangeStart } } },
          {
            $group: {
              _id: {
                day: {
                  $dateToString: {
                    format: "%Y-%m-%d",
                    date: "$clickedAt",
                    timezone: JAKARTA_TZ,
                  },
                },
                adName: "$adName",
              },
              clicks: { $sum: 1 },
            },
          },
          { $sort: { "_id.day": 1, clicks: -1 } },
          {
            $group: {
              _id: "$_id.day",
              topAds: {
                $push: { name: "$_id.adName", clicks: "$clicks" },
              },
            },
          },
          {
            $project: {
              topAds: { $slice: ["$topAds", TOP_ADS_PER_DAY] },
            },
          },
        ])
        .toArray(),
      eventsCol
        .aggregate([
          { $match: { clickedAt: { $gte: rangeStart } } },
          {
            $group: {
              _id: "$adType",
              clicks: { $sum: 1 },
            },
          },
        ])
        .toArray(),
      eventsCol
        .aggregate([
          { $match: { clickedAt: { $gte: rangeStart }, adType: "homepage" } },
          { $group: { _id: "$adId", name: { $first: "$adName" }, clicks: { $sum: 1 } } },
          { $sort: { clicks: -1 } },
          { $limit: TOP_PLATFORM_ADS },
        ])
        .toArray(),
      eventsCol
        .aggregate([
          { $match: { clickedAt: { $gte: rangeStart }, adType: "article" } },
          { $group: { _id: "$adId", name: { $first: "$adName" }, clicks: { $sum: 1 } } },
          { $sort: { clicks: -1 } },
          { $limit: TOP_PLATFORM_ADS },
        ])
        .toArray(),
    ]);

  const topByDay = new Map<string, AEAdClickContributor[]>();
  for (const row of topRaw) {
    const day = String(row._id ?? "");
    const ads = Array.isArray(row.topAds) ? row.topAds : [];
    topByDay.set(
      day,
      ads.map((a: { name?: string; clicks?: number }) => ({
        name: typeof a.name === "string" ? a.name : "Iklan",
        clicks: typeof a.clicks === "number" ? a.clicks : 0,
      })),
    );
  }

  const daily = dailyRaw.map((row) => ({
    dateKey: String(row._id),
    clicks: Number(row.clicks) || 0,
    homepageClicks: Number(row.homepageClicks) || 0,
    articleClicks: Number(row.articleClicks) || 0,
  }));

  let homepageClicks = 0;
  let articleClicks = 0;
  for (const row of platformPeriodRaw) {
    if (row._id === "homepage") homepageClicks = Number(row.clicks) || 0;
    if (row._id === "article") articleClicks = Number(row.clicks) || 0;
  }

  const mapTop = (rows: Array<{ name?: string; clicks?: number }>) =>
    rows.map((r) => ({
      name: typeof r.name === "string" ? r.name : "Iklan",
      clicks: typeof r.clicks === "number" ? r.clicks : 0,
    }));

  return {
    daily,
    topByDay,
    platformPeriod: {
      homepageClicks,
      articleClicks,
      topHomepageAds: mapTop(topHpPeriod),
      topArticleAds: mapTop(topArtPeriod),
    },
  };
}

export interface GetAEDashboardOptions {
  /** Jumlah hari untuk tren & pie periode (default 30). */
  trendDays?: number;
}

/**
 * Dashboard Account Executive — satu entry-point dengan kueri paralel teroptimasi.
 *
 * Sumber data:
 * - `ads_homepage` / `ads_article`: KPI, iklan berjalan, segera berakhir, klik per kategori
 * - `sponsors`: jumlah sponsor aktif
 * - `ad_click_events`: tren harian & perbandingan beranda vs artikel (periode)
 */
export async function getAEDashboardData(
  db: Db,
  options: GetAEDashboardOptions = {},
): Promise<AEDashboardData> {
  const trendDays = Math.min(
    90,
    Math.max(7, options.trendDays ?? DEFAULT_TREND_DAYS),
  );
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const threeDaysLater = new Date(now);
  threeDaysLater.setDate(threeDaysLater.getDate() + 3);

  const rangeStart = startOfDayInJakarta(now);
  rangeStart.setUTCDate(rangeStart.getUTCDate() - (trendDays - 1));

  const dateKeys = buildDateKeysRange(now, trendDays);

  const [unionFacet, activeSponsorsCount, articleClicksByCategory, clickEvents] =
    await Promise.all([
      aggregateAdsUnionFacet(db, now, thirtyDaysAgo, threeDaysLater),
      db.collection("sponsors").countDocuments(),
      aggregateArticleClicksByCategory(db, now),
      aggregateClickEvents(db, rangeStart, dateKeys),
    ]);

  const kpiRow = unionFacet.kpi[0];
  const stats: AEDashboardStats = {
    totalClicks: kpiRow?.totalClicks ?? 0,
    adsAddedLast30Days: kpiRow?.adsAddedLast30Days ?? 0,
    activeAdsCount: kpiRow?.activeAdsCount ?? 0,
    activeSponsorsCount,
  };

  const clicksTrend = fillClicksTrend(
    clickEvents.daily,
    clickEvents.topByDay,
    dateKeys,
  );

  const lifetimeHp =
    unionFacet.platformLifetime.find((r) => r._id === "homepage")?.clicks ?? 0;
  const lifetimeArt =
    unionFacet.platformLifetime.find((r) => r._id === "article")?.clicks ?? 0;

  const hasPeriodEvents =
    clickEvents.platformPeriod.homepageClicks +
      clickEvents.platformPeriod.articleClicks >
    0;

  const platformClicks: AEPlatformClicks = hasPeriodEvents
    ? clickEvents.platformPeriod
    : {
        homepageClicks: lifetimeHp,
        articleClicks: lifetimeArt,
        topHomepageAds: unionFacet.topHomepageLifetime.map((r) => ({
          name: r.name,
          clicks: r.clicks,
        })),
        topArticleAds: unionFacet.topArticleLifetime.map((r) => ({
          name: r.name,
          clicks: r.clicks,
        })),
      };

  return {
    stats,
    clicksTrend,
    articleClicksByCategory,
    platformClicks,
    expiringSoon: unionFacet.expiringSoon.map((doc) =>
      mapExpiringRow(doc, now),
    ),
    runningHomepage: unionFacet.runningHomepage.map((doc) =>
      mapRunningRow(doc, now),
    ),
    runningArticle: unionFacet.runningArticle.map((doc) =>
      mapRunningRow(doc, now),
    ),
    trendDays,
  };
}
