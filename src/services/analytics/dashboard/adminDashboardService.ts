import { Db } from "mongodb";

export interface AdminDashboardStats {
  stafOnline: number;
  dailyAuditCount: number;
  totalMedia: number;
  pendingReviewCount: number;
  scheduledCount: number;
  pushFunnel: {
    successRate: number;
    successCount: number;
    failedCount: number;
  };
  roleDistribution: Array<{
    role: string;
    label: string;
    count: number;
    percentage: number;
    color: string;
  }>;
  recentLogs: Array<{
    id: string;
    action: string;
    target: string;
    user: string;
    time: string;
    createdAt: string;
    detail: string;
  }>;
  topCategories14d: Array<{
    categoryId: string;
    name: string;
    views: number;
    articleCount: number;
  }>;
  topAuthors14d: Array<{
    authorId: string;
    name: string;
    views: number;
    articleCount: number;
  }>;
  upcomingScheduled: Array<{
    id: string;
    title: string;
    scheduledAt: string;
    authorName: string;
  }>;
}

const articleObjectIdAddFields = {
  $addFields: {
    articleObjectId: {
      $cond: {
        if: { $eq: [{ $type: "$_id" }, "string"] },
        then: { $toObjectId: "$_id" },
        else: "$_id",
      },
    },
  },
};

/**
 * Mengambil analitik dashboard performa sistem khusus Super Admin.
 * Kueri dioptimalkan secara maksimal dengan menghapus pemindaian berkas orphan media,
 * serta menambahkan penghitungan cepat naskah PENDING_REVIEW & SCHEDULED secara paralel.
 */
