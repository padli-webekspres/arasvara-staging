import { Db, ObjectId } from "mongodb";
import { ROLES } from "@/lib/auth-client";
import { ArticleWriterReport } from "@/types/reports/reportArticle";

export interface ArticleWriterReportResult {
  reports: ArticleWriterReport[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface GetReportArticleWriterParams {
  page?: number;
  limit?: number;
  search?: string;
}

const WRITER_ROLES = [
  ROLES.REPORTER,
  ROLES.WRITER,
  ROLES.CONTRIBUTOR,
  ROLES.ADMIN,
];

const isValidObjectId = (value: string) => /^[a-f\d]{24}$/i.test(value);

export async function getReportArticleWriter(
  db: Db,
  { page = 1, limit = 20, search = "" }: GetReportArticleWriterParams = {},
): Promise<ArticleWriterReportResult> {
  const safePage = Math.max(1, page);
  const safeLimit = Math.max(1, Math.min(100, limit));
  const skip = (safePage - 1) * safeLimit;

  const usersCol = db.collection("users");
  const articlesCol = db.collection("articles");

  const userFilter: any = {
    role: { $in: WRITER_ROLES },
  };
  if (search.trim().length >= 2) {
    userFilter.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];
  }

  const [users, total] = await Promise.all([
    usersCol
      .find(userFilter, {
        projection: { _id: 1, name: 1, email: 1, avatar: 1, role: 1 },
      })
      .skip(skip)
      .limit(safeLimit)
      .toArray(),
    usersCol.countDocuments(userFilter),
  ]);

  if (users.length === 0) {
    return {
      reports: [],
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  const userIds = users.map((user) => String(user._id));
  const authorIdsAsObjectId = userIds
    .filter((id) => isValidObjectId(id))
    .map((id) => new ObjectId(id));
  const authorIdsAsString = userIds;

  const authorMatch = {
    $or: [
      { authorId: { $in: authorIdsAsString } },
      { authorId: { $in: authorIdsAsObjectId } },
    ],
  };

  const last30DaysStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [totalArticlesAgg, last30DaysAgg] = await Promise.all([
    articlesCol
      .aggregate([
        { $match: authorMatch },
        { $group: { _id: "$authorId", totalArticles: { $sum: 1 } } },
      ])
      .toArray(),
    articlesCol
      .aggregate([
        {
          $match: {
            ...authorMatch,
            createdAt: { $gte: last30DaysStart },
          },
        },
        {
          $group: {
            _id: "$authorId",
            articlesLast30Days: { $sum: 1 },
            readersLast30Days: { $sum: { $ifNull: ["$viewCount", 0] } },
          },
        },
      ])
      .toArray(),
  ]);

  const totalArticlesMap = new Map<string, number>();
  for (const row of totalArticlesAgg) {
    totalArticlesMap.set(String(row._id), row.totalArticles || 0);
  }

  const last30DaysMap = new Map<
    string,
    { articlesLast30Days: number; readersLast30Days: number }
  >();
  for (const row of last30DaysAgg) {
    last30DaysMap.set(String(row._id), {
      articlesLast30Days: row.articlesLast30Days || 0,
      readersLast30Days: row.readersLast30Days || 0,
    });
  }

  const reports: ArticleWriterReport[] = users.map((user) => {
    const id = String(user._id);
    const last30 = last30DaysMap.get(id) || {
      articlesLast30Days: 0,
      readersLast30Days: 0,
    };

    return {
      user: {
        _id: id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        role: user.role,
      },
      totalArticles: totalArticlesMap.get(id) || 0,
      articlesLast30Days: last30.articlesLast30Days,
      readersLast30Days: last30.readersLast30Days,
    };
  });

  return {
    reports,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit),
    },
  };
}
