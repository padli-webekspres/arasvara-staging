import { Db, ObjectId } from "mongodb";
import logger from "@/lib/logger";
import { S3_BUCKET, s3Client } from "@/lib/s3";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import type { AuditLogActor } from "@/types/auditLog";
import { AuditLogAction } from "@/types/auditLog";
import { createAuditLog, requireAuditActor } from "@/services/auditLogService";

export interface SponsorItem {
	_id?: string;
	name: string;
	image_url: string;
	order?: number;
	createdAt?: Date;
	createdBy?: string;
}

export interface UpsertSponsorsPayload {
	sponsors: Array<{
		name: string;
		image_url: string;
		order?: number;
	}>;
}

function validateUpsertSponsorsInput(payload: UpsertSponsorsPayload): void {
	if (!payload.sponsors || !Array.isArray(payload.sponsors)) {
		const err = new Error("sponsors harus berupa array");
		(err as any).status = 400;
		throw err;
	}

	const seenUrls = new Set<string>();
	for (let i = 0; i < payload.sponsors.length; i++) {
		const sponsor = payload.sponsors[i];
		if (!sponsor.name) {
			const err = new Error(`sponsors[${i}].name is required`);
			(err as any).status = 400;
			throw err;
		}
		if (!sponsor.image_url) {
			const err = new Error(`sponsors[${i}].image_url is required`);
			(err as any).status = 400;
			throw err;
		}
		if (seenUrls.has(sponsor.image_url)) {
			const err = new Error(`sponsors[${i}].image_url duplikat dalam array`);
			(err as any).status = 400;
			throw err;
		}
		seenUrls.add(sponsor.image_url);
	}
}

export async function getSponsors(db: Db): Promise<SponsorItem[]> {
	try {
		const collection = db.collection("sponsors");
		const docs = await collection.find({}).sort({ order: 1 }).toArray();

		return docs.map((doc) => ({
			_id: doc._id?.toString(),
			name: doc.name,
			image_url: doc.image_url,
			order: doc.order,
			createdAt: doc.createdAt,
			createdBy:
				typeof doc.createdBy === "string"
					? doc.createdBy
					: doc.createdBy?.toString(),
		}));
	} catch (error) {
		logger.error({ error }, "Error fetching sponsors");
		throw error;
	}
}

export async function upsertSponsors(
	db: Db,
	payload: UpsertSponsorsPayload,
	actor: AuditLogActor,
): Promise<SponsorItem[]> {
	const auditActor = requireAuditActor(actor);
	try {
		logger.info(
			{ sponsorCount: payload.sponsors?.length ?? 0 },
			"upsertSponsors dimulai",
		);
		validateUpsertSponsorsInput(payload);
		const collection = db.collection("sponsors");

		// 1. Ambil daftar image lama sebelum update
		const oldDocs = await collection.find({}).toArray();
		const oldImages: string[] = oldDocs
			.map((doc) => doc.image_url)
			.filter(Boolean);

		// 2. Hapus semua sponsor lama
		await collection.deleteMany({});

		// 3. Siapkan dokumen baru
		const now = new Date();
		const docsToInsert = payload.sponsors.map((sponsor, idx) => ({
			_id: new ObjectId(),
			name: sponsor.name,
			image_url: sponsor.image_url,
			order: idx,
			createdAt: now,
			createdBy: new ObjectId(String(auditActor._id)),
		}));

		if (docsToInsert.length > 0) {
			await collection.insertMany(docsToInsert);
		}

		// 4. Bandingkan image lama dan baru
		const newImages = payload.sponsors.map((s) => s.image_url).filter(Boolean);

		const unusedImages = oldImages.filter(
			(oldUrl) => !newImages.includes(oldUrl),
		);

		// 5. Hapus image yang tidak terpakai dari S3
		for (const url of unusedImages) {
			try {
				const keyMatch = url.match(/key=([^&]+)/);
				const s3Key = keyMatch ? decodeURIComponent(keyMatch[1]) : null;
				if (s3Key) {
					await s3Client.send(
						new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: s3Key }),
					);
					logger.info({ s3Key }, "Sponsor image lama dihapus dari S3");
				} else {
					logger.warn({ url }, "Gagal ekstrak S3 key dari image_url");
				}
			} catch (err) {
				logger.error(
					{ url, err },
					"Gagal menghapus sponsor image lama dari S3",
				);
			}
		}

		try {
			await createAuditLog(db, {
				actor: auditActor,
				action: AuditLogAction.UPDATE,
				entity: "SPONSOR",
				entityId: "sponsors",
				details: `Mengganti daftar sponsor: ${docsToInsert.length} item`,
				oldValue: { sponsorCount: oldDocs.length },
				newValue: { sponsorCount: docsToInsert.length },
			});
		} catch (auditErr) {
			logger.error(
				{ err: auditErr },
				"createAuditLog gagal setelah upsertSponsors",
			);
		}

		logger.info(
			{
				actorId: String(auditActor._id),
				count: docsToInsert.length,
				unusedImages: unusedImages.length,
			},
			"Sponsors upserted successfully",
		);

		return docsToInsert.map((doc) => ({
			_id: doc._id.toString(),
			name: doc.name,
			image_url: doc.image_url,
			order: doc.order,
			createdAt: doc.createdAt,
			createdBy: doc.createdBy.toString(),
		}));
	} catch (error) {
		logger.error(
			{ actorId: String(actor._id), payload, error },
			"Error upserting sponsors",
		);
		throw error;
	}
}
