/**
 * Ambil seluruh koleksi media dari database (tanpa paginasi).
 */
import {
	PutObjectCommand,
	DeleteObjectCommand,
	GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client, S3_BUCKET } from "@/lib/s3";
import { ulid } from "ulid";
import { Db, ObjectId } from "mongodb";
import { connectToDatabase } from "@/lib/db/db";
import type {
	Media,
	MediaUsageInArticle,
	PayloadCreateMedia,
} from "@/types/media";
import logger from "@/lib/logger";
import { isAllowedArticleUploadFolder } from "@/lib/media/articleUploadScopes";
import type { AuditLogActor } from "@/types/auditLog";
import { AuditLogAction } from "@/types/auditLog";
import { createAuditLog, requireAuditActor } from "@/services/auditLogService";
import { ensurePresignedUploadIsWebp } from "@/lib/image/ensureObjectStorageWebp";
import {
	ensureObjectCacheControl,
	withImmutableCacheControl,
} from "@/lib/s3/object-cache";

export interface UploadMediaResult {
	fileName: string;
}

export interface PresignedUrlResult {
	uploadUrl: string;
	fileKey: string;
	expiresIn: number;
}

export interface PresignedUploadOptions {
	/** Subfolder dalam bucket untuk artikel baru; hanya nilai whitelist (featured, content-images, gallery-content). */
	objectFolder?: string | null;
}

function sanitizeFileName(name: string): string {
	return name.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9._-]/g, "");
}

/**
 * Upload file (image/video) ke S3/MinIO.
 * Image dioptimasi dengan sharp ke format webp sebelum upload.
 */
export async function uploadMedia(file: File): Promise<UploadMediaResult> {
	let generatedFileName = "";
	try {
		const arrayBuffer = await file.arrayBuffer();
		let buffer: Buffer = Buffer.from(arrayBuffer as ArrayBuffer);
		let contentType = file.type || "application/octet-stream";
		const uniqueId = ulid();

		if (file.type?.startsWith("image/")) {
			const sharp = (await import("sharp")).default;
			buffer = (await sharp(buffer)
				.resize(1200, 800, { fit: "cover" })
				.webp({ quality: 80 })
				.toBuffer()) as Buffer;
			contentType = "image/webp";
			generatedFileName = `${uniqueId}.webp`;
		} else if (file.type?.startsWith("video/")) {
			const ext =
				file.name && file.name.includes(".")
					? file.name.substring(file.name.lastIndexOf("."))
					: "";
			generatedFileName = `${uniqueId}${ext}`;
		} else {
			throw new Error("Unsupported file type");
		}

		await s3Client.send(
			new PutObjectCommand(withImmutableCacheControl({
				Bucket: S3_BUCKET,
				Key: generatedFileName,
				Body: buffer,
				ContentType: contentType,
			})),
		);

		logger.info(
			{ key: generatedFileName, contentType },
			"uploadMedia: file uploaded ke S3",
		);

		return { fileName: generatedFileName };
	} catch (err) {
		logger.error(
			{ err, key: generatedFileName || undefined },
			"uploadMedia: gagal upload ke S3",
		);
		throw err;
	}
}

/**
 * Generate presigned URL untuk upload langsung ke S3/MinIO dari client.
 * @param objectFolder — opsional; jika diset (whitelist artikel), key menjadi `folder/basename`.
 */
export async function getPresignedUploadUrl(
	filename: string,
	contentType: string,
	options?: PresignedUploadOptions,
): Promise<PresignedUrlResult> {
	const safeFileName = sanitizeFileName(filename);
	const timestamp = Date.now();
	let generatedFileName: string;

	if (contentType.startsWith("image/")) {
		const base = safeFileName.replace(/\.[^.]+$/, "");
		generatedFileName = `${timestamp}-${base}.webp`;
	} else if (contentType.startsWith("video/")) {
		const base = safeFileName.replace(/\.[^.]+$/, "");
		const ext = safeFileName.includes(".")
			? safeFileName.substring(safeFileName.lastIndexOf("."))
			: "";
		generatedFileName = `${timestamp}-${base}${ext}`;
	} else {
		throw new Error("Unsupported file type");
	}

	const rawFolder = options?.objectFolder?.trim();
	if (rawFolder) {
		const normalized = rawFolder.replace(/^\/+|\/+$/g, "");
		if (!isAllowedArticleUploadFolder(normalized)) {
			throw new Error("Invalid object folder for presigned upload");
		}
		generatedFileName = `${normalized}/${generatedFileName}`;
	}

	const expiresIn = 60 * 5; // 5 menit
	const uploadUrl = await getSignedUrl(
		s3Client,
		new PutObjectCommand(withImmutableCacheControl({
			Bucket: S3_BUCKET,
			Key: generatedFileName,
			ContentType: contentType,
		})),
		{ expiresIn },
	);

	return { uploadUrl, fileKey: generatedFileName, expiresIn };
}

