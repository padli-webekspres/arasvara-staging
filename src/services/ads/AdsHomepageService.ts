/**
 * AdsHomepageService
 * Mengelola siklus hidup iklan homepage: presign → upload client → finalize (Sharp WebP)
 * → simpan ke MongoDB → baca.
 *
 * S3 dan utility functions ada di adsSharedHelpers.ts agar bisa dipakai bersama
 * dengan AdsSingleArticleService tanpa duplikasi kode.
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
	Ads as AdsType,
	AdsBanner,
	AdsHomepageFinalizeResponse,
	AdsHomepagePresignResponse,
	AdsPosition,
	AdsVariant,
	BulkUpsertAdsItem,
	BulkUpsertAdsPayload,
	CreateAdsHomepagePayload,
} from "@/types/ads";

// ─── Konstanta ────────────────────────────────────────────────────────────────

export const ADS_HOMEPAGE_COLLECTION = "ads_homepage";

const S3_PREFIX_FINAL = "ads/homepage";
const S3_PREFIX_INCOMING = "ads/homepage/incoming";

// ─── Query options ────────────────────────────────────────────────────────────

export interface GetHomepageAdsOptions {
	/** Filter posisi iklan, mis. "headline". */
	position?: string;
	/** Hanya iklan aktif (default: hanya aktif). */
	isActive?: boolean;
	/** Sertakan dokumen yang sudah soft-deleted (default: false). */
	includeDeleted?: boolean;
	/** Nomor halaman (1-based, default: 1). */
	page?: number;
	/** Jumlah per halaman (default: 50, maks: 200). */
	limit?: number;
	/**
	 * Saat `true`, hanya mengembalikan iklan yang aktif pada saat ini:
	 * `startedAt ≤ now ≤ endedAt`.
	 */
	filterByDate?: boolean;
}

// ─── Doc mapper ───────────────────────────────────────────────────────────────

function docToAdsType(raw: WithId<Document>): AdsType {
	return {
		_id: raw._id.toString(),
		name: typeof raw.name === "string" && raw.name.trim() ? raw.name : "",
		variant: raw.variant as AdsVariant | undefined,
		span: raw.span as number | undefined,
		banner: raw.banner as AdsBanner[],
		linkUrl: raw.linkUrl as string,
		position: raw.position as AdsPosition,
		order: (raw.order as number) ?? 0,
		isActive: (raw.isActive as boolean) ?? true,
		startedAt: raw.startedAt as Date,
		endedAt: raw.endedAt as Date,
		clicks: (raw.clicks as number) ?? 0,
		createdAt: raw.createdAt as Date,
		updatedAt: raw.updatedAt as Date,
		deletedAt: (raw.deletedAt as Date | null) ?? null,
	};
}

// ─── Service class ────────────────────────────────────────────────────────────

export class AdsManagementService {
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
	// MongoDB — Write
	// ──────────────────────────────────────────────────────────────────────────

	static async createHomepageAds(
		payload: CreateAdsHomepagePayload,
		actor: AuditLogActor,
		db?: Db,
	): Promise<AdsType> {
		logger.info(
			{ position: payload.position?.trim(), name: payload.name?.trim() },
			"AdsManagementService.createHomepageAds dimulai",
		);

		try {
			const auditActor = requireAuditActor(actor);
			AdsManagementService.validateCreatePayload(payload);

			const database = db ?? (await connectToDatabase());
			const col = database.collection(ADS_HOMEPAGE_COLLECTION);

			const now = new Date();

			const doc = {
				variant: payload.variant ?? null,
				span: payload.span ?? 1,
				name: payload.name.trim(),
				banner: {
					url: payload.banner.url.trim(),
					filename: payload.banner.filename.trim(),
					mimetype: payload.banner.mimetype.trim(),
					size: payload.banner.size,
				},
				linkUrl: payload.linkUrl.trim(),
				position: payload.position.trim(),
				order: payload.order ?? 0,
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
					entity: "ADS_HOMEPAGE",
					entityId,
					details: `Membuat iklan homepage "${doc.name}" (${doc.position})`,
					newValue: {
						position: doc.position,
						name: doc.name,
						order: doc.order,
						isActive: doc.isActive,
					},
				});
			} catch (auditErr) {
				logger.error(
					{ err: auditErr, entityId, position: doc.position },
					"AdsManagementService: gagal menulis audit log (createHomepageAds)",
				);
			}

