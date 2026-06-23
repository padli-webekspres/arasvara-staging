import { Db, ObjectId } from "mongodb";
import {
	User,
	AvatarUser,
	GetAllUsersParams,
	GetAllUsersResult,
	UserProfile,
} from "@/types/user";
import type { AuditLogActor } from "@/types/auditLog";
import { ROLES } from "@/lib/auth-client";
import { s3Client } from "@/lib/s3";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";
import logger from "@/lib/logger";
import { createAuditLog, requireAuditActor } from "@/services/auditLogService";
import { AuditLogAction } from "@/types/auditLog";
import {
	buildActiveUserFilter,
	isUserPubliclyVisible,
	nameNormalizedForStorage,
} from "@/lib/user-validation";
import {
	assertUniqueUserName,
	resolveUniqueUserSlug,
} from "@/lib/user-validation.server";
const S3_BUCKET_AVATAR = process.env.S3_BUCKET_AVATAR || "arasvara-avatar";

async function syncArticleAuthorDenorm(
	db: Db,
	authorId: ObjectId,
	payload: { name: string; slug?: string },
): Promise<void> {
	const $set: Record<string, string> = {
		"author.name": payload.name,
	};
	if (payload.slug) {
		$set["author.slug"] = payload.slug;
	}
	await db.collection("articles").updateMany({ authorId }, { $set });
}

async function assignUserIdentityFields(
	db: Db,
	name: string,
	excludeId?: string,
): Promise<{ name: string; nameNormalized: string; slug: string }> {
	const trimmed = name.trim();
	if (!trimmed) {
		throw Object.assign(new Error("Nama wajib diisi"), { status: 400 });
	}
	const nameNormalized = nameNormalizedForStorage(trimmed);
	if (!nameNormalized) {
		throw Object.assign(new Error("Nama wajib diisi"), { status: 400 });
	}
	await assertUniqueUserName(db, trimmed, excludeId);
	const slug = await resolveUniqueUserSlug(db, trimmed, excludeId);
	return { name: trimmed, nameNormalized, slug };
}

function attachTeamToUser(
	user: User,
	doc: Record<string, unknown>,
): User {
	if (doc.teamData && typeof doc.teamData === "object") {
		const teamData = doc.teamData as Record<string, unknown>;
		user.team = {
			_id:
				typeof teamData._id === "string"
					? teamData._id
					: (teamData._id?.toString?.() ?? ""),
			name: String(teamData.name || ""),
			slug: String(teamData.slug || ""),
			description: teamData.description
				? String(teamData.description)
				: undefined,
			createdAt:
				teamData.createdAt instanceof Date
					? teamData.createdAt
					: new Date(String(teamData.createdAt || "")),
			updatedAt:
				teamData.updatedAt instanceof Date
					? teamData.updatedAt
					: new Date(String(teamData.updatedAt || "")),
		};
	} else if (doc.teamId) {
		user.team = {
			_id:
				typeof doc.teamId === "string"
					? doc.teamId
					: (doc.teamId?.toString?.() ?? ""),
			name: "",
			slug: "",
			description: undefined,
		};
	}
	return user;
}

async function findUserDocWithTeam(
	db: Db,
	match: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
	const doc = await db
		.collection("users")
		.aggregate([
			{ $match: match },
			{
				$lookup: {
					from: "teams",
					localField: "teamId",
					foreignField: "_id",
					as: "teamData",
				},
			},
			{
				$unwind: {
					path: "$teamData",
					preserveNullAndEmptyArrays: true,
				},
			},
		])
		.next();
	return doc ?? null;
}

