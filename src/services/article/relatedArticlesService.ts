import { Db, ObjectId } from "mongodb";
import { ArticleListResponse, ArticleStatus } from "@/types/article";
import logger from "@/lib/logger";
import { SectionArticleItem } from "@/types/articleSection";
import {
  listingContextFromArticleDoc,
  revalidateArticlePage,
} from "@/lib/cache/revalidate-article-page";

/**
 * Payload untuk update related articles
 * Array dari RelatedArticle dengan order dan metadata
 */
export interface UpdateRelatedArticlesPayload {
  related: SectionArticleItem[];
}

/**
 * Validasi input update related articles
 * - related array harus ada (bisa kosong)
 * - Setiap item harus punya article_id
 * - article_id harus valid ObjectId string
 * - order harus valid number
 * - Tidak boleh ada duplikat article_id
 */
function validateUpdateRelatedArticlesInput(
  payload: UpdateRelatedArticlesPayload,
): void {
  // Validate related array exists
  if (!payload.related || !Array.isArray(payload.related)) {
    const err = new Error("related field harus berupa array");
    (err as any).status = 400;
    throw err;
  }

  // Validate setiap item dalam related array
  const seenIds = new Set<string>();

  for (let i = 0; i < payload.related.length; i++) {
    const related = payload.related[i];

    // Check article_id exists
    if (!related.article_id) {
      const err = new Error(`related[${i}].article_id is required`);
      (err as any).status = 400;
      throw err;
    }

    // Validate article_id adalah valid ObjectId string
    if (!ObjectId.isValid(String(related.article_id))) {
      const err = new Error(
        `related[${i}].article_id "${related.article_id}" bukan valid ObjectId`,
      );
      (err as any).status = 400;
      throw err;
    }

    // Check untuk duplikat
    const articleIdStr = String(related.article_id);
    if (seenIds.has(articleIdStr)) {
      const err = new Error(
        `related[${i}].article_id "${related.article_id}" duplikat dalam array`,
      );
      (err as any).status = 400;
      throw err;
    }
    seenIds.add(articleIdStr);

    // Validate order
    if (typeof related.order !== "number" || related.order < 0) {
      const err = new Error(
        `related[${i}].order harus berupa non-negative number`,
      );
      (err as any).status = 400;
      throw err;
    }
  }
}

/**
 * Helper: cari artikel berdasarkan id atau slug
 * Simpel iteration: coba by _id terlebih dahulu, kemudian by slug
 * Return ObjectId jika ditemukan, throw error jika tidak
 */
async function findArticleIdByIdOrSlug(
  db: Db,
  idOrSlug: string,
): Promise<ObjectId> {
  const articlesCollection = db.collection("articles");

  // Coba cari by _id terlebih dahulu
  if (ObjectId.isValid(idOrSlug)) {
    const byId = await articlesCollection.findOne(
      { _id: new ObjectId(idOrSlug) },
      { projection: { _id: 1 } },
    );
    if (byId) {
      return byId._id;
    }
  }

  // Coba cari by slug
  const bySlug = await articlesCollection.findOne(
    { slug: idOrSlug },
    { projection: { _id: 1 } },
  );
  if (bySlug) {
    return bySlug._id;
  }

  const err = new Error(
    `Artikel dengan id atau slug "${idOrSlug}" tidak ditemukan`,
  );
  (err as any).status = 404;
  throw err;
}

/**
 * Helper: map RelatedArticle object dengan konversi ObjectId ke string
 * Pastikan article_id dan createdBy dalam format string
 */
function mapRelatedArticle(doc: any): SectionArticleItem {
  return {
    _id: String(doc._id),
    article_id: String(doc.article_id),
    order: doc.order,
    createdAt: doc.createdAt,
    createdBy: String(doc.createdBy),
    article: doc.article,
  };
}

/**
 * Fetch related articles untuk artikel tertentu
 * Menggunakan aggregation pipeline untuk populate artikel details
 * Hasil di-sort by order untuk maintain urutan
 *
 * @param db Database instance
 * @param idOrSlug Article ID atau slug
 * @returns Array of RelatedArticle dengan populated article data
 */
