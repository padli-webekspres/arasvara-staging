/**
 * AdsSingleArticleService
 * Mengelola siklus hidup iklan artikel: presign → upload client → finalize (Sharp WebP)
 * → simpan ke MongoDB koleksi `ads_article` → baca.
 *
 * Logika S3 dan utility ada di adsSharedHelpers.ts (DRY bersama homepage).
 */

import {
	ObjectId,
	type Db,
	type Filter,
	type WithId,
	type Document,
} from "mongodb";
import { connectToDatabase } from "@/lib/db/db";
import logger from "@/lib/logger";
import { createAuditLog, requireAuditActor } from "@/services/auditLogService";
import { AuditLogAction } from "@/types/auditLog";
import {
	withStatus,
	deleteS3BannerSafe,
	generatePresignedUrl,
	finalizeMedia,
} from "@/services/ads/adsSharedHelpers";
import type { AuditLogActor } from "@/types/auditLog";
import type {
	AdsHomepageFinalizeResponse,
	AdsHomepagePresignResponse,
	AdsSingleArticlePlacement,
	AdsVariant,
	BulkUpsertAdsArticleItem,
	BulkUpsertAdsArticlePayload,
	CreateAdsArticlePayload,
	GetArticleAdsOptions,
	SingleArticleAdItem,
	AdsBannerFileFields,
	AdsArticleCategory,
} from "@/types/ads";

// ─── Konstanta ────────────────────────────────────────────────────────────────

export const ADS_ARTICLE_COLLECTION = "ads_article";

const S3_PREFIX_FINAL = "ads/article";
const S3_PREFIX_INCOMING = "ads/article/incoming";

