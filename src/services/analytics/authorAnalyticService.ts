import { AuthorPerformance } from "@/types/analytics/authorAnalytics";

/**
 * Get performance stats for a given author (total, average, monthly views).
 * @param db - MongoDB Db instance
 * @param userId - Author's userId
 * @returns AuthorPerformance object or null if user not found
 */
export async function getAuthorPerformance(
  db: Db,
  userId: string,
): Promise<AuthorPerformance | null> {
  // 1. Get user profile
  const userDoc = await db
    .collection("users")
    .findOne({ _id: new ObjectId(userId), isActive: { $ne: false } });
  if (!userDoc) return null;
  const user: UserProfile = {
    _id: userDoc._id.toString(),
    name: userDoc.name,
    email: userDoc.email,
    avatar: userDoc.avatar,
    role: userDoc.role,
  };

  // 2. Get all articles by this author (with category info)
  const articlesRaw = await db
    .collection("articles")
    .aggregate([
      { $match: { authorId: new ObjectId(userId) } },
      { $sort: { publishedAt: -1, createdAt: -1 } },
      {
        $lookup: {
          from: "categories",
          localField: "categoryId",
          foreignField: "_id",
          as: "categoryObj",
        },
      },
      {
        $addFields: {
          category: { $arrayElemAt: ["$categoryObj", 0] },
        },
      },
      { $project: { categoryObj: 0, content: 0, tags: 0, excerpt: 0 } },
    ])
    .toArray();

  // 3. Calculate stats
  const now = new Date();
  const thisYear = now.getFullYear();
  const thisMonth = now.getMonth();
  const totalArticles = articlesRaw.length;
  let totalViews = 0;
  const articles: ArticlesAuthorSummary[] = articlesRaw.map((a: any) => {
    totalViews += a.viewCount || 0;
    return {
      _id: a._id.toString(),
      title: a.title,
      slug: a.slug,
      status: a.status,
      viewCount: a.viewCount || 0,
      publishedAt: a.publishedAt ? new Date(a.publishedAt) : new Date(0),
      featuredImage: a.featuredImage,
      category: a.category
        ? {
            _id: a.category._id?.toString?.() ?? "",
            name: a.category.name ?? "",
          }
        : { _id: "", name: "" },
    };
  });
  const averageViewsPerArticle =
    totalArticles > 0 ? totalViews / totalArticles : 0;

  // 4. Monthly views (only for months in this year, up to current month)
  // Build { '2026-01': 0, '2026-02': 0, ... }
  const monthlyViewsMap: Record<string, number> = {};
  for (let m = 0; m <= thisMonth; m++) {
    const key = `${thisYear}-${String(m + 1).padStart(2, "0")}`;
    monthlyViewsMap[key] = 0;
  }
  articlesRaw.forEach((a: any) => {
    if (a.publishedAt) {
      const d = new Date(a.publishedAt);
      if (d.getFullYear() === thisYear && d.getMonth() <= thisMonth) {
        const key = `${thisYear}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        monthlyViewsMap[key] += a.viewCount || 0;
      }
    }
  });
  const monthlyViews = Object.entries(monthlyViewsMap).map(
    ([month, views]) => ({ month, views }),
  );

  return {
    user,
    totalArticles,
    totalViews,
    averageViewsPerArticle,
    monthlyViews,
    articles,
  };
}
import { Db, ObjectId } from "mongodb";
import {
  AuthorArticles,
  ArticlesAuthorSummary,
} from "@/types/analytics/authorAnalytics";
import { UserProfile } from "@/types/user";

/**
 * Get all articles and stats for a given author.
 * @param db - MongoDB Db instance
 * @param userId - Author's userId
 * @returns AuthorArticles object or null if user not found
 */
export async function getAuthorArticles(
  db: Db,
  userId: string,
): Promise<AuthorArticles | null> {
  // 1. Get user profile
  const userDoc = await db
    .collection("users")
    .findOne({ _id: new ObjectId(userId), isActive: { $ne: false } });
  if (!userDoc) return null;
  const user: UserProfile = {
    _id: userDoc._id.toString(),
    name: userDoc.name,
    email: userDoc.email,
    avatar: userDoc.avatar,
    role: userDoc.role,
  };

  // 2. Get all articles by this author (with category info)
  const articlesRaw = await db
    .collection("articles")
    .aggregate([
      { $match: { authorId: new ObjectId(userId) } },
      { $sort: { publishedAt: -1, createdAt: -1 } },
      {
        $lookup: {
          from: "categories",
          localField: "categoryId",
          foreignField: "_id",
          as: "categoryObj",
        },
      },
      {
        $addFields: {
          category: { $arrayElemAt: ["$categoryObj", 0] },
        },
      },
      { $project: { categoryObj: 0, content: 0, tags: 0, excerpt: 0 } },
    ])
    .toArray();

  // 3. Calculate stats
  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();
  let articleCount = 0;
  let currentMonthCount = 0;
  let currentMonthPublishedCount = 0;
  const articles: ArticlesAuthorSummary[] = articlesRaw.map((a: any) => {
    articleCount++;
    const createdAt = a.createdAt ? new Date(a.createdAt) : new Date(0);
    const publishedAt = a.publishedAt ? new Date(a.publishedAt) : new Date(0);
    if (
      createdAt.getMonth() === thisMonth &&
      createdAt.getFullYear() === thisYear
    ) {
      currentMonthCount++;
    }
    if (
      a.status === "PUBLISHED" &&
      publishedAt.getMonth() === thisMonth &&
      publishedAt.getFullYear() === thisYear
    ) {
      currentMonthPublishedCount++;
    }
    return {
      _id: a._id.toString(),
      title: a.title,
      slug: a.slug,
      status: a.status,
      viewCount: a.viewCount || 0,
      publishedAt,
      featuredImage: a.featuredImage,
      category: a.category
        ? {
            _id: a.category._id?.toString?.() ?? "",
            name: a.category.name ?? "",
          }
        : { _id: "", name: "" },
    };
  });

  return {
    user,
    articleCount,
    currentMonthCount,
    currentMonthPublishedCount,
    articles,
  };
}