/**
 * Hapus file dari S3/MinIO berdasarkan nama file (key).
 */
export async function deleteMedia(filename: string): Promise<void> {
	try {
		await s3Client.send(
			new DeleteObjectCommand({
				Bucket: S3_BUCKET,
				Key: filename,
			}),
		);
		logger.info({ key: filename }, "deleteMedia: file dihapus dari S3");
	} catch (err) {
		logger.error({ err, filename }, "deleteMedia: gagal hapus dari S3");
		throw err;
	}
}

/**
 * Ambil file media dari S3/MinIO dan kembalikan stream beserta metadata-nya.
 * Untuk digunakan pada endpoint view media agar kode lebih reusable dan readable.
 */
export async function getMediaViewStream(key: string): Promise<{
	body: ReadableStream;
	contentType: string;
	contentLength?: number;
}> {
	// Gunakan seluruh key/path yang diberikan (support folder/nested path)
	// Bersihkan query string jika ada
	let cleanKey = key.split("?")[0];
	cleanKey = decodeURIComponent(cleanKey);

	const Bucket = process.env.S3_BUCKET_NAME || "arasvara-images";
	const command = new GetObjectCommand({ Bucket, Key: cleanKey });
	const s3Response = await s3Client.send(command);
	const contentType = s3Response.ContentType || "application/octet-stream";
	const contentLength = s3Response.ContentLength;

	return {
		body: s3Response.Body as ReadableStream,
		contentType,
		contentLength,
	};
}

/**
 * Ambil file avatar dari S3/MinIO dan kembalikan stream beserta metadata-nya.
 * Untuk digunakan pada endpoint view avatar agar kode lebih reusable dan readable.
 */
export async function getAvatarViewStream(key: string): Promise<{
	body: ReadableStream;
	contentType: string;
	contentLength?: number;
}> {
	// Pastikan hanya filename yang digunakan sebagai key
	let cleanKey = key.split("/").pop() || key;
	cleanKey = cleanKey.split("?")[0];
	cleanKey = decodeURIComponent(cleanKey);

	const Bucket = process.env.S3_BUCKET_AVATAR || "arasvara-avatar";
	const command = new GetObjectCommand({ Bucket, Key: cleanKey });
	const s3Response = await s3Client.send(command);
	const contentType = s3Response.ContentType || "application/octet-stream";
	const contentLength = s3Response.ContentLength;

	return {
		body: s3Response.Body as ReadableStream,
		contentType,
		contentLength,
	};
}

export async function saveMediaDB(
	db: Db,
	file: File,
	meta: Omit<PayloadCreateMedia, "url" | "filename" | "mimetype" | "size">,
	actor: AuditLogActor,
): Promise<Media> {
	const auditActor = requireAuditActor(actor);

	const { fileName } = await uploadMedia(file);

	const url = `/api/media/view?key=${encodeURIComponent(fileName)}`;

	let mimetype = file.type;
	if (file.type?.startsWith("image/")) {
		mimetype = "image/webp";
	}

	const now = new Date().toISOString();
	const mediaDoc: Omit<Media, "_id"> = {
		url,
		filename: fileName,
		mimetype,
		size: file.size,
		caption: meta.caption,
		credit: meta.credit,
		watermark: meta.watermark ?? false,
		createdAt: now,
		updatedAt: now,
	};

	const result = await db.collection("media").insertOne(mediaDoc);
	const insertedId = result.insertedId.toString();

	logger.info(
		{ mediaId: insertedId, filename: fileName },
		"saveMediaDB selesai",
	);

	try {
		await createAuditLog(db, {
			actor: auditActor,
			action: AuditLogAction.CREATE,
			entity: "MEDIA",
			entityId: insertedId,
			details: `Upload media: ${fileName}`,
			newValue: {
				filename: fileName,
				mimetype,
				caption: meta.caption,
				credit: meta.credit,
			},
		});
	} catch (auditErr) {
		logger.error(
			{ err: auditErr, mediaId: insertedId },
			"createAuditLog gagal setelah saveMediaDB",
		);
	}

	return {
		_id: insertedId,
		...mediaDoc,
	};
}

