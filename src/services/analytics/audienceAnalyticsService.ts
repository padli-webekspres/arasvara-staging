import { Db } from "mongodb";

export interface TrafficTrendDataPoint {
  date: string;
  views: number;
  uniqueVisitors: number;
}

interface TrafficTrendParams {
  startDate?: Date;
  endDate?: Date;
  interval?: "daily" | "weekly" | "monthly";
}

/**
 * Menghitung format ISO Week (YYYY-Wxx) untuk objek tanggal di zona waktu UTC.
 * Ini memastikan koordinasi yang sempurna dengan query MongoDB (%G-W%V).
 */
function getISOWeekString(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  const weekStr = weekNo.toString().padStart(2, "0");
  return `${d.getUTCFullYear()}-W${weekStr}`;
}

/**
 * Menghasilkan daftar tanggal/minggu/bulan kontinu di antara rentang tanggal yang ditentukan.
 * Digunakan untuk pengisian celah (gap filling / zero-padding) data time-series.
 */
function generateTemplatePoints(
  startDate: Date,
  endDate: Date,
  interval: "daily" | "weekly" | "monthly"
): TrafficTrendDataPoint[] {
  const points: TrafficTrendDataPoint[] = [];

  if (interval === "daily") {
    const current = new Date(startDate.getTime());
    current.setHours(0, 0, 0, 0);
    const end = new Date(endDate.getTime());
    end.setHours(0, 0, 0, 0);

    while (current <= end) {
      const year = current.getFullYear();
      const month = (current.getMonth() + 1).toString().padStart(2, "0");
      const day = current.getDate().toString().padStart(2, "0");
      points.push({
        date: `${year}-${month}-${day}`,
        views: 0,
        uniqueVisitors: 0,
      });
      current.setDate(current.getDate() + 1);
    }
  } else if (interval === "weekly") {
    const current = new Date(startDate.getTime());
    const seenWeeks = new Set<string>();

    while (current <= endDate) {
      const weekStr = getISOWeekString(current);
      if (!seenWeeks.has(weekStr)) {
        seenWeeks.add(weekStr);
        points.push({
          date: weekStr,
          views: 0,
          uniqueVisitors: 0,
        });
      }
      current.setDate(current.getDate() + 1);
    }
    
    // Periksa batas akhir secara eksplisit untuk mencegah pembulatan yang tertinggal
    const finalWeekStr = getISOWeekString(endDate);
    if (!seenWeeks.has(finalWeekStr)) {
      points.push({
        date: finalWeekStr,
        views: 0,
        uniqueVisitors: 0,
      });
    }
  } else if (interval === "monthly") {
    const current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

    while (current <= end) {
      const year = current.getFullYear();
      const month = (current.getMonth() + 1).toString().padStart(2, "0");
      points.push({
        date: `${year}-${month}`,
        views: 0,
        uniqueVisitors: 0,
      });
      current.setMonth(current.getMonth() + 1);
    }
  }

  return points;
}

/**
 * Mengambil data tren kunjungan (Total Views dan Unique Visitors) berdasarkan rentang tanggal dan interval.
 */
