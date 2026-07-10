import { Db, ObjectId } from "mongodb";
import { SectionArticleItem } from "@/types/articleSection";
import { ArticleListResponse } from "@/types/article";
import logger from "@/lib/logger";
import type { AuditLogActor, AuditLogEntityValue } from "@/types/auditLog";
import { AuditLogAction, AuditLogEntity } from "@/types/auditLog";
import { createAuditLog, requireAuditActor } from "@/services/auditLogService";
import {
  normalizeFeaturedImage,
  featuredImageLookupStages,
} from "./articleSectionUtils";

type SectionArticleType = "featured" | "editor choices" | "popular" | "headline";

const SECTION_TYPE_ENTITY: Record<SectionArticleType, AuditLogEntityValue> = {
  featured: AuditLogEntity.SECTION_FEATURED,
  "editor choices": AuditLogEntity.SECTION_EDITOR_CHOICES,
  popular: AuditLogEntity.SECTION_POPULAR,
  headline: AuditLogEntity.SECTION_HEADLINE,
};

const SECTION_TYPE_LABEL: Record<SectionArticleType, string> = {
  featured: "grid unggulan",
  "editor choices": "pilihan editor",
  popular: "artikel populer",
  headline: "headline",
};

/**
 * Payload untuk upsert section articles
 * Minimal structure: hanya article_id dan order
 */
export interface UpsertSectionPayload {
  articles: Array<{
    article_id: string;
  }>;
}

/**
 * Validasi input upsert section articles
 * - articles array tidak boleh kosong
 * - Setiap article_id harus valid ObjectId string
 * - Tidak boleh ada duplikat article_id
 * - Memeriksa limit maksimal jika diberikan
 */
function validateUpsertSectionInput(
  payload: UpsertSectionPayload,
  limit?: number,
): void {
  // Validate articles array exists dan tidak kosong
  if (!payload.articles || !Array.isArray(payload.articles)) {
    const err = new Error("articles harus berupa array");
    (err as any).status = 400;
    throw err;
  }

  if (payload.articles.length === 0) {
    const err = new Error("articles array tidak boleh kosong");
    (err as any).status = 400;
    throw err;
  }

  if (limit && payload.articles.length > limit) {
    const err = new Error(`Maksimal ${limit} artikel untuk section ini`);
    (err as any).status = 400;
    throw err;
  }

  // Validate setiap article_id
  const seenIds = new Set<string>();

  for (let i = 0; i < payload.articles.length; i++) {
    const article = payload.articles[i];

    // Check article_id exists
    if (!article.article_id) {
      const err = new Error(`articles[${i}].article_id is required`);
      (err as any).status = 400;
      throw err;
    }

    // Validate article_id adalah valid ObjectId string
    if (!ObjectId.isValid(article.article_id)) {
      const err = new Error(
        `articles[${i}].article_id "${article.article_id}" bukan valid ObjectId`,
      );
      (err as any).status = 400;
      throw err;
    }

    // Check untuk duplikat
    if (seenIds.has(article.article_id)) {
      const err = new Error(
        `articles[${i}].article_id "${article.article_id}" duplikat dalam array`,
      );
      (err as any).status = 400;
      throw err;
    }

    seenIds.add(article.article_id);
  }
}

/**
 * Fetch semua section articles dengan populated article data berdasarkan type
 * Menggunakan aggregation pipeline untuk efficient lookup
 * Sort by order untuk memastikan urutan yang benar
 */