/**
 * Daftarkan media yang sudah diupload langsung ke object storage (via presigned URL)
 * ke dalam koleksi `media` di MongoDB.
 * Gambar artikel diaudit & di-re-encode ke WebP valid jika format tidak cocok.
 *
 * @param fileKey  Nama file / key di object storage (e.g. "1234567890-image.webp")
 * @param meta     Metadata tambahan: size (byte), caption, takenBy, watermark
 */
export async function registerPresignedMedia(
	fileKey: string,
	meta: {
		size: number;
		caption?: string;
		credit?: string;
		watermark?: boolean;
	},
): Promise<Media> {
	if (!fileKey || typeof fileKey !== "string" || fileKey.trim() === "") {
		throw Object.assign(new Error("fileKey is required"), { status: 400 });
	}
	if (fileKey.includes("..") || fileKey.startsWith("/")) {
		throw Object.assign(new Error("Invalid fileKey"), { status: 400 });
	}

	const audit = await ensurePresignedUploadIsWebp(fileKey, meta.size);
	await ensureObjectCacheControl(S3_BUCKET, fileKey);
	const finalSize = audit.size > 0 ? audit.size : meta.size;

	const url = `/api/media/view?key=${encodeURIComponent(fileKey)}`;
	const now = new Date().toISOString();

	const mediaDoc: Omit<Media, "_id"> = {
		url,
		filename: fileKey,
		mimetype: "image/webp",
		size: finalSize,
		caption: meta.caption,
		credit: meta.credit,
		watermark: meta.watermark ?? false,
		createdAt: now,
		updatedAt: now,
	};

	const db = await connectToDatabase();
	const result = await db.collection("media").insertOne(mediaDoc);

	return {
		_id: result.insertedId.toString(),
		...mediaDoc,
	};
}

/**
 * Delete a media document from the "media" collection by its ID.
 * @param id MongoDB ObjectId string
 */

export async function deleteMediaDB(
	db: Db,
	id: string,
	actor: AuditLogActor,
): Promise<void> {
	const auditActor = requireAuditActor(actor);

	const media = await db.collection("media").findOne({ _id: new ObjectId(id) });
	if (!media) {
		logger.warn({ mediaId: id }, "deleteMediaDB: Media not found");
		return;
	}
	const filename = media.filename as string;

	try {
		await deleteMedia(filename);
		logger.info(
			{ mediaId: id, filename },
			"deleteMediaDB: Deleted from object storage",
		);
	} catch (err) {
		logger.error(
			{ mediaId: id, filename, err },
			"deleteMediaDB: Failed to delete from object storage",
		);
		throw new Error(`Failed to delete media from object storage: ${err}`);
	}

	await db.collection("media").deleteOne({ _id: new ObjectId(id) });
	logger.info(
		{ mediaId: id, filename },
		"deleteMediaDB: Deleted from database",
	);

	try {
		await createAuditLog(db, {
			actor: auditActor,
			action: AuditLogAction.DELETE,
			entity: "MEDIA",
			entityId: id,
			details: `Hapus media: ${filename}`,
			oldValue: {
				filename,
				caption: media.caption,
				credit: media.credit,
			},
		});
	} catch (auditErr) {
		logger.error(
			{ err: auditErr, mediaId: id },
			"createAuditLog gagal setelah deleteMediaDB",
		);
	}
}

/**
 * Get all media documents with optional pagination.
 */