export async function getTrafficTrend(
  db: Db,
  { startDate, endDate, interval = "daily" }: TrafficTrendParams
): Promise<TrafficTrendDataPoint[]> {
  // 1. Tentukan tanggal default jika kosong (30 hari terakhir)
  const resolvedEnd = endDate ? new Date(endDate) : new Date();
  const resolvedStart = startDate ? new Date(startDate) : new Date();
  if (!startDate) {
    resolvedStart.setDate(resolvedEnd.getDate() - 30);
  }

  // 2. Tentukan format format penanggalan untuk grouping di MongoDB
  let dateFormat = "%Y-%m-%d"; // default daily
  if (interval === "weekly") {
    dateFormat = "%G-W%V"; // ISO 8601 year and week format (e.g. 2026-W21)
  } else if (interval === "monthly") {
    dateFormat = "%Y-%m";
  }

  const collectionName = "article_views";
  const pipeline = [
    // Tahap 1: Saring kunjungan berdasarkan rentang waktu
    {
      $match: {
        viewedAt: {
          $gte: resolvedStart,
          $lte: resolvedEnd,
        },
      },
    },
    // Tahap 2: Buat visitorId secara dinamis (sessionId -> ip -> unknown)
    {
      $addFields: {
        visitorId: {
          $cond: {
            if: {
              $and: [
                { $ne: ["$sessionId", null] },
                { $ne: ["$sessionId", ""] },
              ],
            },
            then: "$sessionId",
            else: { $ifNull: ["$ip", "unknown"] },
          },
        },
      },
    },
    // Tahap 3: Grup berdasarkan tanggal terformat
    {
      $group: {
        _id: { $dateToString: { format: dateFormat, date: "$viewedAt" } },
        views: { $sum: 1 },
        visitorsSet: { $addToSet: "$visitorId" },
      },
    },
    // Tahap 4: Proyeksikan data point tren
    {
      $project: {
        _id: 0,
        date: "$_id",
        views: "$views",
        uniqueVisitors: { $size: "$visitorsSet" },
      },
    },
    // Tahap 5: Urutkan secara kronologis
    {
      $sort: { date: 1 },
    },
  ];

  const dbResults = (await db
    .collection(collectionName)
    .aggregate(pipeline)
    .toArray()) as TrafficTrendDataPoint[];

  // 4. Lakukan pengisian celah (gap filling / zero-padding) di memori
  const templatePoints = generateTemplatePoints(resolvedStart, resolvedEnd, interval);
  const dbResultsMap = new Map<string, TrafficTrendDataPoint>();
  dbResults.forEach((point) => {
    dbResultsMap.set(point.date, point);
  });

  const finalResults = templatePoints.map((templatePoint) => {
    const matchedPoint = dbResultsMap.get(templatePoint.date);
    if (matchedPoint) {
      return matchedPoint;
    }
    return templatePoint;
  });

  return finalResults;
}

// ─── Distribution Analytics ────────────────────────────────────────────────

/**
 * Struktur data untuk distribusi format artikel (STANDARD vs GALLERY).
 */
export interface FormatDistributionItem {
  format: string; // "STANDARD" | "GALLERY"
  views: number;
  percentage: number;
}

/**
 * Struktur data untuk distribusi kategori artikel berdasarkan views.
 */
export interface CategoryDistributionItem {
  categoryId: string;
  categoryName: string;
  views: number;
  percentage: number;
}

/**
 * Struktur data untuk satu baris cross-correlation (format + kategori).
 */
export interface CrossCorrelationItem {
  format: string;
  categoryName: string;
  views: number;
}

/**
 * Gabungan response dari satu endpoint distribution.
 */
export interface DistributionAnalyticsResult {
  formatDistribution: FormatDistributionItem[];
  categoryDistribution: CategoryDistributionItem[];
  crossCorrelation: CrossCorrelationItem[];
}

// ─── Shared pipeline stage: join article_views → articles ─────────────────

/**
 * Menghasilkan tahap-tahap aggregation pipeline untuk:
 * 1. Filter article_views berdasarkan rentang waktu
 * 2. Lookup join ke collection articles
 * 3. Unwind hasil join (hanya ambil artikel yang ada)
 *
 * Digunakan bersama oleh ketiga service di bawah (DRY principle).
 */
function buildViewsToArticlesPipeline(startDate: Date, endDate: Date) {
  return [
    // Tahap 1: Filter rentang waktu
    {
      $match: {
        viewedAt: { $gte: startDate, $lte: endDate },
        deletedAt: null,
      },
    },
    // Tahap 2: Join ke collection articles
    // (articleId sudah tersimpan sebagai ObjectId, sehingga tidak perlu konversi)
    {
      $lookup: {
        from: "articles",
        localField: "articleId",
        foreignField: "_id",
        as: "article",
      },
    },
    // Tahap 3: Unwind & skip view tanpa artikel yang cocok
    {
      $unwind: {
        path: "$article",
        preserveNullAndEmptyArrays: false,
      },
    },
    // Tahap 4: Hanya artikel yang sudah published (hindari draft/taken down)
    {
      $match: {
        "article.status": "PUBLISHED",
      },
    },
  ];
}

/**
 * Mengambil distribusi tayangan berdasarkan format artikel (STANDARD vs GALLERY).
 *
 * Aggregation Pipeline:
 * article_views → lookup articles → group by format → hitung views & persentase
 */