export async function getRelatedArticles(
  db: Db,
  idOrSlug: string,
): Promise<SectionArticleItem[]> {
  try {
    // Cari artikel utama berdasarkan id atau slug
    const articleId = await findArticleIdByIdOrSlug(db, idOrSlug);

    const articlesCollection = db.collection("articles");

    // Aggregation pipeline untuk populate article details pada setiap relatedArticle
    const pipeline = [
      // Match artikel utama
      { $match: { _id: articleId } },

      // Unwind relatedArticles array (jika kosong, skip)
      {
        $unwind: {
          path: "$relatedArticles",
          preserveNullAndEmptyArrays: false,
        },
      },

      // Lookup artikel details dari articles collection
      {
        $lookup: {
          from: "articles",
          localField: "relatedArticles.article_id",
          foreignField: "_id",
          as: "articleDetails",
        },
      },
      // Unwind article details (if not found, tetap null)
      {
        $unwind: {
          path: "$articleDetails",
          preserveNullAndEmptyArrays: true,
        },
      },

      // Lookup category
      {
        $lookup: {
          from: "categories",
          localField: "articleDetails.categoryId",
          foreignField: "_id",
          as: "categoryDetails",
        },
      },

      // Lookup author
      {
        $lookup: {
          from: "users",
          localField: "articleDetails.authorId",
          foreignField: "_id",
          as: "authorDetails",
        },
      },

      // Lookup editor
      {
        $lookup: {
          from: "users",
          localField: "articleDetails.editorId",
          foreignField: "_id",
          as: "editorDetails",
        },
      },

      // Project untuk format response: RelatedArticle dengan populated article
      {
        $project: {
          article_id: "$relatedArticles.article_id",
          order: "$relatedArticles.order",
          createdAt: "$relatedArticles.createdAt",
          createdBy: "$relatedArticles.createdBy",
          article: {
            _id: "$articleDetails._id",
            title: "$articleDetails.title",
            slug: "$articleDetails.slug",
            excerpt: "$articleDetails.excerpt",
            category: { $arrayElemAt: ["$categoryDetails", 0] },
            tags: "$articleDetails.tags",
            featuredImage: "$articleDetails.featuredImage",
            author: { $arrayElemAt: ["$authorDetails", 0] },
            editor: { $arrayElemAt: ["$editorDetails", 0] },
            status: "$articleDetails.status",
            isFeatured: "$articleDetails.isFeatured",
            isHeadline: "$articleDetails.isHeadline",
            isBreaking: "$articleDetails.isBreaking",
            viewCount: "$articleDetails.viewCount",
            publishedAt: "$articleDetails.publishedAt",
            updatedAt: "$articleDetails.updatedAt",
          },
        },
      },

      // Sort by order untuk maintain urutan
      { $sort: { order: 1 } },
    ];

    const results = await articlesCollection.aggregate(pipeline).toArray();

    // Map hasil ke SectionArticleItem array
    const relatedArticles: SectionArticleItem[] = results.map((doc) =>
      mapRelatedArticle(doc),
    );

    return relatedArticles;
  } catch (error) {
    logger.error({ idOrSlug, error }, "Error fetching related articles");
    throw error;
  }
}

/**
 * Update related articles untuk artikel tertentu
 * Replace seluruh array relatedArticles dengan data baru dari payload
 *
 * @param db Database instance
 * @param idOrSlug Article ID atau slug
 * @param payload Update payload dengan related array
 * @param userId User ID yang melakukan update (untuk createdBy)
 * @returns Object dengan articleId dan array relatedArticles yang sudah di-populate
 */
export async function updateRelatedArticles(
  db: Db,
  idOrSlug: string,
  payload: UpdateRelatedArticlesPayload,
  userId: string,
): Promise<{ articleId: string; relatedArticles: SectionArticleItem[] }> {
  try {
    // Validate input
    validateUpdateRelatedArticlesInput(payload);

    // Cari artikel utama
    const articleId = await findArticleIdByIdOrSlug(db, idOrSlug);

    // Prepare relatedArticles array dengan konversi ObjectId dan metadata
    const relatedArticlesForUpdate = payload.related.map((related) => ({
      _id: new ObjectId(), // Generate new ObjectId untuk setiap related article
      article_id: new ObjectId(String(related.article_id)),
      order: related.order,
      createdAt: new Date(),
      createdBy: new ObjectId(userId),
    }));

    const articlesCollection = db.collection("articles");

    // Update artikel dengan relatedArticles array baru

    // Gunakan returnDocument: "after" (driver baru) dan returnOriginal: false (driver lama)
    const updateResult = await articlesCollection.findOneAndUpdate(
      { _id: articleId },
      {
        $set: {
          relatedArticles: relatedArticlesForUpdate,
          updatedAt: new Date(),
        },
      },
      { returnDocument: "after" },
    );

    // Fallback: jika updateResult.value tidak ada, cek manual ke DB (update tetap dianggap sukses)
    let updatedDoc = updateResult?.value;
    if (!updatedDoc) {
      updatedDoc = await articlesCollection.findOne({ _id: articleId });
    }

    logger.info(
      {
        articleId: articleId.toString(),
        userId,
        count: relatedArticlesForUpdate.length,
      },
      "Related articles updated successfully",
    );

    // Fetch dan return dengan populated data
    const updatedArticles = await getRelatedArticles(db, articleId.toString());

    const publicPath =
      updatedDoc?.publicPath != null ? String(updatedDoc.publicPath).trim() : "";
    const status = updatedDoc?.status != null ? String(updatedDoc.status) : "";
    if (
      publicPath &&
      (status === ArticleStatus.PUBLISHED || status === ArticleStatus.SCHEDULED)
    ) {
      try {
        revalidateArticlePage(
          publicPath,
          undefined,
          listingContextFromArticleDoc(updatedDoc),
        );
      } catch (revalidateErr) {
        logger.warn(
          { err: revalidateErr, articleId: articleId.toString() },
          "revalidateArticlePage gagal setelah update related articles",
        );
      }
    }

    return {
      articleId: articleId.toString(),
      relatedArticles: updatedArticles,
    };
  } catch (error: any) {
    logger.error(
      {
        idOrSlug,
        userId,
        relatedCount: payload.related?.length,
        articleIds: payload.related?.map((r) => r.article_id),
        error: {
          message: error?.message,
          stack: error?.stack,
        },
      },
      "Error updating related articles",
    );
    throw error;
  }
}