function userDocAuditSnapshot(doc: Record<string, unknown>) {
	const teamIdRaw = doc.teamId;
	const teamIdStr =
		teamIdRaw != null && teamIdRaw !== ""
			? typeof teamIdRaw === "object" &&
				teamIdRaw !== null &&
				"toString" in teamIdRaw
				? (teamIdRaw as ObjectId).toString()
				: String(teamIdRaw)
			: null;
	return {
		name: doc.name,
		email: doc.email,
		role: doc.role,
		slug: doc.slug,
		nameNormalized: doc.nameNormalized,
		bio: doc.bio,
		isActive: doc.isActive,
		teamId: teamIdStr,
		hasAvatar: !!(doc.avatar && typeof doc.avatar === "object"),
	};
}

// Helper: upload avatar image, compress, validate, return AvatarUser object
export async function uploadAvatar(
	file: File,
): Promise<Omit<AvatarUser, "_id">> {
	if (!file || !file.type?.startsWith("image/")) {
		throw new Error("Only image files are allowed for avatar");
	}
	try {
		const sharp = (await import("sharp")).default;
		const arrayBuffer = await file.arrayBuffer();
		let buffer: Buffer = Buffer.from(arrayBuffer as ArrayBuffer);
		buffer = await sharp(buffer)
			.resize(800, 800, { fit: "cover" })
			.webp({ quality: 85 })
			.toBuffer();
		const uniqueName = uuidv4().replace(/-/g, "");
		const filename = `${uniqueName}.webp`;
		const mimetype = "image/webp";
		const size = buffer.length;
		const now = new Date().toISOString();
		await s3Client.send(
			new PutObjectCommand({
				Bucket: S3_BUCKET_AVATAR,
				Key: filename,
				Body: buffer,
				ContentType: mimetype,
			}),
		);
		logger.info({ filename, size }, "uploadAvatar: avatar terunggah ke S3");
		return {
			url: `/api/media/avatar/view?key=${filename}`,
			filename,
			mimetype,
			size,
			createdAt: now,
			updatedAt: now,
		};
	} catch (err) {
		logger.error({ err }, "uploadAvatar gagal");
		throw err;
	}
}
// Service: create user with avatar upload, email unique, password hash
export async function createUser(
	db: Db,
	payload: Omit<
		User,
		| "_id"
		| "createdAt"
		| "updatedAt"
		| "deletedAt"
		| "avatar"
		| "teamId"
		| "slug"
		| "nameNormalized"
	> & { password: string; avatar?: File | null; teamId?: string },
	actor: AuditLogActor,
): Promise<User> {
	logger.info({ email: payload.email }, "createUser dimulai");
	try {
		const auditActor = requireAuditActor(actor);

		const exists = await db
			.collection("users")
			.findOne({ email: payload.email });
		if (exists) throw new Error("Email already exists");

		const hashedPassword = await bcrypt.hash(payload.password, 12);

		const identity = await assignUserIdentityFields(db, payload.name);

		let avatarObj: AvatarUser | undefined = undefined;
		if (payload.avatar) {
			const avatar = await uploadAvatar(payload.avatar);
			avatarObj = {
				_id: new ObjectId().toString(),
				...avatar,
			};
		}

		const now = new Date().toISOString();
		const userDoc: Omit<User, "_id"> = {
			email: payload.email,
			password: hashedPassword,
			name: identity.name,
			nameNormalized: identity.nameNormalized,
			slug: identity.slug,
			role: payload.role || "subscriber",
			avatar: avatarObj,
			bio: payload.bio,
			isActive: payload.isActive ?? true,
			createdAt: now,
			updatedAt: now,
			deletedAt: null,
		};

		if (payload.teamId && ObjectId.isValid(payload.teamId)) {
			(userDoc as Record<string, unknown>).teamId = new ObjectId(
				payload.teamId,
			);
		}

		const result = await db.collection("users").insertOne(userDoc);
		const entityId = result.insertedId.toString();

		const response: User = {
			_id: entityId,
			...userDoc,
			password: undefined,
		};

		try {
			await createAuditLog(db, {
				actor: auditActor,
				action: AuditLogAction.CREATE,
				entity: "USER",
				entityId,
				details: `Membuat pengguna: ${payload.email} (${identity.name})`,
				newValue: userDocAuditSnapshot({
					...userDoc,
					_id: result.insertedId,
				} as Record<string, unknown>),
			});
		} catch (auditErr) {
			logger.error(
				{ err: auditErr, entityId },
				"createAuditLog gagal setelah createUser",
			);
		}

		logger.info({ entityId }, "createUser selesai");
		return response;
	} catch (err) {
		logger.error({ err, email: payload.email }, "createUser gagal");
		throw err;
	}
}
// Soft delete user & remove avatar from S3
export async function softDeleteUser(
	db: Db,
	idOrEmail: string,
	actor: AuditLogActor,
): Promise<boolean> {
	logger.info({ idOrEmail }, "softDeleteUser dimulai");
	try {
		const auditActor = requireAuditActor(actor);

		const query: Record<string, unknown> = { deletedAt: { $in: [null, ""] } };
		if (ObjectId.isValid(idOrEmail)) {
			query._id = new ObjectId(idOrEmail);
		} else {
			query.email = idOrEmail;
		}
		const user = await db.collection("users").findOne(query);
		if (!user) {
			logger.warn({ idOrEmail }, "softDeleteUser: user tidak ditemukan");
			return false;
		}

		const entityId = user._id.toString();
		const oldValue = userDocAuditSnapshot(user as Record<string, unknown>);

		if (
			user.avatar &&
			typeof user.avatar === "object" &&
			user.avatar.filename
		) {
			try {
				await s3Client.send(
					new (await import("@aws-sdk/client-s3")).DeleteObjectCommand({
						Bucket: S3_BUCKET_AVATAR,
						Key: user.avatar.filename,
					}),
				);
				logger.info(
					{ filename: user.avatar.filename },
					"softDeleteUser: avatar dihapus dari S3",
				);
			} catch (avatarErr) {
				logger.warn(
					{ err: avatarErr, filename: user.avatar.filename },
					"softDeleteUser: gagal hapus avatar dari S3, lanjut soft delete",
				);
			}
		}

		const now = new Date().toISOString();
		await db
			.collection("users")
			.updateOne({ _id: user._id }, { $set: { deletedAt: now } });

		try {
			await createAuditLog(db, {
				actor: auditActor,
				action: AuditLogAction.DELETE,
				entity: "USER",
				entityId,
				details: `Soft delete pengguna: ${String(user.email)}`,
				oldValue,
			});
		} catch (auditErr) {
			logger.error(
				{ err: auditErr, entityId },
				"createAuditLog gagal setelah softDeleteUser",
			);
		}

		logger.info({ entityId }, "softDeleteUser selesai");
		return true;
	} catch (err) {
		logger.error({ err, idOrEmail }, "softDeleteUser gagal");
		throw err;
	}
}

