import { Db, ObjectId } from "mongodb";
import type {
	AuditLogActor,
	AuditLogListResult,
	AuditLogMeta,
	AuditLogPayload,
	AuditLogQueryParams,
	SerializedAuditLog,
} from "@/types/auditLog";
import { AuditLogAction, EDITORIAL_ENTITIES } from "@/types/auditLog";

/**
 * Validasi actor sebelum mutasi + audit: name/email non-kosong setelah trim.
 * Melempar error dengan status 400 agar konsisten dengan layanan artikel.
 */
export function requireAuditActor(actor: {
	_id: string | ObjectId;
	name?: string | null;
	email?: string | null;
}): AuditLogActor {
	const name = typeof actor.name === "string" ? actor.name.trim() : "";
	const email = typeof actor.email === "string" ? actor.email.trim() : "";
	if (!name || !email) {
		throw Object.assign(new Error("name dan email wajib untuk audit"), {
			status: 400,
		});
	}
	return { _id: actor._id, name, email };
}

const COLLECTION = "audit_log";

/** Cek apakah entity termasuk aktivitas editorial */
export function isEditorialEntity(entity: string): boolean {
	const normalized = entity.trim();
	return (EDITORIAL_ENTITIES as readonly string[]).includes(normalized);
}

/** Bangun meta konsisten untuk audit log artikel */
export function buildArticleAuditMeta(params: {
	statusFrom?: string;
	statusTo?: string;
	articleTitle?: string;
	reason?: string;
}): AuditLogMeta {
	const meta: AuditLogMeta = {};
	if (params.statusFrom != null && params.statusFrom !== "") {
		meta.statusFrom = params.statusFrom;
	}
	if (params.statusTo != null && params.statusTo !== "") {
		meta.statusTo = params.statusTo;
	}
	if (params.articleTitle != null && params.articleTitle !== "") {
		meta.articleTitle = params.articleTitle;
	}
	if (params.reason != null && params.reason.trim() !== "") {
		meta.reason = params.reason.trim();
	}
	return meta;
}

/** Snapshot ringkas artikel untuk oldValue/newValue audit log */
export function buildArticleSlimSnapshot(article: {
	status?: string | null;
	title?: string | null;
	slug?: string | null;
	scheduledAt?: Date | string | null;
}): {
	status?: string;
	title?: string;
	slug?: string;
	scheduledAt?: string;
} {
	const snapshot: {
		status?: string;
		title?: string;
		slug?: string;
		scheduledAt?: string;
	} = {};

	if (article.status != null && article.status !== "") {
		snapshot.status = String(article.status);
	}
	if (article.title != null && article.title !== "") {
		snapshot.title = String(article.title);
	}
	if (article.slug != null && article.slug !== "") {
		snapshot.slug = String(article.slug);
	}
	if (article.scheduledAt != null) {
		snapshot.scheduledAt =
			article.scheduledAt instanceof Date
				? article.scheduledAt.toISOString()
				: String(article.scheduledAt);
	}

	return snapshot;
}

