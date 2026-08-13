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
import {
  buildArticleCursorQuery,
  decodeArticleCursor,
  encodeArticleCursor,
} from "@/lib/article-pagination";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
  params: GetAllArticlesParams = {},
): Promise<GetAllArticlesResult> {
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
    excludeIds = [],
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
    const safeSearch = escapeRegExp(search.trim());
    query.$or = [
      { title: { $regex: safeSearch, $options: "i" } },
      { excerpt: { $regex: safeSearch, $options: "i" } },
      { tags: { $in: [new RegExp(safeSearch, "i")] } },
    ];
  }

  const validExcludedIds = excludeIds
    .filter((id) => ObjectId.isValid(id))
    .map((id) => new ObjectId(id));
  if (validExcludedIds.length > 0) {
    query._id = { $nin: validExcludedIds };
  }

  if (categorySlug) {
    const category = await db
      .collection("categories")
      .findOne({ slug: categorySlug }, { projection: { _id: 1 } });
    if (!category) {
      return {
        articles: [],
        nextCursor: null,
        hasMore: false,
        total: 0,
      };
    }
    query.categoryId = category._id;
  }

  // Total selalu berdasarkan filter utama, tidak berubah antar halaman cursor.
  const total = await db.collection("articles").countDocuments(query);

  const paginatedQuery: Document = cursor
    ? { $and: [query, buildArticleCursorQuery(decodeArticleCursor(cursor))] }
    : query;

  const pipeline: Document[] = [
    { $match: paginatedQuery },
    { $sort: { publishedAt: -1, _id: -1 } },
  ];

  if (!cursor && page > 1) {
    pipeline.push({ $skip: (page - 1) * limit });
  }

  // Ambil satu dokumen ekstra agar hasMore tidak perlu ditebak.
  pipeline.push(
    { $limit: limit + 1 },
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

  let docs: Document[] = [];
  try {
    docs = await db.collection("articles").aggregate(pipeline).toArray();
    if (!docs || docs.length === 0) {
      return { articles: [], nextCursor: null, hasMore: false, total };
    }
  } catch (error) {
    logger.error({ params, error }, "getAllArticles: Error fetching articles");
    throw error;
  }

  const hasMore = docs.length > limit;
  const pageDocs = hasMore ? docs.slice(0, limit) : docs;
  const articles: Article[] = await Promise.all(
    pageDocs.map((doc) => mapDocToArticle(doc)),
  );

  const lastDoc = pageDocs.at(-1);
  const nextCursor =
    hasMore &&
    lastDoc?._id instanceof ObjectId &&
    lastDoc.publishedAt instanceof Date
      ? encodeArticleCursor(lastDoc.publishedAt, lastDoc._id)
      : null;

  return {
    articles,
    nextCursor,
    hasMore: hasMore && nextCursor !== null,
    total,
  };
}