function mapDocToUser(doc: Record<string, unknown>): User {
	// Safely cast and extract fields from doc
	let avatar: string | AvatarUser | undefined = undefined;
	if (doc.avatar && typeof doc.avatar === "object" && "url" in doc.avatar) {
		const av = doc.avatar as Record<string, unknown>;
		avatar = {
			_id: typeof av._id === "string" ? av._id : (av._id?.toString?.() ?? ""),
			url: String(av.url),
			filename: String(av.filename),
			mimetype: String(av.mimetype),
			size: Number(av.size),
			createdAt: String(av.createdAt),
			updatedAt: String(av.updatedAt),
		};
	} else if (typeof doc.avatar === "string") {
		avatar = doc.avatar;
	}
	return {
		_id: typeof doc._id === "string" ? doc._id : (doc._id?.toString?.() ?? ""),
		email: String(doc.email),
		name: String(doc.name),
		slug:
			doc.slug !== undefined && doc.slug !== null && doc.slug !== ""
				? String(doc.slug)
				: undefined,
		nameNormalized:
			doc.nameNormalized !== undefined &&
			doc.nameNormalized !== null &&
			doc.nameNormalized !== ""
				? String(doc.nameNormalized)
				: undefined,
		role: doc.role as keyof typeof ROLES,
		avatar,
		bio: doc.bio !== undefined ? String(doc.bio) : undefined,
		isActive: doc.isActive !== undefined ? Boolean(doc.isActive) : undefined,
		createdAt:
			doc.createdAt instanceof Date
				? doc.createdAt
				: doc.createdAt !== undefined
					? String(doc.createdAt)
					: undefined,
		updatedAt:
			doc.updatedAt instanceof Date
				? doc.updatedAt
				: doc.updatedAt !== undefined
					? String(doc.updatedAt)
					: undefined,
		deletedAt:
			doc.deletedAt !== undefined &&
			doc.deletedAt !== null &&
			doc.deletedAt !== ""
				? String(doc.deletedAt)
				: null,
	};
}