export async function getSectionArticlesWithType(
  db: Db,
  type: "featured" | "editor choices" | "popular" | "headline",
): Promise<SectionArticleItem[]> {
  try {
    const collection = db.collection("section_articles");

    // Aggregation pipeline: lookup articles dan sort by order
    const pipeline = [
      // Filter berdasarkan type
      { $match: { type } },

      // Sort by order (ascending) untuk maintain urutan
      { $sort: { order: 1 } },

      // Lookup artikel details dari articles collection
      {
        $lookup: {
          from: "articles",
          localField: "article_id",
          foreignField: "_id",
          as: "articleArr",
        },
      },
      // Unwind agar 1:1 (jika tidak ketemu, tetap null)
      { $unwind: { path: "$articleArr", preserveNullAndEmptyArrays: true } },

      // Lookup category
      {
        $lookup: {
          from: "categories",
          localField: "articleArr.categoryId",
          foreignField: "_id",
          as: "categoryArr",
        },
      },
      {
        $addFields: {
          "articleArr.category": { $arrayElemAt: ["$categoryArr", 0] },
        },
      },

      // Lookup author
      {
        $lookup: {
          from: "users",
          localField: "articleArr.authorId",
          foreignField: "_id",
          as: "authorArr",
        },
      },
      {
        $addFields: {
          "articleArr.author": { $arrayElemAt: ["$authorArr", 0] },
        },
      },

      // Lookup editor
      {
        $lookup: {
          from: "users",
          localField: "articleArr.editorId",
          foreignField: "_id",
          as: "editorArr",
        },
      },
      {
        $addFields: {
          "articleArr.editor": { $arrayElemAt: ["$editorArr", 0] },
        },
      },

      // Populate featuredImage URL (backward-compat: old ObjectId ref, new embedded ArticleMedia)
      ...featuredImageLookupStages(),

      // Project untuk format response
      {
        $project: {
          _id: 1,
          article_id: 1,
          order: 1,
          type: 1,
          createdAt: 1,
          createdBy: 1,
          article: "$articleArr",
        },
      },
    ];

    const docs = await collection.aggregate(pipeline).toArray();

    // Helper: map full article to ArticleListResponse
    function mapToArticleListResponse(
      article: any,
    ): ArticleListResponse | undefined {
      if (!article || typeof article !== "object") return undefined;
      const mapUser = (u: any) => u ? {
        _id: u._id?.toString() ?? "",
        name: u.name ?? "",
        email: u.email ?? "",
        avatar: u.avatar,
        role: u.role ?? "SUBSCRIBER",
      } : undefined;

      return {
        _id: article._id?.toString(),
        title: article.title,
        slug: article.slug,
        publicPath: article.publicPath ?? null,
        urlFormat: (article.urlFormat === "structured" ? "structured" : "legacy") as import("@/types/article").ArticleUrlFormat,
        excerpt: article.excerpt,
        category: article.category,
        tags: Array.isArray(article.tags) ? article.tags : [],
        featuredImage: normalizeFeaturedImage(
          article.featuredImage,
          article.featuredImageMedia,
        ),
        author: mapUser(article.author) || { _id: "", name: "", email: "", role: "SUBSCRIBER" } as any,
        editor: mapUser(article.editor),
        status: article.status,
        isFeatured: article.isFeatured,
        isHeadline: article.isHeadline,
        isBreaking: article.isBreaking,
        viewCount: article.viewCount,
        publishedAt: article.publishedAt,
        updatedAt: article.updatedAt,
      };
    }

    // Map ke SectionArticleItem type, ensuring article is ArticleListResponse
    const result: SectionArticleItem[] = docs.map((doc) => {
      let articleObj = doc.article;
      if (Array.isArray(articleObj)) {
        articleObj = articleObj[0];
      }
      const mappedArticle = mapToArticleListResponse(articleObj);
      return {
        _id: doc._id.toString(),
        article_id: doc.article_id.toString(),
        order: doc.order,
        type: doc.type as "featured" | "editor choices" | "popular" | "headline",
        createdAt: doc.createdAt,
        createdBy: doc.createdBy.toString(),
        article: mappedArticle,
      };
    });

    logger.info(
      { type, count: result.length },
      "Section articles with details fetched successfully",
    );

    return result;
  } catch (error) {
    logger.error({ type, error }, "Error fetching section articles with details");
    throw error;
  }
}

/**
 * Upsert section articles: replace seluruh artikel untuk type tertentu dengan data baru
 * Menggunakan bulk operations untuk optimal performance:
 * 1. Delete semua dokumen lama dari section_articles collection yang memiliki type sama
 * 2. Insert dokumen baru dari payload dengan menyisipkan field type
 *
 * Field yang di-generate di server:
 * - _id: ObjectId baru
 * - order: dari index array (0, 1, 2, ...)
 * - createdAt: sekarang
 * - createdBy: userId dari session user
 * - type: dari parameter function
 */