export async function getMediaDB(params: {
	page?: number;
	limit?: number;
}): Promise<{ media: Media[]; total: number }> {
	const { page = 1, limit = 20 } = params;
	const skip = (page - 1) * limit;

	const db = await connectToDatabase();
	const col = db.collection("media");

	const [docs, total] = await Promise.all([
		col.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
		col.countDocuments({}),
	]);

	const media: Media[] = docs.map((doc) => ({
		_id: doc._id.toString(),
		url: doc.url,
		filename: doc.filename,
		mimetype: doc.mimetype,
		size: doc.size,
		caption: doc.caption,
		credit: doc.credit,
		watermark: doc.watermark ?? false,
		createdAt: doc.createdAt,
		updatedAt: doc.updatedAt,
	}));

	return { media, total };
}

/**
 * Ambil media dengan pagination page/limit atau cursor.
 * @param params { page, limit, cursor }
 * - page/limit: page-based pagination
 * - cursor: cursor-based pagination (ObjectId string)
 */
/**
 * Ambil media dengan pagination, filter mimetype, dan pencarian query (caption/takenBy).
 * @param params { page, limit, cursor, filter, query }
 * - filter: "image" | "video" | "pdf" | undefined
 * - query: string (partial match, case-insensitive)
 */
export async function getMediaFromDB(params?: {
	page?: number;
	limit?: number;
	cursor?: string;
	filter?: string;
	query?: string;
}): Promise<{ media: Media[]; nextCursor?: string; total?: number }> {
	const db = await connectToDatabase();
	const col = db.collection("media");
	const { page, limit, cursor, filter, query } = params || {};
	const mongoQuery: any = {};
	// Cursor pagination
	if (cursor) {
		mongoQuery._id = { $lt: new ObjectId(cursor) };
	}
	// Filter mimetype
	if (filter === "image") {
		mongoQuery.mimetype = { $regex: /^image\//i };
	} else if (filter === "video") {
		mongoQuery.mimetype = { $regex: /^video\//i };
	} else if (filter === "pdf") {
		mongoQuery.mimetype = "application/pdf";
	}
	// Query search (caption/takenBy, partial, case-insensitive)
	if (query && query.trim() !== "") {
		const regex = new RegExp(query, "i");
		mongoQuery.$or = [
			{ caption: { $regex: regex } },
			{ credit: { $regex: regex } },
		];
	}
	const sort = { _id: "desc" as const };
	let docs: any[] = [];
	let total: number | undefined = undefined;
	let nextCursor: string | undefined = undefined;
	const pageSize = limit || 20;
	if (typeof page === "number" && page > 0) {
		// Page-based
		const skip = ((page || 1) - 1) * pageSize;
		docs = await col
			.find(mongoQuery)
			.sort(sort)
			.skip(skip)
			.limit(pageSize)
			.toArray();
		total = await col.countDocuments(mongoQuery);
	} else {
		// Cursor-based (atau default)
		docs = await col.find(mongoQuery).sort(sort).limit(pageSize).toArray();
	}
	if (docs.length === pageSize) {
		nextCursor = docs[docs.length - 1]._id.toString();
	}
	const media: Media[] = docs.map((doc) => ({
		_id: doc._id.toString(),
		url: doc.url,
		filename: doc.filename,
		mimetype: doc.mimetype,
		size: doc.size,
		caption: doc.caption,
		credit: doc.credit,
		watermark: doc.watermark ?? false,
		createdAt: doc.createdAt,
		updatedAt: doc.updatedAt,
	}));
	return { media, nextCursor, total };
}

/**
 * Cek apakah media digunakan di artikel manapun (featuredImageId atau contentMediaIds).
 * @param mediaId string | ObjectId
 * @param returnDetail jika true, return array detail artikel; jika false, return boolean saja
 */
export async function findArticlesUsingMedia(
	mediaId: string | ObjectId,
	returnDetail = false,
): Promise<boolean | MediaUsageInArticle[]> {
	const db = await connectToDatabase();
	let objId: ObjectId;
	try {
		objId = typeof mediaId === "string" ? new ObjectId(mediaId) : mediaId;
	} catch {
		if (returnDetail) return [];
		return false;
	}

	// Only check articles that are not soft deleted
	const query = {
		$and: [
			{
				$or: [
					{ featuredImageId: objId },
					{ contentMediaIds: { $in: [objId, objId.toString()] } },
				],
			},
			{
				$or: [{ deletedAt: { $exists: false } }, { deletedAt: null }],
			},
		],
	};
	const projection = {
		_id: 1,
		title: 1,
		slug: 1,
		featuredImageId: 1,
		contentMediaIds: 1,
	};

	if (!returnDetail) {
		const found = await db
			.collection("articles")
			.find(query, { projection })
			.limit(1)
			.toArray();
		return found.length > 0;
	}

	const articles = await db
		.collection("articles")
		.find(query, { projection })
		.toArray();

	// Map usage type
	const result: MediaUsageInArticle[] = articles.map((a) => {
		const usedAs: ("featured" | "content")[] = [];
		if (
			a.featuredImageId &&
			(a.featuredImageId.equals?.(objId) ||
				a.featuredImageId === objId.toString())
		) {
			usedAs.push("featured");
		}
		if (Array.isArray(a.contentMediaIds)) {
			if (
				a.contentMediaIds.some(
					(id: string | ObjectId) => id?.toString?.() === objId.toString(),
				)
			) {
				usedAs.push("content");
			}
		}
		return {
			_id: a._id.toString(),
			title: a.title,
			slug: a.slug,
			usedAs,
		};
	});
	return result;
}

/**
 * Update caption dan takenBy media berdasarkan id.
 * @param db MongoDB database instance
 * @param id string (ObjectId)
 * @param data { caption?: string, takenBy?: string }
 * @returns Media (updated)
 */
export async function updateMedia(
	db: Db,
	id: string,
	data: { caption?: string; credit?: string },
	actor: AuditLogActor,
): Promise<Media> {
	try {
		const auditActor = requireAuditActor(actor);

		let objectId: ObjectId;
		try {
			objectId = new ObjectId(id);
		} catch {
			const err: any = new Error("Invalid media id");
			err.status = 400;
			throw err;
		}

		const existing = await db.collection("media").findOne({ _id: objectId });
		if (!existing) {
			const err: any = new Error("Media not found");
			err.status = 404;
			throw err;
		}

		const oldValue = {
			caption: existing.caption,
			credit: existing.credit,
		};

		const { caption, credit } = data;
		const now = new Date().toISOString();
		const update: { updatedAt: string; caption?: string; credit?: string } = {
			updatedAt: now,
		};
		if (typeof caption !== "undefined") update.caption = caption;
		if (typeof credit !== "undefined") update.credit = credit;

		let result;
		try {
			result = await db
				.collection("media")
				.findOneAndUpdate(
					{ _id: objectId },
					{ $set: update },
					{ returnDocument: "after" },
				);
		} catch {
			result = await db
				.collection("media")
				.findOneAndUpdate(
					{ _id: objectId },
					{ $set: update },
					{ returnDocument: "after" },
				);
		}

		if (!result) {
			logger.error(
				{ id, update },
				"updateMedia: dokumen tidak ditemukan setelah update",
			);
			const err: any = new Error("Media not found");
			err.status = 404;
			throw err;
		}

		const updatedMedia: Media = {
			_id: result._id.toString(),
			url: result.url,
			filename: result.filename,
			mimetype: result.mimetype,
			size: result.size,
			caption: result.caption,
			credit: result.credit,
			watermark: result.watermark ?? false,
			createdAt: result.createdAt,
			updatedAt: result.updatedAt,
		};

		logger.info({ mediaId: id }, "updateMedia selesai");

		try {
			await createAuditLog(db, {
				actor: auditActor,
				action: AuditLogAction.UPDATE,
				entity: "MEDIA",
				entityId: id,
				details: `Memperbarui metadata media ${result.filename}`,
				oldValue,
				newValue: {
					caption: updatedMedia.caption,
					credit: updatedMedia.credit,
				},
			});
		} catch (auditErr) {
			logger.error(
				{ err: auditErr, mediaId: id },
				"createAuditLog gagal setelah updateMedia",
			);
		}

		return updatedMedia;
	} catch (error: any) {
		if (error && error.status) throw error;
		const err: any = new Error(error?.message || "Failed to update media");
		err.status = 400;
		throw err;
	}
}