			logger.info(
				{ adId: entityId, position: doc.position },
				"AdsManagementService: homepage ad created",
			);

			return docToAdsType({
				_id: result.insertedId,
				...doc,
			} as WithId<Document>);
		} catch (err) {
			logger.error(
				{ err, position: payload.position },
				"AdsManagementService.createHomepageAds gagal",
			);
			throw err;
		}
	}

	// ──────────────────────────────────────────────────────────────────────────
	// MongoDB — Read
	// ──────────────────────────────────────────────────────────────────────────

	static async getHomepageAds(
		options: GetHomepageAdsOptions = {},
		db?: Db,
	): Promise<{ ads: AdsType[]; total: number }> {
		const {
			position,
			isActive = true,
			includeDeleted = false,
			filterByDate = false,
			page = 1,
			limit = 50,
		} = options;

		const safeLimit = Math.min(Math.max(1, limit), 200);
		const safePage = Math.max(1, page);
		const skip = (safePage - 1) * safeLimit;

		const database = db ?? (await connectToDatabase());
		const col = database.collection(ADS_HOMEPAGE_COLLECTION);

		const filter: Filter<Document> = {};

		if (!includeDeleted) filter.deletedAt = null;
		if (typeof isActive === "boolean") filter.isActive = isActive;
		if (position) filter.position = position;
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

		return { ads: docs.map(docToAdsType), total };
	}

	// ──────────────────────────────────────────────────────────────────────────
	// MongoDB — Delete (soft delete)
	// ──────────────────────────────────────────────────────────────────────────

	static async deleteHomepageAd(
		id: string,
		actor: AuditLogActor,
		db?: Db,
	): Promise<void> {
		logger.info({ adId: id }, "AdsManagementService.deleteHomepageAd dimulai");

		try {
			const auditActor = requireAuditActor(actor);

			if (!ObjectId.isValid(id)) {
				throw withStatus(new Error("ID iklan tidak valid"), 400);
			}

			const database = db ?? (await connectToDatabase());
			const col = database.collection(ADS_HOMEPAGE_COLLECTION);

			const doc = await col.findOne(
				{ _id: new ObjectId(id), deletedAt: null },
				{ projection: { name: 1, position: 1 } },
			);

			if (!doc) {
				throw withStatus(new Error("Iklan tidak ditemukan"), 404);
			}

			await col.updateOne(
				{ _id: new ObjectId(id) },
				{ $set: { deletedAt: new Date(), updatedAt: new Date() } },
			);

			try {
				await createAuditLog(database, {
					actor: auditActor,
					action: AuditLogAction.DELETE,
					entity: "ADS_HOMEPAGE",
					entityId: id,
					details: `Soft delete iklan homepage "${String(doc.name ?? "")}"`,
					oldValue: {
						name: doc.name,
						position: doc.position,
					},
				});
			} catch (auditErr) {
				logger.error(
					{ err: auditErr, adId: id },
					"AdsManagementService: gagal menulis audit log (deleteHomepageAd)",
				);
			}

			logger.info(
				{ adId: id },
				"AdsManagementService: homepage ad soft-deleted (banner S3 dipertahankan)",
			);
		} catch (err) {
			logger.error(
				{ err, adId: id },
				"AdsManagementService.deleteHomepageAd gagal",
			);
			throw err;
		}
	}

	// ──────────────────────────────────────────────────────────────────────────
	// MongoDB — Bulk upsert
	// ──────────────────────────────────────────────────────────────────────────

	/**
	 * Upsert seluruh slot iklan untuk satu `position` dengan application-level
	 * rollback (kompatibel dengan standalone MongoDB, tanpa replica set).
	 *
	 * - `serverId` valid ObjectId → update dokumen yang sudah ada.
	 * - Tanpa `serverId` → insert dokumen baru.
	 * - Dokumen untuk `position` yang tidak ada dalam `items` → soft-delete (banner S3 tetap).
	 * - File S3 lama hanya dihapus saat banner diganti (bukan saat soft-delete).
	 */
	static async bulkUpsertHomepageAds(
		payload: BulkUpsertAdsPayload,
		actor: AuditLogActor,
		db?: Db,
	): Promise<AdsType[]> {
		const { position, items } = payload;

		if (!position?.trim()) {
			throw withStatus(new Error("position wajib diisi"), 400);
		}

		for (const item of items) {
			if (!item.name?.trim()) {
				throw withStatus(new Error("Setiap item wajib memiliki name"), 400);
			}
		}

		const auditActor = requireAuditActor(actor);
		logger.info(
			{ position: position.trim(), itemCount: items.length },
			"AdsManagementService.bulkUpsertHomepageAds dimulai",
		);

		const database = db ?? (await connectToDatabase());
		const col = database.collection(ADS_HOMEPAGE_COLLECTION);
		const now = new Date();

		// 1. Snapshot state saat ini (untuk rollback)
		const snapshotDocs = await col
			.find({ position, deletedAt: null })
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

						const oldFileKey = (original.banner as AdsBanner[])[0]?.filename;
						const newFileKey = item.banner.filename;
						if (oldFileKey && newFileKey && oldFileKey !== newFileKey) {
							s3KeysToDelete.push(oldFileKey);
						}
					}
				} else {
					const result = await col.insertOne({
						variant: item.variant ?? null,
						span: item.span ?? 1,
						name: item.name.trim(),
						banner: item.banner,
						linkUrl: item.linkUrl.trim(),
						position: position.trim(),
						order: item.order,
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

			// 4. Kembalikan state terbaru
			const updatedDocs = await col
				.find({ position, deletedAt: null })
				.sort({ order: 1, createdAt: -1 })
				.toArray();

			logger.info(
				{ position, count: updatedDocs.length },
				"AdsManagementService: bulk upsert berhasil",
			);

			const stableEntityId = `homepage:${position.trim()}`;
			try {
				await createAuditLog(database, {
					actor: auditActor,
					action: AuditLogAction.UPDATE,
					entity: "ADS_HOMEPAGE",
					entityId: stableEntityId,
					details: `Bulk upsert iklan homepage posisi "${position.trim()}" (${updatedDocs.length} slot aktif)`,
					newValue: {
						position: position.trim(),
						activeSlotCount: updatedDocs.length,
						insertedCount: insertedIds.length,
						updatedCount: updatedItems.length,
						softDeletedCount: softDeletedIds.length,
						adIds: updatedDocs.map((d) => d._id.toString()),
					},
				});
			} catch (auditErr) {
				logger.error(
					{ err: auditErr, position },
					"AdsManagementService: gagal menulis audit log (bulkUpsertHomepageAds)",
				);
			}

			// 5. Hapus file lama dari S3 setelah semua DB ops sukses
			await Promise.all(s3KeysToDelete.map(deleteS3BannerSafe));

			return updatedDocs.map(docToAdsType);
		} catch (error) {
			logger.error(
				{ err: error, position },
				"AdsManagementService: bulk upsert gagal — memulai rollback manual",
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
					{ position },
					"AdsManagementService: rollback manual berhasil",
				);
			} catch (rollbackErr) {
				logger.error(
					{ err: rollbackErr, position },
					"AdsManagementService: rollback manual GAGAL — data mungkin tidak konsisten",
				);
			}

			throw error;
		}
	}

	// ──────────────────────────────────────────────────────────────────────────
	// Validation
	// ──────────────────────────────────────────────────────────────────────────

	private static validateCreatePayload(p: CreateAdsHomepagePayload): void {
		const errors: string[] = [];

		if (!p.linkUrl?.trim()) errors.push("linkUrl wajib diisi");
		if (!p.position?.trim()) errors.push("position wajib diisi");
		if (!p.name?.trim()) errors.push("name wajib diisi");

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

		if (errors.length > 0) {
			throw withStatus(new Error(`Validasi gagal: ${errors.join("; ")}`), 400);
		}
	}
}