export async function getFormatDistribution(
  db: Db,
  startDate: Date,
  endDate: Date
): Promise<FormatDistributionItem[]> {
  const pipeline = [
    ...buildViewsToArticlesPipeline(startDate, endDate),
    // Grup berdasarkan format artikel
    {
      $group: {
        _id: "$article.format",
        views: { $sum: 1 },
      },
    },
    {
      $project: {
        _id: 0,
        format: { $ifNull: ["$_id", "STANDARD"] }, // fallback ke STANDARD jika null
        views: 1,
      },
    },
    { $sort: { views: -1 } },
  ];

  const raw = await db
    .collection("article_views")
    .aggregate(pipeline)
    .toArray() as { format: string; views: number }[];

  // Hitung total untuk persentase
  const totalViews = raw.reduce((acc, item) => acc + item.views, 0);

  return raw.map((item) => ({
    format: item.format,
    views: item.views,
    percentage:
      totalViews > 0
        ? parseFloat(((item.views / totalViews) * 100).toFixed(1))
        : 0,
  }));
}

/**
 * Mengambil distribusi tayangan berdasarkan kategori artikel, diurutkan dari yang paling banyak dilihat.
 *
 * @param topN - Jumlah kategori teratas yang dikembalikan (default: 10)
 */
export async function getCategoryDistribution(
  db: Db,
  startDate: Date,
  endDate: Date,
  topN = 10
): Promise<CategoryDistributionItem[]> {
  const pipeline = [
    ...buildViewsToArticlesPipeline(startDate, endDate),
    // Lookup join ke collection categories untuk ambil nama kategori
    {
      $lookup: {
        from: "categories",
        localField: "article.categoryId",
        foreignField: "_id",
        as: "category",
      },
    },
    {
      $unwind: {
        path: "$category",
        preserveNullAndEmptyArrays: true, // tetap hitung meski kategori tidak ditemukan
      },
    },
    // Grup berdasarkan kategori
    {
      $group: {
        _id: {
          categoryId: "$article.categoryId",
          categoryName: { $ifNull: ["$category.name", "Tanpa Kategori"] },
        },
        views: { $sum: 1 },
      },
    },
    { $sort: { views: -1 } },
    { $limit: topN },
    {
      $project: {
        _id: 0,
        categoryId: { $toString: "$_id.categoryId" },
        categoryName: "$_id.categoryName",
        views: 1,
      },
    },
  ];

  const raw = await db
    .collection("article_views")
    .aggregate(pipeline)
    .toArray() as { categoryId: string; categoryName: string; views: number }[];

  // Hitung total untuk persentase
  const totalViews = raw.reduce((acc, item) => acc + item.views, 0);

  return raw.map((item) => ({
    categoryId: item.categoryId,
    categoryName: item.categoryName,
    views: item.views,
    percentage:
      totalViews > 0
        ? parseFloat(((item.views / totalViews) * 100).toFixed(1))
        : 0,
  }));
}

/**
 * Mengambil data cross-correlation antara format artikel dan kategori.
 * Menampilkan berapa views tiap kombinasi (format × kategori).
 *
 * Berguna untuk menjawab: "Di kategori mana artikel GALLERY lebih banyak ditonton?"
 *
 * @param topCategories - Hanya tampilkan N kategori paling populer (default: 5)
 */
export async function getCrossCorrelation(
  db: Db,
  startDate: Date,
  endDate: Date,
  topCategories = 5
): Promise<CrossCorrelationItem[]> {
  const pipeline = [
    ...buildViewsToArticlesPipeline(startDate, endDate),
    // Lookup join ke categories
    {
      $lookup: {
        from: "categories",
        localField: "article.categoryId",
        foreignField: "_id",
        as: "category",
      },
    },
    {
      $unwind: {
        path: "$category",
        preserveNullAndEmptyArrays: true,
      },
    },
    // Grup berdasarkan kombinasi format × kategori
    {
      $group: {
        _id: {
          format: { $ifNull: ["$article.format", "STANDARD"] },
          categoryName: { $ifNull: ["$category.name", "Tanpa Kategori"] },
        },
        views: { $sum: 1 },
      },
    },
    { $sort: { views: -1 } },
    {
      $project: {
        _id: 0,
        format: "$_id.format",
        categoryName: "$_id.categoryName",
        views: 1,
      },
    },
  ];

  const raw = await db
    .collection("article_views")
    .aggregate(pipeline)
    .toArray() as CrossCorrelationItem[];

  // Ambil N kategori populer secara keseluruhan
  const categoryViewMap = new Map<string, number>();
  for (const row of raw) {
    const existing = categoryViewMap.get(row.categoryName) ?? 0;
    categoryViewMap.set(row.categoryName, existing + row.views);
  }

  // Urutkan dan ambil topCategories nama kategori teratas
  const topCategoryNames = [...categoryViewMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topCategories)
    .map(([name]) => name);

  // Filter hanya baris yang masuk dalam kategori teratas
  return raw.filter((row) => topCategoryNames.includes(row.categoryName));
}