export async function getAdminDashboardStats(
  db: Db,
): Promise<AdminDashboardStats> {
  const now = new Date();
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const [
    stafOnline,
    dailyAuditCount,
    totalMedia,
    pendingReviewCount,
    scheduledCount,
    pushFunnelResult,
    recentLogsRaw,
    rolesRaw,
    topCategoriesRaw,
    topAuthorsRaw,
    upcomingScheduledRaw,
  ] = await Promise.all([
    db.collection("users").countDocuments({
      $or: [
        { updatedAt: { $gte: fiveMinutesAgo } },
        { updatedAt: { $gte: fiveMinutesAgo.toISOString() } },
      ],
    }),
    db.collection("audit_log").countDocuments({
      createdAt: { $gte: twentyFourHoursAgo },
    }),
    db.collection("media").countDocuments(),
    db.collection("articles").countDocuments({
      status: "PENDING_REVIEW",
      $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }],
    }),
    db.collection("articles").countDocuments({
      status: "SCHEDULED",
      $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }],
    }),
    db
      .collection("notifications")
      .aggregate([
        {
          $group: {
            _id: "$isPushSent",
            count: { $sum: 1 },
          },
        },
      ])
      .toArray(),
    db.collection("audit_log").find({}).sort({ createdAt: -1 }).limit(5).toArray(),
    db
      .collection("users")
      .aggregate([
        {
          $group: {
            _id: "$role",
            count: { $sum: 1 },
          },
        },
      ])
      .toArray(),
    // Top 5 channel by views (14 hari) — article_views
    db
      .collection("article_views")
      .aggregate([
        { $match: { viewedAt: { $gte: fourteenDaysAgo } } },
        {
          $group: {
            _id: "$articleId",
            viewsCount: { $sum: 1 },
          },
        },
        articleObjectIdAddFields,
        {
          $lookup: {
            from: "articles",
            localField: "articleObjectId",
            foreignField: "_id",
            as: "article",
          },
        },
        { $unwind: "$article" },
        {
          $group: {
            _id: "$article.categoryId",
            views: { $sum: "$viewsCount" },
            articleCount: { $sum: 1 },
          },
        },
        { $sort: { views: -1 } },
        { $limit: 5 },
        {
          $addFields: {
            categoryObjectId: {
              $cond: {
                if: { $eq: [{ $type: "$_id" }, "string"] },
                then: { $toObjectId: "$_id" },
                else: "$_id",
              },
            },
          },
        },
        {
          $lookup: {
            from: "categories",
            localField: "categoryObjectId",
            foreignField: "_id",
            as: "category",
          },
        },
        { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },
      ])
      .toArray(),
    // Top 5 author by views (14 hari)
    db
      .collection("article_views")
      .aggregate([
        { $match: { viewedAt: { $gte: fourteenDaysAgo } } },
        {
          $group: {
            _id: "$articleId",
            viewsCount: { $sum: 1 },
          },
        },
        articleObjectIdAddFields,
        {
          $lookup: {
            from: "articles",
            localField: "articleObjectId",
            foreignField: "_id",
            as: "article",
          },
        },
        { $unwind: "$article" },
        {
          $group: {
            _id: "$article.authorId",
            views: { $sum: "$viewsCount" },
            articleCount: { $sum: 1 },
          },
        },
        { $sort: { views: -1 } },
        { $limit: 5 },
        {
          $addFields: {
            authorObjectId: {
              $cond: {
                if: { $eq: [{ $type: "$_id" }, "string"] },
                then: { $toObjectId: "$_id" },
                else: "$_id",
              },
            },
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "authorObjectId",
            foreignField: "_id",
            as: "author",
          },
        },
        { $unwind: { path: "$author", preserveNullAndEmptyArrays: true } },
      ])
      .toArray(),
    // 5 scheduled terdekat
    db
      .collection("articles")
      .aggregate([
        {
          $match: {
            status: "SCHEDULED",
            scheduledAt: { $ne: null },
            $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }],
          },
        },
        { $sort: { scheduledAt: 1 } },
        { $limit: 5 },
        {
          $addFields: {
            authorObjectId: {
              $cond: {
                if: { $eq: [{ $type: "$authorId" }, "string"] },
                then: { $toObjectId: "$authorId" },
                else: "$authorId",
              },
            },
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "authorObjectId",
            foreignField: "_id",
            as: "author",
          },
        },
        { $unwind: { path: "$author", preserveNullAndEmptyArrays: true } },
      ])
      .toArray(),
  ]);

  let successCount = 0;
  let failedCount = 0;
  pushFunnelResult.forEach((row) => {
    if (row._id === true) successCount = row.count;
    else if (row._id === false) failedCount = row.count;
  });
  const totalPush = successCount + failedCount;
  const successRate =
    totalPush > 0
      ? parseFloat(((successCount / totalPush) * 100).toFixed(1))
      : 100;

  const totalUsers = rolesRaw.reduce((sum, item) => sum + (item.count || 0), 0);
  const roleDistribution = rolesRaw.map((item) => {
    const rawRole = (item._id || "writer").toLowerCase();
    let label = "Content Writer";
    let color = "#E05A47";

    if (rawRole === "admin") {
      label = "Super Admin";
      color = "#0F172A";
    } else if (rawRole === "editor-in-chief") {
      label = "Pemimpin Redaksi";
      color = "#F59E0B";
    } else if (rawRole === "editor") {
      label = "Editor Redaksi";
      color = "#10B981";
    } else if (rawRole === "account-executive") {
      label = "Account Executive";
      color = "#64748B";
    }

    return {
      role: rawRole,
      label,
      count: item.count || 0,
      percentage:
        totalUsers > 0
          ? parseFloat((((item.count || 0) / totalUsers) * 100).toFixed(1))
          : 0,
      color,
    };
  });

  const recentLogs = recentLogsRaw.map((log: any) => {
    const createdDate =
      log.createdAt instanceof Date ? log.createdAt : new Date(log.createdAt);
    const diffMin = Math.max(
      0,
      Math.floor((now.getTime() - createdDate.getTime()) / 60000),
    );
    let timeLabel = `${diffMin}m lalu`;

    if (diffMin >= 60) {
      const diffHrs = Math.floor(diffMin / 60);
      timeLabel = `${diffHrs}j lalu`;
      if (diffHrs >= 24) {
        timeLabel = `${Math.floor(diffHrs / 24)} hari lalu`;
      }
    }

    const meta = log.meta && typeof log.meta === "object" ? log.meta : {};
    const articleTitle =
      typeof meta.articleTitle === "string" ? meta.articleTitle.trim() : "";
    const reason = typeof meta.reason === "string" ? meta.reason.trim() : "";
    const rawDetails =
      typeof log.details === "string" && log.details.trim()
        ? log.details.trim()
        : "";
    const detailsWithoutReason = reason
      ? rawDetails
          .replace(/\.\s*Alasan:\s*.+$/i, "")
          .replace(/^Alasan:\s*.+$/i, "")
          .trim()
      : rawDetails;

    const target =
      articleTitle ||
      (detailsWithoutReason
        ? detailsWithoutReason.length > 80
          ? `${detailsWithoutReason.slice(0, 80)}…`
          : detailsWithoutReason
        : "") ||
      (log.entity ? `${log.entity} #${log.entityId}` : "Platform CMS");

    const detail = reason
      ? detailsWithoutReason
        ? `${reason} — ${detailsWithoutReason}`
        : reason
      : rawDetails || "Modifikasi konfigurasi data Arasvara.";

    return {
      id: log._id.toString(),
      action: log.action || "MODIFY",
      target,
      user: log.actor?.name || "Sistem",
      time: timeLabel,
      createdAt: createdDate.toISOString(),
      detail,
    };
  });

  const topCategories14d = topCategoriesRaw.map((row: any) => ({
    categoryId: row._id?.toString?.() ?? String(row._id ?? ""),
    name: row.category?.name || "Tanpa channel",
    views: row.views || 0,
    articleCount: row.articleCount || 0,
  }));

  const topAuthors14d = topAuthorsRaw.map((row: any) => ({
    authorId: row._id?.toString?.() ?? String(row._id ?? ""),
    name: row.author?.name || "Anonim",
    views: row.views || 0,
    articleCount: row.articleCount || 0,
  }));

  const upcomingScheduled = upcomingScheduledRaw.map((art: any) => {
    const scheduled =
      art.scheduledAt instanceof Date
        ? art.scheduledAt
        : art.scheduledAt
          ? new Date(art.scheduledAt)
          : null;
    return {
      id: art._id.toString(),
      title: art.title || "Untitled",
      scheduledAt: scheduled && !Number.isNaN(scheduled.getTime())
        ? scheduled.toISOString()
        : "",
      authorName: art.author?.name || "Anonim",
    };
  });

  return {
    stafOnline,
    dailyAuditCount,
    totalMedia,
    pendingReviewCount,
    scheduledCount,
    pushFunnel: {
      successRate,
      successCount,
      failedCount,
    },
    roleDistribution,
    recentLogs,
    topCategories14d,
    topAuthors14d,
    upcomingScheduled,
  };
}
