import { Db, Document, ObjectId } from "mongodb";
import {
  Article,
  GetAllArticlesParams,
  GetAllArticlesResult,
} from "@/types/article";
import logger from "@/lib/logger";
import {
  FEATURED_IMAGE_LOOKUP_STAGES,
  mapDocToArticle,
} from "@/lib/helper-article";

/** Cursor hanya jika halaman penuh — artinya masih mungkin ada halaman berikutnya. */
function nextPublishedAtCursor(
  articles: Article[],
  limit: number,
): string | null {
  if (articles.length < limit) return null;
  const last = [...articles].reverse().find((a) => a.publishedAt);
  return last?.publishedAt?.toISOString() ?? null;
}

export async function getHeadlines(db: Db, limit = 5): Promise<Article[]> {
  let docs: Document[] = [];
  try {
    docs = await db
      .collection("articles")
      .aggregate([
        { $match: { status: "PUBLISHED", isHeadline: true } },
        { $sort: { publishedAt: -1 } },
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
        {
          $lookup: {
            from: "users",
            localField: "authorId",
            foreignField: "_id",
            as: "authorObj",
          },
        },
        {
          $addFields: {
            author: { $arrayElemAt: ["$authorObj", 0] },
          },
        },
        { $group: { _id: "$slug", doc: { $first: "$$ROOT" } } },
        { $replaceRoot: { newRoot: "$doc" } },
        // Backward-compat: populate featuredImage media for old ObjectId-ref articles
        ...FEATURED_IMAGE_LOOKUP_STAGES,
        { $limit: limit },
        { $project: { categoryObj: 0, authorObj: 0 } },
      ])
      .toArray();
    if (!docs || docs.length === 0) {
      logger.error({ limit }, "getHeadlines: No headlines found");
      throw Object.assign(new Error("No headlines found"), { status: 404 });
    }
  } catch (error) {
    logger.error({ limit, error }, "getHeadlines: Error fetching headlines");
    throw error;
  }

  return Promise.all(docs.map((doc) => mapDocToArticle(doc)));
}

export async function getBreakingNews(db: Db, limit = 8): Promise<Article[]> {
  let docs: Document[] = [];
  try {
    docs = await db
      .collection("articles")
      .aggregate([
        { $match: { status: "PUBLISHED", isBreaking: true } },
        { $sort: { publishedAt: -1 } },
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
        {
          $lookup: {
            from: "users",
            localField: "authorId",
            foreignField: "_id",
            as: "authorObj",
          },
        },
        {
          $addFields: {
            author: { $arrayElemAt: ["$authorObj", 0] },
          },
        },
        { $group: { _id: "$slug", doc: { $first: "$$ROOT" } } },
        { $replaceRoot: { newRoot: "$doc" } },
        // Backward-compat: populate featuredImage media for old ObjectId-ref articles
        ...FEATURED_IMAGE_LOOKUP_STAGES,
        { $limit: limit },
        { $project: { categoryObj: 0, authorObj: 0 } },
      ])
      .toArray();
    if (!docs || docs.length === 0) {
      logger.error({ limit }, "getBreakingNews: No breaking news found");
      throw Object.assign(new Error("No breaking news found"), { status: 404 });
    }
  } catch (error) {
    logger.error(
      { limit, error },
      "getBreakingNews: Error fetching breaking news",
    );
    throw error;
  }

  return Promise.all(docs.map((doc) => mapDocToArticle(doc)));
}

