import { Db, ObjectId } from "mongodb";
import { SectionVideoItem } from "@/types/articleSection";
import { Media } from "@/types/media";
import logger from "@/lib/logger";
import { S3_BUCKET, s3Client } from "@/lib/s3";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import type { AuditLogActor } from "@/types/auditLog";
import { AuditLogAction, AuditLogEntity } from "@/types/auditLog";
import { createAuditLog, requireAuditActor } from "@/services/auditLogService";

export const COMBINED_PLATFORMS = ["tiktok", "instagram"] as const;
export type CombinedSocmedPlatform = (typeof COMBINED_PLATFORMS)[number];

/** Urutan daftar video GET socmed. Default: order (dashboard). */
export type SocmedVideoSort = "order" | "createdAt";

export function resolveSocmedSort(raw: string | null | undefined): SocmedVideoSort {
	return raw === "createdAt" ? "createdAt" : "order";
}

function mongoSortForSocmed(
	sort: SocmedVideoSort,
): Record<string, 1 | -1> {
	return sort === "createdAt" ? { createdAt: -1 } : { order: 1 };
}

export interface UpsertSocmedVideoSectionPayload {
	videos: Array<{
		video_url: string;
		title: string;
		thumbnail_url: string;
		order?: number;
		thumbnail?: Media;
	}>;
}

export interface UpsertCombinedSocmedVideoSectionPayload {
	videos: Array<{
		video_url: string;
		title: string;
		thumbnail_url: string;
		type: CombinedSocmedPlatform;
		order?: number;
		thumbnail?: Media;
	}>;
}

function validateUpsertSocmedVideoSectionInput(
	payload: UpsertSocmedVideoSectionPayload,
): void {
	if (!payload.videos || !Array.isArray(payload.videos)) {
		const err = new Error("videos harus berupa array");
		(err as any).status = 400;
		throw err;
	}
	if (payload.videos.length === 0) {
		const err = new Error("videos array tidak boleh kosong");
		(err as any).status = 400;
		throw err;
	}
	const seenUrls = new Set<string>();
	for (let i = 0; i < payload.videos.length; i++) {
		const video = payload.videos[i];
		if (!video.video_url) {
			const err = new Error(`videos[${i}].video_url is required`);
			(err as any).status = 400;
			throw err;
		}
		if (!video.title) {
			const err = new Error(`videos[${i}].title is required`);
			(err as any).status = 400;
			throw err;
		}
		if (!video.thumbnail_url) {
			const err = new Error(`videos[${i}].thumbnail_url is required`);
			(err as any).status = 400;
			throw err;
		}
		if (seenUrls.has(video.video_url)) {
			const err = new Error(`videos[${i}].video_url duplikat dalam array`);
			(err as any).status = 400;
			throw err;
		}
		seenUrls.add(video.video_url);
	}
}

export async function getSocmedVideoSectionWithItems(
	db: Db,
	platform: "tiktok" | "instagram" | "youtube",
	sort: SocmedVideoSort = "order",
): Promise<SectionVideoItem[]> {
	try {
		const collection = db.collection("video_section");
		const docs = await collection
			.find({ type: platform })
			.sort(mongoSortForSocmed(sort))
			.toArray();
		return docs.map((doc) => ({
			_id: doc._id?.toString(),
			video_url: doc.video_url,
			title: doc.title,
			thumbnail_url: doc.thumbnail_url,
			thumbnail: doc.thumbnail,
			order: doc.order,
			type: doc.type,
			createdAt: doc.createdAt,
			createdBy:
				typeof doc.createdBy === "string"
					? doc.createdBy
					: doc.createdBy?.toString(),
		}));
	} catch (error) {
		logger.error({ error }, "Error fetching socmed video section");
		throw error;
	}
}