export async function upsertSectionArticlesWithType(
  db: Db,
  payload: UpsertSectionPayload,
  actor: AuditLogActor,
  type: SectionArticleType,
  limit?: number,
): Promise<SectionArticleItem[]> {
  const auditActor = requireAuditActor(actor);
  const userId =
    typeof auditActor._id === "string"
      ? auditActor._id
      : auditActor._id.toString();

  try {
    // Validate input
    validateUpsertSectionInput(payload, limit);

    // Prepare documents untuk insert dengan order dari index
    const documentsToInsert = payload.articles.map((article, index) => ({
      _id: new ObjectId(),
      article_id: new ObjectId(article.article_id),
      order: index, // order sesuai urutan dalam array
      type,         // set tipe secara eksplisit
      createdAt: new Date(),
      createdBy: new ObjectId(userId),
    }));

    // Gunakan bulk operations untuk performance:
    // 1. Reset flag for articles in this section in articles collection
    // 2. Delete semua dokumen lama yang sesuai dengan type
    // 3. Insert dokumen baru
    // 4. Set flag untuk artikel baru di articles collection
    const collection = db.collection("section_articles");
    const articlesCollection = db.collection("articles");

    // Determine flag field based on type
    let flagField = "";
    if (type === "featured") flagField = "isFeatured";
    else if (type === "editor choices") flagField = "isEditorChoices";
    else if (type === "popular") flagField = "isPopular";
    else if (type === "headline") flagField = "isHeadline";

    // Reset flag for articles currently having this flag
    if (flagField) {
      await articlesCollection.updateMany(
        { [flagField]: true },
        { $set: { [flagField]: false } }
      );
    }

    // Perform bulk operation
    const previousCount = await collection.countDocuments({ type });
    await collection.deleteMany({ type });
    const insertResult = await collection.insertMany(documentsToInsert);

    // Set flag for new articles
    if (flagField && documentsToInsert.length > 0) {
      const newArticleIds = documentsToInsert.map((doc) => doc.article_id);
      await articlesCollection.updateMany(
        { _id: { $in: newArticleIds } },
        { $set: { [flagField]: true } }
      );
    }

    logger.info(
      {
        userId,
        type,
        insertedCount: insertResult.insertedCount,
        ids: insertResult.insertedIds,
      },
      "Section articles upserted successfully",
    );

    const entity = SECTION_TYPE_ENTITY[type];
    const sectionLabel = SECTION_TYPE_LABEL[type];
    const articleIds = payload.articles.map((article) => article.article_id);

    try {
      await createAuditLog(db, {
        actor: auditActor,
        action: AuditLogAction.UPDATE,
        entity,
        entityId: entity,
        details: `Mengganti ${sectionLabel}: ${payload.articles.length} artikel`,
        oldValue: { articleCount: previousCount },
        newValue: {
          articleCount: payload.articles.length,
          articleIds,
        },
        meta: {
          sectionType: type,
          articleCount: payload.articles.length,
        },
      });
    } catch (auditErr) {
      logger.error(
        { err: auditErr, type },
        "createAuditLog gagal setelah upsertSectionArticlesWithType",
      );
    }

    // Return yang sudah di-insert, dengan convert ke string untuk frontend
    const result: SectionArticleItem[] = documentsToInsert.map(
      (doc, index) => ({
        _id: doc._id.toString(),
        article_id: doc.article_id.toString(),
        order: doc.order,
        type: doc.type,
        createdAt: doc.createdAt,
        createdBy: doc.createdBy.toString(),
      }),
    );

    return result;
  } catch (error) {
    logger.error(
      {
        userId:
          typeof actor._id === "string" ? actor._id : actor._id.toString(),
        type,
        payload,
        error,
      },
      "Error upserting section articles",
    );
    throw error;
  }
}