/** Escape untuk pola literal di dalam RegExp */
export function escapeRegexLiteral(term: string): string {
	return term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function tryObjectId(id: string | ObjectId): ObjectId | null {
	if (id instanceof ObjectId) return id;
	if (typeof id === "string" && /^[a-f\d]{24}$/i.test(id.trim())) {
		try {
			return new ObjectId(id.trim());
		} catch {
			return null;
		}
	}
	return null;
}

/** Simpan sebagai ObjectId jika hex 24 karakter, selain itu string */
function normalizeRefId(id: string | ObjectId): ObjectId | string {
	const oid = tryObjectId(id);
	return oid ?? String(id).trim();
}

/**
 * Rentang [start, end] UTC untuk satu tanggal kalender.
 * String `YYYY-MM-DD` diinterpretasikan sebagai tanggal UTC (bukan lokal browser).
 */
export function utcCalendarDayRange(day: Date | string): {
	start: Date;
	end: Date;
} {
	let year: number;
	let monthIndex: number;
	let date: number;

	if (typeof day === "string") {
		const trimmed = day.trim();
		const isoDate = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
		if (isoDate) {
			year = parseInt(isoDate[1], 10);
			monthIndex = parseInt(isoDate[2], 10) - 1;
			date = parseInt(isoDate[3], 10);
		} else {
			const parsed = new Date(trimmed);
			if (Number.isNaN(parsed.getTime())) {
				throw new Error(
					"createdAtDay tidak valid: gunakan Date atau string YYYY-MM-DD",
				);
			}
			year = parsed.getUTCFullYear();
			monthIndex = parsed.getUTCMonth();
			date = parsed.getUTCDate();
		}
	} else {
		year = day.getUTCFullYear();
		monthIndex = day.getUTCMonth();
		date = day.getUTCDate();
	}

	const start = new Date(Date.UTC(year, monthIndex, date, 0, 0, 0, 0));
	const end = new Date(Date.UTC(year, monthIndex, date, 23, 59, 59, 999));
	return { start, end };
}

function serializeAuditDoc(doc: Record<string, unknown>): SerializedAuditLog {
	const actorRaw = doc.actor as Record<string, unknown> | undefined;
	const actorIdRaw = actorRaw?._id;

	const entityIdRaw = doc.entityId;
	const createdRaw = doc.createdAt;

	const actor = {
		_id:
			actorIdRaw instanceof ObjectId
				? actorIdRaw.toHexString()
				: String(actorIdRaw ?? ""),
		name: String(actorRaw?.name ?? ""),
		email: String(actorRaw?.email ?? ""),
		...(typeof actorRaw?.avatarUrl === "string"
			? { avatarUrl: actorRaw.avatarUrl }
			: {}),
	};

	const out: SerializedAuditLog = {
		_id: String(doc._id),
		actor,
		action: (doc.action ?? AuditLogAction.CREATE) as AuditLogAction,
		entity: String(doc.entity ?? ""),
		entityId:
			entityIdRaw instanceof ObjectId
				? entityIdRaw.toHexString()
				: String(entityIdRaw ?? ""),
		createdAt:
			createdRaw instanceof Date
				? createdRaw
				: new Date(String(createdRaw ?? Date.now())),
	};

	if (typeof doc.details === "string") out.details = doc.details;
	if (doc.oldValue !== undefined) out.oldValue = doc.oldValue;
	if (doc.newValue !== undefined) out.newValue = doc.newValue;
	if (doc.meta !== undefined && doc.meta !== null && typeof doc.meta === "object") {
		out.meta = doc.meta as AuditLogMeta;
	}
	if (typeof doc.ipAddress === "string") out.ipAddress = doc.ipAddress;

	return out;
}

/**
 * Menulis satu baris audit log ke koleksi `audit_log`.
 * `createdAt` boleh diomit — pakai waktu server.
 */
export async function createAuditLog(
	db: Db,
	payload: Omit<AuditLogPayload, "createdAt"> & {
		createdAt?: string | Date;
	},
): Promise<{ _id: string }> {
	const name = payload.actor?.name?.trim();
	const email = payload.actor?.email?.trim();
	const action = payload.action?.trim();
	const entity = payload.entity?.trim();

	if (!name) throw new Error("actor.name wajib diisi");
	if (!email) throw new Error("actor.email wajib diisi");
	if (!action) throw new Error("action wajib diisi");
	if (!entity) throw new Error("entity wajib diisi");
	if (
		payload.entityId === undefined ||
		payload.entityId === null ||
		String(payload.entityId).trim() === ""
	) {
		throw new Error("entityId wajib diisi");
	}

	const createdAt =
		payload.createdAt != null ? new Date(payload.createdAt) : new Date();
	if (Number.isNaN(createdAt.getTime())) {
		throw new Error("createdAt tidak valid");
	}

	const doc: Record<string, unknown> = {
		actor: {
			_id: normalizeRefId(payload.actor._id),
			name,
			email,
			...(payload.actor.avatarUrl != null && payload.actor.avatarUrl !== ""
				? { avatarUrl: String(payload.actor.avatarUrl).trim() }
				: {}),
		},
		action,
		entity,
		entityId: normalizeRefId(payload.entityId),
		createdAt,
	};

	if (payload.details != null && String(payload.details).trim() !== "") {
		doc.details = String(payload.details).trim();
	}
	if (payload.oldValue !== undefined) doc.oldValue = payload.oldValue;
	if (payload.newValue !== undefined) doc.newValue = payload.newValue;
	if (payload.meta !== undefined && Object.keys(payload.meta).length > 0) {
		doc.meta = payload.meta;
	}
	if (payload.ipAddress != null && String(payload.ipAddress).trim() !== "") {
		doc.ipAddress = String(payload.ipAddress).trim();
	}

	const result = await db.collection(COLLECTION).insertOne(doc as never);
	return { _id: result.insertedId.toHexString() };
}

function buildAuditLogFilter(
	params: AuditLogQueryParams,
): Record<string, unknown> {
	const filter: Record<string, unknown> = {};

	if (
		params.actorId !== undefined &&
		params.actorId !== null &&
		String(params.actorId).trim() !== ""
	) {
		const oid = tryObjectId(params.actorId);
		filter["actor._id"] = oid ?? String(params.actorId).trim();
	}

	if (params.action !== undefined && params.action.trim() !== "") {
		const escaped = escapeRegexLiteral(params.action.trim());
		filter.action = { $regex: `^${escaped}$`, $options: "i" };
	}

	if (params.entity !== undefined && params.entity.trim() !== "") {
		const escaped = escapeRegexLiteral(params.entity.trim());
		filter.entity = { $regex: `^${escaped}$`, $options: "i" };
	}

	if (params.createdAtDay !== undefined) {
		const { start, end } = utcCalendarDayRange(params.createdAtDay);
		filter.createdAt = { $gte: start, $lte: end };
	}

	if (params.search !== undefined && params.search.trim() !== "") {
		const raw = params.search.trim();
		const escaped = escapeRegexLiteral(raw);

		filter.$or = [
			{ "actor.name": { $regex: escaped, $options: "i" } },
			{ "actor.email": { $regex: escaped, $options: "i" } },
			{ details: { $regex: escaped, $options: "i" } },
			{
				$expr: {
					$regexMatch: {
						input: {
							$concat: [
								{ $toString: { $ifNull: ["$oldValue", ""] } },
								" ",
								{ $toString: { $ifNull: ["$newValue", ""] } },
							],
						},
						regex: escaped,
						options: "i",
					},
				},
			},
		];
	}

	return filter;
}

/**
 * Ambil daftar audit log dengan filter opsional + pagination.
 * Semua filter string bersifat case-insensitive sesui requirement.
 */
export async function getAuditLogs(
	db: Db,
	params: AuditLogQueryParams = {},
): Promise<AuditLogListResult> {
	const limit = Math.min(Math.max(params.limit ?? 50, 1), 200);
	const page = Math.max(params.page ?? 1, 1);
	const skip = (page - 1) * limit;

	const filter = buildAuditLogFilter(params);
	const col = db.collection(COLLECTION);

	const [docs, total] = await Promise.all([
		col
			.find(filter as never)
			.sort({ createdAt: -1 })
			.skip(skip)
			.limit(limit)
			.toArray(),
		col.countDocuments(filter as never),
	]);

	const logs = docs.map((d) => serializeAuditDoc(d as Record<string, unknown>));

	return {
		logs,
		pagination: {
			page,
			limit,
			total,
			totalPages: Math.ceil(total / limit) || 0,
		},
	};
}