export async function upsertSocmedVideoSection(
	db: Db,
	platform: "tiktok" | "instagram" | "youtube",
	payload: UpsertSocmedVideoSectionPayload,
	actor: AuditLogActor,
): Promise<SectionVideoItem[]> {
	const auditActor = requireAuditActor(actor);
	try {
		logger.info(
			{ platform, videoCount: payload.videos?.length },
			"upsertSocmedVideoSection dimulai",
		);
		validateUpsertSocmedVideoSectionInput(payload);
		const collection = db.collection("video_section");

		// 1. Ambil daftar thumbnail lama sebelum update
		const oldDocs = await collection.find({ type: platform }).toArray();
		const oldThumbnails: string[] = oldDocs
			.map((doc) => doc.thumbnail_url)
			.filter(Boolean);

		// 2. Hapus semua video lama untuk platform ini
		await collection.deleteMany({ type: platform });

		// 3. Siapkan dokumen baru
		const now = new Date();
		const docsToInsert = payload.videos.map((video, idx) => ({
			_id: new ObjectId(),
			video_url: video.video_url,
			title: video.title,
			thumbnail_url: video.thumbnail_url,
			thumbnail: video.thumbnail ?? undefined,
			order: idx,
			type: platform,
			createdAt: now,
			createdBy: new ObjectId(String(auditActor._id)),
		}));
		await collection.insertMany(docsToInsert);

		// 4. Bandingkan thumbnail lama dan baru
		const newThumbnails = payload.videos
			.map((v) => v.thumbnail_url)
			.filter(Boolean);
		const unusedThumbnails = oldThumbnails.filter(
			(oldUrl) => !newThumbnails.includes(oldUrl),
		);

		// 5. Hapus thumbnail yang tidak terpakai dari S3
		for (const url of unusedThumbnails) {
			try {
				// Ekstrak S3 key dari url (asumsi format: /api/media/view?key=...)
				const keyMatch = url.match(/key=([^&]+)/);
				const s3Key = keyMatch ? decodeURIComponent(keyMatch[1]) : null;
				if (s3Key) {
					await s3Client.send(
						new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: s3Key }),
					);
					logger.info({ s3Key }, "Thumbnail lama dihapus dari S3");
				} else {
					logger.warn({ url }, "Gagal ekstrak S3 key dari thumbnail_url");
				}
			} catch (err) {
				logger.error({ url, err }, "Gagal menghapus thumbnail lama dari S3");
			}
		}

		try {
			await createAuditLog(db, {
				actor: auditActor,
				action: AuditLogAction.UPDATE,
				entity: AuditLogEntity.SOCMED_VIDEO_SECTION,
				entityId: platform,
				details: `Mengganti section ${platform}: ${docsToInsert.length} video`,
				oldValue: { videoCount: oldDocs.length },
				newValue: { videoCount: docsToInsert.length },
				meta: { platform },
			});
		} catch (auditErr) {
			logger.error(
				{ err: auditErr, platform },
				"createAuditLog gagal setelah upsertSocmedVideoSection",
			);
		}

		logger.info(
			{
				actorId: String(auditActor._id),
				platform,
				count: docsToInsert.length,
				unusedThumbnails: unusedThumbnails.length,
			},
			"Socmed video section upserted successfully",
		);
		return docsToInsert.map((doc) => ({
			_id: doc._id.toString(),
			video_url: doc.video_url,
			title: doc.title,
			thumbnail_url: doc.thumbnail_url,
			thumbnail: doc.thumbnail,
			order: doc.order,
			type: platform,
			createdAt: doc.createdAt,
			createdBy: doc.createdBy.toString(),
		}));
	} catch (error) {
		logger.error(
			{ actorId: String(actor._id), platform, payload, error },
			"Error upserting socmed video section",
		);
		throw error;
	}
}

function mapDocToSectionVideoItem(doc: Record<string, unknown>): SectionVideoItem {
	return {
		_id: doc._id?.toString(),
		video_url: doc.video_url as string,
		title: doc.title as string,
		thumbnail_url: doc.thumbnail_url as string,
		thumbnail: doc.thumbnail as Media | undefined,
		order: doc.order as number,
		type: doc.type as SectionVideoItem["type"],
		createdAt: doc.createdAt as Date,
		createdBy:
			typeof doc.createdBy === "string"
				? doc.createdBy
				: (doc.createdBy as ObjectId)?.toString(),
	};
}

function validateUpsertCombinedSocmedVideoSectionInput(
	payload: UpsertCombinedSocmedVideoSectionPayload,
): void {
	if (!payload.videos || !Array.isArray(payload.videos)) {
		const err = new Error("videos harus berupa array");
		(err as { status?: number }).status = 400;
		throw err;
	}
	if (payload.videos.length === 0) {
		const err = new Error("videos array tidak boleh kosong");
		(err as { status?: number }).status = 400;
		throw err;
	}

	const seenUrls = new Set<string>();
	for (let i = 0; i < payload.videos.length; i++) {
		const video = payload.videos[i];
		if (!video.video_url) {
			const err = new Error(`videos[${i}].video_url is required`);
			(err as { status?: number }).status = 400;
			throw err;
		}
		if (!video.title) {
			const err = new Error(`videos[${i}].title is required`);
			(err as { status?: number }).status = 400;
			throw err;
		}
		if (!video.thumbnail_url) {
			const err = new Error(`videos[${i}].thumbnail_url is required`);
			(err as { status?: number }).status = 400;
			throw err;
		}
		if (!COMBINED_PLATFORMS.includes(video.type)) {
			const err = new Error(
				`videos[${i}].type harus "tiktok" atau "instagram"`,
			);
			(err as { status?: number }).status = 400;
			throw err;
		}
		if (seenUrls.has(video.video_url)) {
			const err = new Error(`videos[${i}].video_url duplikat dalam array`);
			(err as { status?: number }).status = 400;
			throw err;
		}
		seenUrls.add(video.video_url);
	}
}