export async function getAllUsers(
	db: Db,
	params: GetAllUsersParams = {},
): Promise<GetAllUsersResult> {
	const { limit = 10, page = 1, role, search, cursor, team } = params;

	// Only show users that are not soft-deleted
	const query: Record<string, unknown> = { deletedAt: { $in: [null, ""] } };
	if (role) query.role = role;
	if (search) {
		const regex = new RegExp(search, "i");
		query.$or = [{ name: { $regex: regex } }, { email: { $regex: regex } }];
	}
	if (cursor) {
		query._id = { $lt: cursor };
	}
	if (team && typeof team === "string") {
		const teamObjectId = ObjectId.isValid(team) ? new ObjectId(team) : team;
		query.teamId = teamObjectId;
	}

	// For total count (for page/limit pagination)
	const total = await db.collection("users").countDocuments(query);

	const pipeline: Record<string, unknown>[] = [
		{ $match: query },
		{ $sort: { createdAt: -1, _id: -1 } },
	];

	// Add $lookup to join with teams collection
	pipeline.push(
		{
			$lookup: {
				from: "teams",
				localField: "teamId",
				foreignField: "_id",
				as: "teamData",
			},
		},
		{
			$unwind: {
				path: "$teamData",
				preserveNullAndEmptyArrays: true,
			},
		},
	);

	// Pagination: cursor-based or page/limit
	if (cursor) {
		pipeline.push({ $limit: limit });
	} else {
		pipeline.push({ $skip: (page - 1) * limit }, { $limit: limit });
	}

	let docs: Record<string, unknown>[] = [];
	try {
		docs = await db.collection("users").aggregate(pipeline).toArray();
		if (!docs || docs.length === 0) {
			return { users: [], nextCursor: null, total };
		}
	} catch (error) {
		throw error;
	}

	const users: User[] = docs.map((doc) => {
		const user = mapDocToUser(doc);
		// Selalu populate team jika ada teamId
		if (doc.teamData && typeof doc.teamData === "object") {
			const teamData = doc.teamData as Record<string, unknown>;
			user.team = {
				_id:
					typeof teamData._id === "string"
						? teamData._id
						: (teamData._id?.toString?.() ?? ""),
				name: String(teamData.name || ""),
				slug: String(teamData.slug || ""),
				description: teamData.description
					? String(teamData.description)
					: undefined,
				createdAt:
					teamData.createdAt instanceof Date
						? teamData.createdAt
						: new Date(String(teamData.createdAt || "")),
				updatedAt:
					teamData.updatedAt instanceof Date
						? teamData.updatedAt
						: new Date(String(teamData.updatedAt || "")),
			};
		} else if (doc.teamId) {
			// Jika ada teamId tapi tidak ada teamData (team sudah dihapus?), populate minimal _id
			user.team = {
				_id:
					typeof doc.teamId === "string"
						? doc.teamId
						: (doc.teamId?.toString?.() ?? ""),
				name: "",
				slug: "",
				description: undefined,
				createdAt: undefined,
				updatedAt: undefined,
			};
		}
		return user;
	});

	const last = users[users.length - 1];
	const nextCursor = last && last._id ? last._id : null;

	return { users, nextCursor, total };
}