export async function getFeaturedArticles(
  db: Db,
  limit = 6,
): Promise<Article[]> {
  let docs: Document[] = [];
  try {
    docs = await db
      .collection("articles")
      .aggregate([
        { $match: { status: "PUBLISHED", isFeatured: true } },
        { $sort: { publishedAt: -1 } },
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
        {
          $lookup: {
            from: "users",
            localField: "authorId",
            foreignField: "_id",
            as: "authorObj",
          },
        },
        {
          $addFields: {
            author: { $arrayElemAt: ["$authorObj", 0] },
          },
        },
        { $group: { _id: "$slug", doc: { $first: "$$ROOT" } } },
        { $replaceRoot: { newRoot: "$doc" } },
        // Backward-compat: populate featuredImage media for old ObjectId-ref articles
        ...FEATURED_IMAGE_LOOKUP_STAGES,
        { $limit: limit },
        { $project: { categoryObj: 0, authorObj: 0 } },
      ])
      .toArray();
    if (!docs || docs.length === 0) {
      logger.error(
        { limit },
        "getFeaturedArticles: No featured articles found",
      );
      throw Object.assign(new Error("No featured articles found"), {
        status: 404,
      });
    }
  } catch (error) {
    logger.error(
      { limit, error },
      "getFeaturedArticles: Error fetching featured articles",
    );
    throw error;
  }

  return Promise.all(docs.map((doc) => mapDocToArticle(doc)));
}

export async function getAllArticles(
  db: Db,
  params: GetAllArticlesParams & { page?: number } = {},
): Promise<GetAllArticlesResult & { total?: number }> {
  const {
    limit = 10,
    page = 1,
    authorId,
    userId,
    categorySlug,
    status,
    featured,
    headline,
    search,
    cursor,
    format,
  } = params;
  const query: Document = { deletedAt: { $in: [null, ""] } };
  if (authorId) {
    query.authorId = ObjectId.isValid(authorId)
      ? { $in: [new ObjectId(authorId), authorId] }
      : authorId;
  }
  // Optional userId filter: when userId is provided, filter articles by author
  if (userId && ObjectId.isValid(userId)) {
    query.authorId = new ObjectId(userId);
  }
  if (status) query.status = status;
  if (featured) query.isFeatured = true;
  if (headline) query.isHeadline = true;
  if (format === "STANDARD" || format === "GALLERY") {
    query.format = format;
  }
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: "i" } },
      { excerpt: { $regex: search, $options: "i" } },
      { tags: { $in: [new RegExp(search, "i")] } },
    ];
  }
  if (cursor) {
    query.publishedAt = { $lt: new Date(cursor) };
  }

  // For total count (for page/limit pagination)
  const total = await db.collection("articles").countDocuments(query);

  const pipeline: Document[] = [
    { $match: query },
    { $sort: { publishedAt: -1, createdAt: -1 } },
  ];

  if (categorySlug) {
    pipeline.push(
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
      { $match: { "category.slug": categorySlug } },
    );
  } else {
    pipeline.push(
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
    );
  }

  // Populate author and featuredImage (media) for each article
  pipeline.push(
    {
      $lookup: {
        from: "users",
        localField: "authorId",
        foreignField: "_id",
        as: "authorObj",
      },
    },
    {
      $addFields: {
        author: { $arrayElemAt: ["$authorObj", 0] },
      },
    },
    // Backward-compat: populate featuredImage media for old ObjectId-ref articles
    ...FEATURED_IMAGE_LOOKUP_STAGES,
    { $project: { categoryObj: 0, authorObj: 0 } },
  );

  // Pagination: cursor-based or page/limit
  if (cursor) {
    pipeline.push({ $limit: limit });
  } else {
    pipeline.push({ $skip: (page - 1) * limit }, { $limit: limit });
  }

  let docs: Document[] = [];
  try {
    docs = await db.collection("articles").aggregate(pipeline).toArray();
    if (!docs || docs.length === 0) {
      // No articles found, return empty array
      return { articles: [], nextCursor: null, total };
    }
  } catch (error) {
    logger.error({ params, error }, "getAllArticles: Error fetching articles");
    throw error;
  }

  const articles: Article[] = await Promise.all(
    docs.map((doc) => mapDocToArticle(doc)),
  );
  const nextCursor = nextPublishedAtCursor(articles, limit);

  return { articles, nextCursor, total };
}