/** Escape untuk pola `$regex` aman dari slug kategori. */
function escapeRegex(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Gabungkan `categorySlug` + `categorySlugs`, dedupe + trim. */
function mergeCategorySlugInputs(options: GetArticleAdsOptions): string[] {
	const set = new Set<string>();
	const push = (v?: string) => {
		const t = v?.trim();
		if (t) set.add(t);
	};
	push(options.categorySlug);
	for (const s of options.categorySlugs ?? []) push(s);
	return [...set];
}

/**
 * Tambahkan filter kategori ke filter MongoDB:
 * - slug: cocok case-insensitive pada elemen `categories`
 * - categoryId: cocok `_id` ObjectId atau string pada elemen `categories`
 * - beberapa slug: OR (salah satu cocok)
 */
function applyArticleCategoryFilter(
	filter: Filter<Document>,
	options: Pick<
		GetArticleAdsOptions,
		"categorySlug" | "categorySlugs" | "categoryId"
	>,
): void {
	const slugs = mergeCategorySlugInputs(options as GetArticleAdsOptions);
	const idTrimmed = options.categoryId?.trim();

	const branches: Filter<Document>[] = [];

	for (const slug of slugs) {
		branches.push({
			categories: {
				$elemMatch: {
					slug: new RegExp(`^${escapeRegex(slug)}$`, "i"),
				},
			},
		});
	}

	if (idTrimmed) {
		if (ObjectId.isValid(idTrimmed)) {
			const oid = new ObjectId(idTrimmed);
			branches.push({
				categories: {
					$elemMatch: {
						$or: [{ _id: oid }, { _id: idTrimmed }],
					},
				},
			});
		} else {
			branches.push({
				categories: {
					$elemMatch: { _id: idTrimmed },
				},
			});
		}
	}

	if (branches.length === 0) return;

	if (branches.length === 1) {
		Object.assign(filter, branches[0]);
		return;
	}

	filter.$or = branches;
}

// ─── Doc mapper ───────────────────────────────────────────────────────────────

function docToArticleAdItem(raw: WithId<Document>): SingleArticleAdItem {
	return {
		_id: raw._id.toString(),
		categories: (raw.categories as AdsArticleCategory[]) ?? [],
		placement: raw.placement as AdsSingleArticlePlacement,
		variant: raw.variant as AdsVariant | string | undefined,
		span: raw.span as 1 | 2 | undefined,
		name: typeof raw.name === "string" && raw.name.trim() ? raw.name : "",
		banner: raw.banner as AdsBannerFileFields,
		linkUrl: raw.linkUrl as string,
		order: (raw.order as number) ?? 0,
		isActive: (raw.isActive as boolean) ?? true,
		startedAt:
			raw.startedAt instanceof Date
				? raw.startedAt.toISOString()
				: String(raw.startedAt),
		endedAt:
			raw.endedAt instanceof Date
				? raw.endedAt.toISOString()
				: String(raw.endedAt),
		clicks: (raw.clicks as number) ?? 0,
	};
}

// ─── Service class ────────────────────────────────────────────────────────────

export class AdsSingleArticleService {
	// ──────────────────────────────────────────────────────────────────────────
	// Tahap 1 — Presign
	// ──────────────────────────────────────────────────────────────────────────

	static async generatePresignedUrl(
		filename: string,
		contentType: string,
	): Promise<AdsHomepagePresignResponse> {
		return generatePresignedUrl(filename, contentType, S3_PREFIX_INCOMING);
	}

	// ──────────────────────────────────────────────────────────────────────────
	// Tahap 2 — Finalize
	// ──────────────────────────────────────────────────────────────────────────

	static async finalizeMedia(
		fileKey: string,
	): Promise<AdsHomepageFinalizeResponse> {
		return finalizeMedia(fileKey, S3_PREFIX_INCOMING, S3_PREFIX_FINAL);
	}

	// ──────────────────────────────────────────────────────────────────────────
	// MongoDB — Read
	// ──────────────────────────────────────────────────────────────────────────

	/**
	 * Ambil daftar iklan artikel, diurutkan `order ASC`.
	 * - `categorySlug` / `categorySlugs` / `categoryId` → filter pada array `categories`
	 *   (slug case-insensitive; beberapa slug = OR).
	 * - `filterByDate` → hanya mengembalikan iklan yang berlaku hari ini.
	 */
	static async getArticleAds(
		options: GetArticleAdsOptions = {},
		db?: Db,
	): Promise<{ ads: SingleArticleAdItem[]; total: number }> {
		const {
			placement,
			isActive,
			includeDeleted = false,
			filterByDate = false,
			page = 1,
			limit = 50,
		} = options;

		const safeLimit = Math.min(Math.max(1, limit), 200);
		const safePage = Math.max(1, page);
		const skip = (safePage - 1) * safeLimit;

		const database = db ?? (await connectToDatabase());
		const col = database.collection(ADS_ARTICLE_COLLECTION);

		const filter: Filter<Document> = {};

		if (!includeDeleted) filter.deletedAt = null;
		if (typeof isActive === "boolean") filter.isActive = isActive;
		if (placement) filter.placement = placement;

		applyArticleCategoryFilter(filter, options);

		if (filterByDate) {
			const now = new Date();
			filter.startedAt = { $lte: now };
			filter.endedAt = { $gte: now };
		}

		const [docs, total] = await Promise.all([
			col
				.find(filter)
				.sort({ order: 1, createdAt: -1 })
				.skip(skip)
				.limit(safeLimit)
				.toArray(),
			col.countDocuments(filter),
		]);

		return { ads: docs.map(docToArticleAdItem), total };
	}

	// ──────────────────────────────────────────────────────────────────────────
	// MongoDB — Write (single)
	// ──────────────────────────────────────────────────────────────────────────

	/**
	 * Sisipkan satu dokumen iklan ke koleksi `ads_article`.
	 */
	static async createArticleAd(
		payload: CreateAdsArticlePayload,
		actor: AuditLogActor,
		db?: Db,
	): Promise<SingleArticleAdItem> {
		logger.info(
			{
				placement: payload.placement?.trim(),
				name: payload.name?.trim(),
				categoryCount: payload.categories?.length,
			},
			"AdsSingleArticleService.createArticleAd dimulai",
		);

		try {
			const auditActor = requireAuditActor(actor);
			AdsSingleArticleService.validateArticlePayload(payload);

			const database = db ?? (await connectToDatabase());
			const col = database.collection(ADS_ARTICLE_COLLECTION);

			const now = new Date();

			const doc = {
				name: payload.name.trim(),
				categories: payload.categories.map((c) => ({
					_id: typeof c._id === "string" ? new ObjectId(c._id) : c._id,
					slug: c.slug.trim(),
				})),
				placement: payload.placement,
				banner: {
					url: payload.banner.url.trim(),
					filename: payload.banner.filename.trim(),
					mimetype: payload.banner.mimetype.trim(),
					size: payload.banner.size,
				},
				linkUrl: payload.linkUrl.trim(),
				order: payload.order ?? 0,
				variant: payload.variant ?? null,
				span: payload.span ?? 1,
				isActive: payload.isActive ?? true,
				startedAt: new Date(payload.startedAt),
				endedAt: new Date(payload.endedAt),
				clicks: 0,
				createdAt: now,
				updatedAt: now,
				deletedAt: null,
			};

			const result = await col.insertOne(doc);
			const entityId = result.insertedId.toString();

			try {
				await createAuditLog(database, {
					actor: auditActor,
					action: AuditLogAction.CREATE,
					entity: "ADS_ARTICLE",
					entityId,
					details: `Membuat iklan artikel "${doc.name}" (${doc.placement})`,
					newValue: {
						placement: doc.placement,
						name: doc.name,
						categorySlugs: doc.categories.map((c) => c.slug),
						order: doc.order,
						isActive: doc.isActive,
					},
				});
			} catch (auditErr) {
				logger.error(
					{ err: auditErr, entityId, placement: doc.placement },
					"AdsSingleArticleService: gagal menulis audit log (createArticleAd)",
				);
			}

			logger.info(
				{ adId: entityId, placement: doc.placement },
				"AdsSingleArticleService: article ad created",
			);

			return docToArticleAdItem({
				_id: result.insertedId,
				...doc,
			} as WithId<Document>);
		} catch (err) {
			logger.error(
				{ err, placement: payload.placement },
				"AdsSingleArticleService.createArticleAd gagal",
			);
			throw err;
		}
	}

	// ──────────────────────────────────────────────────────────────────────────
	// MongoDB — Bulk upsert
	// ──────────────────────────────────────────────────────────────────────────

	/**
	 * Upsert seluruh slot iklan untuk scope (`categories` ANY slug + `placement`)
	 * dengan application-level rollback (kompatibel tanpa replica set).
	 *
	 * - `serverId` valid ObjectId → update dokumen yang sudah ada.
	 * - Tanpa `serverId` → insert dokumen baru.
	 * - Dokumen dalam scope yang tidak ada di `items` → soft-delete (banner S3 tetap).
	 * - File S3 lama hanya dihapus saat banner diganti (bukan saat soft-delete).
	 *
	 * "Scope" didefinisikan sebagai:
	 *   `categories.slug` matches ANY slug dari payload + `placement` sama.
	 */
	static async bulkUpsertArticleAds(
		payload: BulkUpsertAdsArticlePayload,
		actor: AuditLogActor,
		db?: Db,
	): Promise<SingleArticleAdItem[]> {
		const { categories, placement, items } = payload;

		if (!categories?.length) {
			throw withStatus(new Error("categories wajib minimal 1 item"), 400);
		}
		if (!placement?.trim()) {
			throw withStatus(new Error("placement wajib diisi"), 400);
		}
		for (const item of items) {
			if (!item.name?.trim()) {
				throw withStatus(new Error("Setiap item wajib memiliki name"), 400);
			}
		}

		const auditActor = requireAuditActor(actor);
		logger.info(
			{
				placement: placement.trim(),
				categorySlugs: categories.map((c) => c.slug),
				itemCount: items.length,
			},
			"AdsSingleArticleService.bulkUpsertArticleAds dimulai",
		);

		const database = db ?? (await connectToDatabase());
		const col = database.collection(ADS_ARTICLE_COLLECTION);
		const now = new Date();

		const categorySlugs = categories.map((c) => c.slug);

		// 1. Snapshot state saat ini (untuk rollback)
		//    Scope: dokumen yang categories-nya memiliki salah satu slug dari payload
		const snapshotDocs = await col
			.find({
				placement,
				deletedAt: null,
				categories: { $elemMatch: { slug: { $in: categorySlugs } } },
			})
			.toArray();

		const snapshotMap = new Map(snapshotDocs.map((d) => [d._id.toString(), d]));

		const incomingServerIds = new Set(
			items
				.filter((it) => it.serverId && ObjectId.isValid(it.serverId))
				.map((it) => it.serverId as string),
		);

		const toSoftDeleteIds = [...snapshotMap.keys()].filter(
			(id) => !incomingServerIds.has(id),
		);

		const softDeletedIds: string[] = [];
		const updatedItems: Array<{ id: string; original: Document }> = [];
		const insertedIds: string[] = [];
		const s3KeysToDelete: string[] = [];

		try {
			// 2. Soft-delete item yang dihapus dari frontend
			for (const id of toSoftDeleteIds) {
				await col.updateOne(
					{ _id: new ObjectId(id) },
					{ $set: { deletedAt: now, updatedAt: now } },
				);
				softDeletedIds.push(id);
			}

			// 3. Update atau insert setiap item
			for (const item of items) {
				if (item.serverId && ObjectId.isValid(item.serverId)) {
					const original = snapshotMap.get(item.serverId);

					await col.updateOne(
						{ _id: new ObjectId(item.serverId), deletedAt: null },
						{
							$set: {
								banner: item.banner,
								name: item.name.trim(),
								linkUrl: item.linkUrl.trim(),
								order: item.order,
								startedAt: new Date(item.startedAt),
								endedAt: new Date(item.endedAt),
								...(item.variant !== undefined && { variant: item.variant }),
								...(item.span !== undefined && { span: item.span }),
								...(item.isActive !== undefined && { isActive: item.isActive }),
								updatedAt: now,
							},
						},
					);

					if (original) {
						updatedItems.push({ id: item.serverId, original });

						const oldFileKey = (original.banner as AdsBannerFileFields)
							?.filename;
						const newFileKey = item.banner.filename;
						if (oldFileKey && newFileKey && oldFileKey !== newFileKey) {
							s3KeysToDelete.push(oldFileKey);
						}
					}
				} else {
					const result = await col.insertOne({
						name: item.name.trim(),
						categories: categories.map((c) => ({
							_id: typeof c._id === "string" ? new ObjectId(c._id) : c._id,
							slug: c.slug.trim(),
						})),
						placement,
						banner: item.banner,
						linkUrl: item.linkUrl.trim(),
						order: item.order,
						variant: item.variant ?? null,
						span: item.span ?? 1,
						isActive: item.isActive ?? true,
						startedAt: new Date(item.startedAt),
						endedAt: new Date(item.endedAt),
						clicks: 0,
						createdAt: now,
						updatedAt: now,
						deletedAt: null,
					});
					insertedIds.push(result.insertedId.toString());
				}
			}

			// 4. Kembalikan state terbaru dalam scope ini
			const updatedDocs = await col
				.find({
					placement,
					deletedAt: null,
					categories: { $elemMatch: { slug: { $in: categorySlugs } } },
				})
				.sort({ order: 1, createdAt: -1 })
				.toArray();

			logger.info(
				{ placement, categorySlugs, count: updatedDocs.length },
				"AdsSingleArticleService: bulk upsert berhasil",
			);

			const slugKey = [...categorySlugs]
				.map((s) => String(s).trim())
				.sort()
				.join("|");
			const stableEntityId = `article:${placement.trim()}:${slugKey}`;
			try {
				await createAuditLog(database, {
					actor: auditActor,
					action: AuditLogAction.UPDATE,
					entity: "ADS_ARTICLE",
					entityId: stableEntityId,
					details: `Bulk upsert iklan artikel placement "${placement}" (${updatedDocs.length} slot aktif; kategori: ${slugKey})`,
					newValue: {
						placement: placement.trim(),
						categorySlugs,
						activeSlotCount: updatedDocs.length,
						insertedCount: insertedIds.length,
						updatedCount: updatedItems.length,
						softDeletedCount: softDeletedIds.length,
						adIds: updatedDocs.map((d) => d._id.toString()),
					},
				});
			} catch (auditErr) {
				logger.error(
					{ err: auditErr, placement, categorySlugs },
					"AdsSingleArticleService: gagal menulis audit log (bulkUpsertArticleAds)",
				);
			}

			// 5. Hapus file lama dari S3 setelah semua DB ops sukses
			await Promise.all(s3KeysToDelete.map(deleteS3BannerSafe));

			return updatedDocs.map(docToArticleAdItem);
		} catch (error) {
			logger.error(
				{ err: error, placement, categorySlugs },
				"AdsSingleArticleService: bulk upsert gagal — memulai rollback manual",
			);

			try {
				for (const id of insertedIds) {
					await col.deleteOne({ _id: new ObjectId(id) });
				}
				for (const { id, original } of updatedItems) {
					await col.replaceOne({ _id: new ObjectId(id) }, original);
				}
				for (const id of softDeletedIds) {
					await col.updateOne(
						{ _id: new ObjectId(id) },
						{
							$set: {
								deletedAt: null,
								updatedAt: snapshotMap.get(id)?.updatedAt ?? now,
							},
						},
					);
				}

				logger.info(
					{ placement, categorySlugs },
					"AdsSingleArticleService: rollback manual berhasil",
				);
			} catch (rollbackErr) {
				logger.error(
					{ err: rollbackErr, placement, categorySlugs },
					"AdsSingleArticleService: rollback manual GAGAL — data mungkin tidak konsisten",
				);
			}

			throw error;
		}
	}

	// ──────────────────────────────────────────────────────────────────────────
	// Validation
	// ──────────────────────────────────────────────────────────────────────────

	static validateArticlePayload(
		p: CreateAdsArticlePayload | BulkUpsertAdsArticleItem,
	): void {
		const errors: string[] = [];

		if (!p.name?.trim()) errors.push("name wajib diisi");
		if (!p.linkUrl?.trim()) errors.push("linkUrl wajib diisi");

		if (!p.banner) {
			errors.push("banner wajib diisi");
		} else {
			if (!p.banner.url?.trim()) errors.push("banner.url wajib diisi");
			if (!p.banner.filename?.trim())
				errors.push("banner.filename wajib diisi");
			if (!p.banner.mimetype?.trim())
				errors.push("banner.mimetype wajib diisi");
			if (typeof p.banner.size !== "number" || p.banner.size <= 0) {
				errors.push("banner.size harus angka positif");
			}
		}

		if (!p.startedAt) {
			errors.push("startedAt wajib diisi");
		} else if (isNaN(new Date(p.startedAt).getTime())) {
			errors.push("startedAt bukan tanggal valid");
		}

		if (!p.endedAt) {
			errors.push("endedAt wajib diisi");
		} else if (isNaN(new Date(p.endedAt).getTime())) {
			errors.push("endedAt bukan tanggal valid");
		}

		if (
			p.startedAt &&
			p.endedAt &&
			!isNaN(new Date(p.startedAt).getTime()) &&
			!isNaN(new Date(p.endedAt).getTime()) &&
			new Date(p.endedAt) <= new Date(p.startedAt)
		) {
			errors.push("endedAt harus setelah startedAt");
		}

		// Validasi categories hanya untuk CreateAdsArticlePayload
		if ("categories" in p) {
			if (!p.categories?.length) {
				errors.push("categories wajib minimal 1 item");
			}
			if (!p.placement) {
				errors.push("placement wajib diisi");
			}
		}

		if (errors.length > 0) {
			throw withStatus(new Error(`Validasi gagal: ${errors.join("; ")}`), 400);
		}
	}
}