async function deleteUnusedThumbnails(
	oldThumbnails: string[],
	newThumbnails: string[],
): Promise<void> {
	const unusedThumbnails = oldThumbnails.filter(
		(oldUrl) => !newThumbnails.includes(oldUrl),
	);

	for (const url of unusedThumbnails) {
		try {
			const keyMatch = url.match(/key=([^&]+)/);
			const s3Key = keyMatch ? decodeURIComponent(keyMatch[1]) : null;
			if (s3Key) {
				await s3Client.send(
					new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: s3Key }),
				);
				logger.info({ s3Key }, "Thumbnail lama dihapus dari S3");
			} else {
				logger.warn({ url }, "Gagal ekstrak S3 key dari thumbnail_url");
			}
		} catch (err) {
			logger.error({ url, err }, "Gagal menghapus thumbnail lama dari S3");
		}
	}
}

/**
 * Ambil video TikTok + Instagram.
 * `sort=order` (default): urutan dashboard. `sort=createdAt`: terbaru dulu.
 * Fallback read-time: jika belum ada data gabungan, gabungkan tiktok + instagram.
 */
export async function getCombinedSocmedVideoSection(
	db: Db,
	sort: SocmedVideoSort = "order",
): Promise<SectionVideoItem[]> {
	try {
		const collection = db.collection("video_section");
		const docs = await collection
			.find({ type: { $in: [...COMBINED_PLATFORMS] } })
			.sort(mongoSortForSocmed(sort))
			.toArray();

		if (docs.length > 0) {
			return docs.map((doc) => mapDocToSectionVideoItem(doc));
		}

		const [tiktokItems, instagramItems] = await Promise.all([
			getSocmedVideoSectionWithItems(db, "tiktok", sort),
			getSocmedVideoSectionWithItems(db, "instagram", sort),
		]);

		const merged = [...tiktokItems, ...instagramItems];
		if (sort === "createdAt") {
			return merged.sort((a, b) => {
				const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
				const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
				return bTime - aTime;
			});
		}

		return merged.map((item, idx) => ({
			...item,
			order: idx,
		}));
	} catch (error) {
		logger.error({ error }, "Error fetching combined socmed video section");
		throw error;
	}
}

export async function upsertCombinedSocmedVideoSection(
	db: Db,
	payload: UpsertCombinedSocmedVideoSectionPayload,
	actor: AuditLogActor,
): Promise<SectionVideoItem[]> {
	const auditActor = requireAuditActor(actor);

	try {
		logger.info(
			{ videoCount: payload.videos?.length },
			"upsertCombinedSocmedVideoSection dimulai",
		);
		validateUpsertCombinedSocmedVideoSectionInput(payload);

		const collection = db.collection("video_section");
		const oldDocs = await collection
			.find({ type: { $in: [...COMBINED_PLATFORMS] } })
			.toArray();
		const oldThumbnails = oldDocs
			.map((doc) => doc.thumbnail_url as string)
			.filter(Boolean);

		await collection.deleteMany({ type: { $in: [...COMBINED_PLATFORMS] } });

		const now = new Date();
		const docsToInsert = payload.videos.map((video, idx) => ({
			_id: new ObjectId(),
			video_url: video.video_url,
			title: video.title,
			thumbnail_url: video.thumbnail_url,
			thumbnail: video.thumbnail ?? undefined,
			order: idx,
			type: video.type,
			createdAt: now,
			createdBy: new ObjectId(String(auditActor._id)),
		}));

		await collection.insertMany(docsToInsert);

		const newThumbnails = payload.videos
			.map((v) => v.thumbnail_url)
			.filter(Boolean);
		await deleteUnusedThumbnails(oldThumbnails, newThumbnails);

		try {
			await createAuditLog(db, {
				actor: auditActor,
				action: AuditLogAction.UPDATE,
				entity: AuditLogEntity.SOCMED_VIDEO_SECTION,
				entityId: "combined",
				details: `Mengganti section socmed gabungan: ${docsToInsert.length} video`,
				oldValue: { videoCount: oldDocs.length },
				newValue: { videoCount: docsToInsert.length },
				meta: { platform: "combined" },
			});
		} catch (auditErr) {
			logger.error(
				{ err: auditErr },
				"createAuditLog gagal setelah upsertCombinedSocmedVideoSection",
			);
		}

		logger.info(
			{
				actorId: String(auditActor._id),
				count: docsToInsert.length,
			},
			"Combined socmed video section upserted successfully",
		);

		return docsToInsert.map((doc) => mapDocToSectionVideoItem(doc));
	} catch (error) {
		logger.error(
			{ actorId: String(actor._id), payload, error },
			"Error upserting combined socmed video section",
		);
		throw error;
	}
}