// ─── Engagement per Artikel ──────────────────────────────────────────────────

export interface ArticleEngagementReport {
  articleId: string;
  title: string;
  slug: string;
  authorName: string;
  categoryName: string;
  format: "STANDARD" | "GALLERY";
  totalViews: number;
  viewsLast30Days: number;
  publishedAt: string;
}

export interface EngagementResult {
  data: ArticleEngagementReport[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Mengambil data performa per artikel.
 * Mengkombinasikan metadata dari tabel articles (total views)
 * dengan penjumlahan dari tabel article_views dalam 30 hari terakhir.
 */
export async function getArticleEngagement(
  db: Db,
  params: {
    page?: number;
    limit?: number;
    search?: string;
    categoryId?: string;
    format?: string;
  }
): Promise<EngagementResult> {
  const { page = 1, limit = 10, search = "", categoryId = "", format = "" } = params;
  const skip = (page - 1) * limit;

  // 1. Match filter utama pada koleksi articles
  const matchStage: any = {
    status: "PUBLISHED",
  };

  if (search) {
    matchStage.title = { $regex: search, $options: "i" };
  }
  if (categoryId) {
    const { ObjectId } = require("mongodb");
    if (ObjectId.isValid(categoryId)) {
      matchStage.categoryId = new ObjectId(categoryId);
    }
  }
  if (format && format !== "ALL") {
    matchStage.format = format;
  }

  // 2. Hitung total artikel yang cocok untuk paginasi
  const total = await db.collection("articles").countDocuments(matchStage);

  if (total === 0) {
    return { data: [], total: 0, page, limit, totalPages: 0 };
  }

  // 3. Tarik paginated artikel dengan relasi author & category
  const articlesRaw = await db
    .collection("articles")
    .aggregate([
      { $match: matchStage },
      { $sort: { viewCount: -1, publishedAt: -1 } }, // Prioritaskan views terbanyak
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: "users",
          localField: "authorId",
          foreignField: "_id",
          as: "author",
        },
      },
      {
        $lookup: {
          from: "categories",
          localField: "categoryId",
          foreignField: "_id",
          as: "category",
        },
      },
      { $unwind: { path: "$author", preserveNullAndEmptyArrays: true } },
      { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          title: 1,
          slug: 1,
          format: 1,
          viewCount: 1,
          publishedAt: 1,
          "author.name": 1,
          "category.name": 1,
        },
      },
    ])
    .toArray();

  if (articlesRaw.length === 0) {
    return { data: [], total: 0, page, limit, totalPages: 0 };
  }

  // 4. Hitung views 30 hari terakhir khusus untuk kumpulan artikel halaman ini saja
  const articleIds = articlesRaw.map((a) => a._id);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const recentViews = await db
    .collection("article_views")
    .aggregate([
      {
        $match: {
          articleId: { $in: articleIds },
          viewedAt: { $gte: thirtyDaysAgo },
        },
      },
      {
        $group: {
          _id: "$articleId",
          views: { $sum: 1 },
        },
      },
    ])
    .toArray();

  // Mapping hasil views 30 hari terakhir ke dalam Map agar mudah dicari O(1)
  const recentViewsMap = new Map<string, number>();
  for (const row of recentViews) {
    recentViewsMap.set(row._id.toString(), row.views);
  }

  // 5. Susun dan mapping data akhir sesuai interface
  const data: ArticleEngagementReport[] = articlesRaw.map((a) => {
    const totalViews = typeof a.viewCount === "number" ? a.viewCount : 0;
    const viewsLast30Days = recentViewsMap.get(a._id.toString()) || 0;
    
    // Cegah angka persentase aneh (contoh: 30 days view lebih besar dari view count DB jika delay sinkronisasi cron)
    const normalizedViewsLast30Days = Math.min(viewsLast30Days, totalViews);

    return {
      articleId: a._id.toString(),
      title: a.title,
      slug: a.slug,
      authorName: a.author?.name || "Tidak Diketahui",
      categoryName: a.category?.name || "Tanpa Kategori",
      format: (a.format as "STANDARD" | "GALLERY") || "STANDARD",
      totalViews,
      viewsLast30Days: normalizedViewsLast30Days,
      publishedAt: a.publishedAt ? new Date(a.publishedAt).toISOString() : "",
    };
  });

  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

