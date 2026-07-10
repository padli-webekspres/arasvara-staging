import { Db, ObjectId } from "mongodb";
import { SectionArticleItem } from "@/types/articleSection";
import { ArticleListResponse } from "@/types/article";
import logger from "@/lib/logger";
import type { AuditLogActor } from "@/types/auditLog";
import { AuditLogAction, AuditLogEntity } from "@/types/auditLog";
import { createAuditLog, requireAuditActor } from "@/services/auditLogService";
import {
  normalizeFeaturedImage,
  featuredImageLookupStages,
} from "./articleSectionUtils";

/**
 * Payload untuk upsert carousel section
 * Minimal structure: hanya article_id dan order
 */
export interface UpsertCarouselSectionPayload {
	articles: Array<{
		article_id: string;
	}>;
}

/**
 * Validasi input upsert carousel section
 * - articles array tidak boleh kosong
 * - Setiap article_id harus valid ObjectId string
 * - Tidak boleh ada duplikat article_id
 */
function validateUpsertCarouselSectionInput(
	payload: UpsertCarouselSectionPayload,
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
 * Fetch semua carousel section dengan populated article data
 * Menggunakan aggregation pipeline untuk efficient lookup
 * Sort by order untuk memastikan urutan yang benar
 */
export async function getCarouselSectionWithArticles(
	db: Db,
): Promise<SectionArticleItem[]> {
	try {
		const collection = db.collection("carousel_section");

		// Aggregation pipeline: lookup articles dan sort by order
		const pipeline = [
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

		// Map ke EditorChoice type, ensuring article is ArticleListResponse
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
				createdAt: doc.createdAt,
				createdBy: doc.createdBy.toString(),
				article: mappedArticle,
			};
		});

		logger.info(
			{ count: result.length },
			"Carousel section with articles fetched successfully",
		);

		return result;
	} catch (error) {
		logger.error({ error }, "Error fetching carousel section with articles");
		throw error;
	}
}

/**
 * Upsert carousel section: replace seluruh koleksi dengan data baru
 * Menggunakan bulk operations untuk optimal performance:
 * 1. Delete semua dokumen lama dari carousel_section collection
 * 2. Insert dokumen baru dari payload
 *
 * Field yang di-generate di server:
 * - _id: ObjectId baru
 * - order: dari index array (0, 1, 2, ...)
 * - createdAt: sekarang
 * - createdBy: userId dari session user
 */
export async function upsertCarouselSection(
	db: Db,
	payload: UpsertCarouselSectionPayload,
	actor: AuditLogActor,
): Promise<SectionArticleItem[]> {
	const auditActor = requireAuditActor(actor);
	try {
		logger.info(
			{ articleCount: payload.articles?.length },
			"upsertCarouselSection dimulai",
		);
		// Validate input
		validateUpsertCarouselSectionInput(payload);

		// Prepare documents untuk insert dengan order dari index
		const documentsToInsert = payload.articles.map((article, index) => ({
			_id: new ObjectId(),
			article_id: new ObjectId(article.article_id),
			order: index, // order sesuai urutan dalam array
			createdAt: new Date(),
			createdBy: new ObjectId(String(auditActor._id)),
		}));

		// Gunakan bulk operations untuk performance:
		// 1. Delete semua dokumen lama
		// 2. Insert dokumen baru
		// Ini lebih efisien daripada deleteMany lalu insertMany terpisah
		const collection = db.collection("carousel_section");

		const previousCount = await collection.countDocuments({});

		// Perform bulk operation
		await collection.deleteMany({});
		const insertResult = await collection.insertMany(documentsToInsert);

		const idPreview = payload.articles
			.slice(0, 8)
			.map((a) => a.article_id)
			.join(", ");
		const detailsTail =
			payload.articles.length > 8
				? ` (+${payload.articles.length - 8} lainnya)`
				: "";

		try {
			await createAuditLog(db, {
				actor: auditActor,
				action: AuditLogAction.UPDATE,
				entity: AuditLogEntity.CAROUSEL_SECTION,
				entityId: "carousel_section",
				details: `Mengganti carousel: ${insertResult.insertedCount} artikel [${idPreview}]${detailsTail}`,
				oldValue: { articleCount: previousCount },
				newValue: {
					articleCount: insertResult.insertedCount,
					previewArticleIds: payload.articles
						.slice(0, 12)
						.map((a) => a.article_id),
				},
				meta: { sectionType: "carousel" },
			});
		} catch (auditErr) {
			logger.error(
				{ err: auditErr },
				"createAuditLog gagal setelah upsertCarouselSection",
			);
		}

		logger.info(
			{
				actorId: String(auditActor._id),
				insertedCount: insertResult.insertedCount,
				ids: insertResult.insertedIds,
			},
			"Carousel section upserted successfully",
		);

		// Return yang sudah di-insert, dengan article_id dan createdBy di-convert ke string
		const result: SectionArticleItem[] = documentsToInsert.map(
			(doc, index) => ({
				_id: doc._id.toString(),
				article_id: doc.article_id.toString(),
				order: doc.order,
				createdAt: doc.createdAt,
				createdBy: doc.createdBy.toString(),
			}),
		);

		return result;
	} catch (error) {
		logger.error(
			{ actorId: String(actor._id), payload, error },
			"Error upserting carousel section",
		);
		throw error;
	}
}