function escapeRegexLiteral(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function findActiveUserDocBySlug(
	db: Db,
	slug: string,
): Promise<Record<string, unknown> | null> {
	const trimmed = slug.trim().toLowerCase();
	if (!trimmed) return null;

	const exact = await db.collection("users").findOne({
		slug: trimmed,
		...buildActiveUserFilter(),
	});
	if (exact && isUserPubliclyVisible(exact as Record<string, unknown>)) {
		return exact as Record<string, unknown>;
	}

	const insensitive = await db
		.collection("users")
		.findOne({
			slug: {
				$regex: `^${escapeRegexLiteral(trimmed)}$`,
				$options: "i",
			},
			...buildActiveUserFilter(),
		});
	if (insensitive && isUserPubliclyVisible(insensitive as Record<string, unknown>)) {
		return insensitive as Record<string, unknown>;
	}

	return null;
}

export async function getUserBySlug(
	db: Db,
	slug: string,
): Promise<User | null> {
	const trimmed = slug?.trim().toLowerCase();
	if (!trimmed) return null;

	const baseDoc = await findActiveUserDocBySlug(db, trimmed);
	if (!baseDoc) return null;

	const user = mapDocToUser(baseDoc);
	if (!user.slug) {
		user.slug = trimmed;
	}
	return user;
}

/** Lookup penulis untuk halaman publik /author/{slug}. */
export async function getPublicAuthorBySlug(
	db: Db,
	slug: string,
): Promise<User | null> {
	return getUserBySlug(db, slug);
}

export async function getUserByIdEmailOrSlug(
	db: Db,
	key: string,
): Promise<User | null> {
	if (!key) return null;

	let match: Record<string, unknown>;
	if (ObjectId.isValid(key)) {
		match = { ...buildActiveUserFilter(), _id: new ObjectId(key) };
	} else if (key.includes("@")) {
		match = { ...buildActiveUserFilter(), email: key };
	} else {
		match = { ...buildActiveUserFilter(), slug: key.trim().toLowerCase() };
	}

	const doc = await findUserDocWithTeam(db, match);
	if (!doc) return null;

	const user = mapDocToUser(doc);
	return attachTeamToUser(user, doc);
}

/** @deprecated Gunakan getUserByIdEmailOrSlug — alias kompatibilitas */
export async function getUserByIdOrEmail(
	db: Db,
	idOrEmail: string,
): Promise<User | null> {
	return getUserByIdEmailOrSlug(db, idOrEmail);
}

/**
 * Edit user fields except password. Handles avatar upload, email uniqueness, and updates updatedAt.
 * @param db MongoDB Db instance
 * @param idOrEmail User's id or email
 * @param payload Fields to update (name, email, role, bio, isActive, avatar)
 * @returns Updated user (without password)
 */
/**
 * Edit user fields except email and password. Handles avatar upload, and updates updatedAt.
 * @param db MongoDB Db instance
 * @param idOrEmail User's id or email
 * @param payload Fields to update (name, role, bio, isActive, avatar)
 * @returns Updated user (without password)
 */
/**
 * Edit user fields except email and password. Handles avatar upload, teamId, and updates updatedAt.
 * @param db MongoDB Db instance
 * @param idOrEmail User's id or email
 * @param payload Fields to update (name, role, bio, isActive, avatar, teamId)
 * @param allowIsActiveEdit Allow editing isActive (not allowed for self)
 * @returns Updated user (without password)
 */
export async function editUser(
	db: Db,
	idOrEmail: string,
	payload: {
		name?: string;
		role?: string;
		bio?: string;
		isActive?: boolean;
		avatar?: File | null;
		teamId?: string;
	},
	allowIsActiveEdit: boolean,
	actor: AuditLogActor,
): Promise<User> {
	logger.info({ idOrEmail }, "editUser dimulai");
	try {
		const auditActor = requireAuditActor(actor);

		let match: Record<string, unknown>;
		if (ObjectId.isValid(idOrEmail)) {
			match = { ...buildActiveUserFilter(), _id: new ObjectId(idOrEmail) };
		} else if (idOrEmail.includes("@")) {
			match = { ...buildActiveUserFilter(), email: idOrEmail };
		} else {
			match = { ...buildActiveUserFilter(), slug: idOrEmail.trim().toLowerCase() };
		}
		const user = await db.collection("users").findOne(match);
		if (!user) throw new Error("User not found");

		const oldValue = userDocAuditSnapshot(user as Record<string, unknown>);
		const entityId = user._id.toString();

		let avatarObj: AvatarUser | undefined = user.avatar;
		if (payload.avatar) {
			const avatar = await uploadAvatar(payload.avatar);
			avatarObj = {
				_id: new ObjectId().toString(),
				...avatar,
			};
		}

		const updateFields: Partial<
			Omit<
				User,
				"_id" | "password" | "createdAt" | "deletedAt" | "email" | "role"
			>
		> & {
			updatedAt: string;
			avatar?: AvatarUser | undefined;
			role: keyof typeof ROLES;
		} = {
			updatedAt: new Date().toISOString(),
			role: user.role,
		};

		const existingName = String(user.name ?? "");
		const nameChanged =
			payload.name !== undefined &&
			payload.name.trim() !== existingName.trim();
		const needsIdentityBackfill = !user.slug || !user.nameNormalized;

		if (nameChanged) {
			const identity = await assignUserIdentityFields(
				db,
				payload.name!,
				entityId,
			);
			updateFields.name = identity.name;
			updateFields.nameNormalized = identity.nameNormalized;
			updateFields.slug = identity.slug;
		} else if (needsIdentityBackfill) {
			const identity = await assignUserIdentityFields(
				db,
				existingName,
				entityId,
			);
			updateFields.nameNormalized = identity.nameNormalized;
			updateFields.slug = identity.slug;
		}

		if (payload.bio !== undefined) updateFields.bio = payload.bio;
		if (allowIsActiveEdit && payload.isActive !== undefined) {
			updateFields.isActive = payload.isActive;
		}
		if (payload.avatar !== undefined) updateFields.avatar = avatarObj;

		const updateQuery: Record<string, unknown> = { $set: { ...updateFields } };
		if (payload.teamId !== undefined) {
			if (payload.teamId && ObjectId.isValid(payload.teamId)) {
				(updateQuery.$set as Record<string, unknown>).teamId = new ObjectId(
					payload.teamId,
				);
				if (updateQuery.$unset) delete updateQuery.$unset;
			} else {
				updateQuery.$unset = { teamId: "" };
				if ((updateQuery.$set as Record<string, unknown>).teamId)
					delete (updateQuery.$set as Record<string, unknown>).teamId;
			}
		}

		await db.collection("users").updateOne({ _id: user._id }, updateQuery);

		const updated = await db.collection("users").findOne({ _id: user._id });
		if (!updated) throw new Error("Failed to fetch updated user");

		const mapped = mapDocToUser(updated);

		const oldSlug = user.slug ? String(user.slug) : undefined;
		const identityChanged =
			nameChanged ||
			needsIdentityBackfill ||
			mapped.name !== existingName ||
			mapped.slug !== oldSlug;

		if (identityChanged && mapped.slug) {
			await syncArticleAuthorDenorm(db, user._id as ObjectId, {
				name: mapped.name,
				slug: mapped.slug,
			});
		}

		try {
			await createAuditLog(db, {
				actor: auditActor,
				action: AuditLogAction.UPDATE,
				entity: "USER",
				entityId,
				details: `Memperbarui pengguna: ${String(updated.email)}`,
				oldValue,
				newValue: userDocAuditSnapshot(updated as Record<string, unknown>),
			});
		} catch (auditErr) {
			logger.error(
				{ err: auditErr, entityId },
				"createAuditLog gagal setelah editUser",
			);
		}

		logger.info({ entityId }, "editUser selesai");
		return mapped;
	} catch (err) {
		logger.error({ err, idOrEmail }, "editUser gagal");
		throw err;
	}
}

/**
 * Get all authors (writer, reporter, contributor, editor) with pagination, search, and sorting by name.
 * @param db MongoDB Db instance
 * @param params limit, page, cursor, search
 * @returns { users: UserProfile[], nextCursor, total }
 */
export async function getAllAuthors(
	db: Db,
	params: {
		limit?: number;
		page?: number;
		cursor?: string;
		search?: string;
	} = {},
): Promise<{ users: UserProfile[]; nextCursor: string | null; total: number }> {
	// Roles yang dianggap author
	const AUTHOR_ROLES = ["writer", "reporter", "contributor", "editor"];
	const { limit = 10, page = 1, cursor, search } = params;

	// Query hanya user aktif, tidak soft delete, dan role author
	const query: Record<string, unknown> = {
		deletedAt: { $in: [null, ""] },
		role: { $in: AUTHOR_ROLES },
	};
	if (search) {
		const regex = new RegExp(search, "i");
		query.$or = [{ name: { $regex: regex } }, { email: { $regex: regex } }];
	}
	if (cursor) {
		query._id = { $lt: cursor };
	}

	// Total count untuk pagination
	const total = await db.collection("users").countDocuments(query);

	// Pipeline agregasi: filter, join team, sort by name (case-insensitive), pagination
	const pipeline: Record<string, unknown>[] = [
		{ $match: query },
		// Sort by name (case-insensitive)
		{
			$addFields: {
				nameLower: { $toLower: "$name" },
			},
		},
		{ $sort: { nameLower: 1, _id: -1 } },
		{
			$lookup: {
				from: "teams",
				localField: "teamId",
				foreignField: "_id",
				as: "teamData",
			},
		},
		{
			$unwind: {
				path: "$teamData",
				preserveNullAndEmptyArrays: true,
			},
		},
	];

	// Pagination: cursor-based atau page/limit
	if (cursor) {
		pipeline.push({ $limit: limit });
	} else {
		pipeline.push({ $skip: (page - 1) * limit }, { $limit: limit });
	}

	// Ambil data
	let docs: Record<string, any>[] = [];
	try {
		docs = await db.collection("users").aggregate(pipeline).toArray();
	} catch (error) {
		docs = [];
	}

	// Map ke UserProfile
	const users: UserProfile[] = docs.map((doc) => {
		let avatar: string | AvatarUser | undefined = undefined;
		if (doc.avatar && typeof doc.avatar === "object" && "url" in doc.avatar) {
			const av = doc.avatar as Record<string, unknown>;
			avatar = {
				_id: typeof av._id === "string" ? av._id : (av._id?.toString?.() ?? ""),
				url: String(av.url),
				filename: String(av.filename),
				mimetype: String(av.mimetype),
				size: Number(av.size),
				createdAt: String(av.createdAt),
				updatedAt: String(av.updatedAt),
			};
		} else if (typeof doc.avatar === "string") {
			avatar = doc.avatar;
		}
		return {
			_id:
				typeof doc._id === "string" ? doc._id : (doc._id?.toString?.() ?? ""),
			name: String(doc.name),
			slug:
				doc.slug !== undefined && doc.slug !== null && doc.slug !== ""
					? String(doc.slug)
					: undefined,
			nameNormalized:
				doc.nameNormalized !== undefined &&
				doc.nameNormalized !== null &&
				doc.nameNormalized !== ""
					? String(doc.nameNormalized)
					: undefined,
			email: String(doc.email),
			avatar,
			role: doc.role,
			teamId: doc.teamId,
			team: doc.teamData,
		};
	});

	const last = users[users.length - 1];
	const nextCursor = last && last._id ? last._id : null;

	return { users, nextCursor, total };
}
