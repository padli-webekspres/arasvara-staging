import { Db, ObjectId } from "mongodb";
import type { Team } from "@/types/team";

interface CreateTeamPayload {
	name: string;
	description?: string;
}

interface UpdateTeamPayload {
	name?: string;
	description?: string;
}

/**
 * Generate slug dari nama: convert ke lowercase, ganti spasi dengan hyphen, hapus karakter spesial
 * @param name Nama tim
 * @returns Generated slug
 */
function generateSlug(name: string): string {
	return name
		.toLowerCase()
		.trim()
		.replace(/\s+/g, "-")
		.replace(/[^\w-]/g, "");
}

// get all teams

/**
 * Membuat tim baru dengan slug otomatis dari nama.
 * @param db MongoDB Db instance
 * @param payload Data tim yang akan dibuat
 * @returns Tim baru
 */
export async function createTeam(
	db: Db,
	payload: CreateTeamPayload,
): Promise<Team> {
	// Validasi input
	if (
		!payload.name ||
		typeof payload.name !== "string" ||
		!payload.name.trim()
	) {
		const err = new Error("Nama tim wajib diisi.") as Error & {
			status?: number;
		};
		err.status = 400;
		throw err;
	}

	const trimmedName = payload.name.trim();
	const generatedSlug = generateSlug(trimmedName);

	// Cek duplikasi name atau slug
	const existing = await db.collection("teams").findOne({
		$or: [{ name: trimmedName }, { slug: generatedSlug }],
	});
	if (existing) {
		const err = new Error("Nama atau slug tim sudah digunakan.") as Error & {
			status?: number;
		};
		err.status = 409;
		throw err;
	}

	const now = new Date();
	const doc = {
		name: trimmedName,
		slug: generatedSlug,
		description: payload.description?.trim() || undefined,
		createdAt: now,
		updatedAt: now,
	};

	const result = await db.collection("teams").insertOne(doc);

	return {
		_id: result.insertedId.toString(),
		name: doc.name,
		slug: doc.slug,
		description: doc.description,
		createdAt: doc.createdAt,
		updatedAt: doc.updatedAt,
	};
}

/**
 * Update tim berdasarkan ID. Name dan slug diperbarui bersama (slug auto-generated dari name).
 * @param db MongoDB Db instance
 * @param teamId ID tim yang akan diupdate
 * @param payload Data yang ingin diupdate
 * @returns Tim yang sudah diupdate
 */
export async function updateTeam(
	db: Db,
	teamId: string,
	payload: UpdateTeamPayload,
): Promise<Team> {
	// Validasi teamId
	if (!ObjectId.isValid(teamId)) {
		const err = new Error("ID tim tidak valid.") as Error & {
			status?: number;
		};
		err.status = 400;
		throw err;
	}

	// Ambil tim yang ada
	const existing = await db
		.collection("teams")
		.findOne({ _id: new ObjectId(teamId) });
	if (!existing) {
		const err = new Error("Tim tidak ditemukan.") as Error & {
			status?: number;
		};
		err.status = 404;
		throw err;
	}

	// Jika tidak ada perubahan, return tim yang sekarang
	if (!payload.name && payload.description === existing.description) {
		return {
			_id: existing._id.toString(),
			name: existing.name,
			slug: existing.slug,
			description: existing.description,
			createdAt: existing.createdAt,
			updatedAt: existing.updatedAt,
		};
	}

	const updateData: Record<string, unknown> = {
		updatedAt: new Date(),
	};

	// Update name dan slug jika name berubah
	if (payload.name && typeof payload.name === "string") {
		const trimmedName = payload.name.trim();
		if (trimmedName !== existing.name) {
			// Cek duplikasi nama baru
			const duplicate = await db
				.collection("teams")
				.findOne({ name: trimmedName, _id: { $ne: new ObjectId(teamId) } });
			if (duplicate) {
				const err = new Error("Nama tim sudah digunakan.") as Error & {
					status?: number;
				};
				err.status = 409;
				throw err;
			}
			updateData.name = trimmedName;
			updateData.slug = generateSlug(trimmedName);
		}
	}

	// Update description
	if (payload.description !== undefined) {
		updateData.description = payload.description?.trim() || undefined;
	}

	// Update di database
	await db
		.collection("teams")
		.updateOne({ _id: new ObjectId(teamId) }, { $set: updateData });

	// Ambil tim yang sudah diupdate
	const updated = await db
		.collection("teams")
		.findOne({ _id: new ObjectId(teamId) });

	return {
		_id: updated!._id.toString(),
		name: updated!.name,
		slug: updated!.slug,
		description: updated!.description,
		createdAt: updated!.createdAt,
		updatedAt: updated!.updatedAt,
	};
}

/**
 * Hapus tim berdasarkan ID. Cek apakah ada users yang tertaut ke tim ini.
 * @param db MongoDB Db instance
 * @param teamId ID tim yang akan dihapus
 */
export async function deleteTeam(db: Db, teamId: string): Promise<void> {
	// Validasi teamId
	if (!ObjectId.isValid(teamId)) {
		const err = new Error("ID tim tidak valid.") as Error & {
			status?: number;
		};
		err.status = 400;
		throw err;
	}

	// Cek apakah tim ada
	const existing = await db
		.collection("teams")
		.findOne({ _id: new ObjectId(teamId) });
	if (!existing) {
		const err = new Error("Tim tidak ditemukan.") as Error & {
			status?: number;
		};
		err.status = 404;
		throw err;
	}

	// Cek apakah ada users yang memiliki teamId ini
	const userWithTeam = await db
		.collection("users")
		.findOne({ teamId: new ObjectId(teamId) });
	if (userWithTeam) {
		const err = new Error(
			"Tidak dapat menghapus tim karena masih ada user yang tertaut.",
		) as Error & { status?: number };
		err.status = 409;
		throw err;
	}

	// Hapus tim dari database
	await db.collection("teams").deleteOne({ _id: new ObjectId(teamId) });
}

import type { User, UserProfile } from "@/types/user";

/**
 * Ambil daftar user berdasarkan teamId dengan dukungan pagination (page/limit) dan cursor.
 * @param db MongoDB Db instance
 * @param teamId ID tim
 * @param options Pagination options: { page, limit, cursor, search }
 * @returns { users: User[], nextCursor: string | null, total?: number }
 */
export async function getUsersByTeam(
	db: Db,
	teamId: string,
	options?: {
		page?: number;
		limit?: number;
		cursor?: string;
		search?: string;
	},
): Promise<{ users: User[]; nextCursor: string | null; total?: number }> {
	if (!ObjectId.isValid(teamId)) {
		const err = new Error("ID tim tidak valid.") as Error & { status?: number };
		err.status = 400;
		throw err;
	}

	const limit = Math.max(1, Math.min(Number(options?.limit) || 10, 100));
	const page = Math.max(1, Number(options?.page) || 1);
	// Use Record<string, unknown> to allow MongoDB operators like $or and _id
	const query: Record<string, unknown> = { teamId: new ObjectId(teamId) };

	// Optional search by name or email
	if (options?.search) {
		(query as Record<string, unknown>).$or = [
			{ name: { $regex: options.search, $options: "i" } },
			{ email: { $regex: options.search, $options: "i" } },
		];
	}

	let users: User[] = [];
	let nextCursor: string | null = null;
	let total: number | undefined = undefined;

	// Helper to map MongoDB user doc to User type, with type-safe property access
	function mapUser(u: unknown): UserProfile {
		const user = u as Record<string, unknown>;
		return {
			_id:
				user._id && typeof user._id === "object" && "toString" in user._id
					? (user._id as { toString(): string }).toString()
					: String(user._id ?? ""),
			email: typeof user.email === "string" ? user.email : "",
			name: typeof user.name === "string" ? user.name : "",
			role: user.role as User["role"],
			teamId:
				user.teamId &&
				typeof user.teamId === "object" &&
				"toString" in user.teamId
					? (user.teamId as { toString(): string }).toString()
					: (user.teamId as string | undefined),
			avatar: user.avatar as User["avatar"],
			team: user.team as User["team"],
		};
	}

	if (options?.cursor) {
		// Cursor-based pagination
		(query as unknown as { [key: string]: unknown })._id = {
			$gt: new ObjectId(options.cursor),
		};
		const cursorDocs = (await db
			.collection("users")
			.find(query)
			.sort({ _id: 1 })
			.limit(limit + 1)
			.toArray()) as unknown[];
		users = cursorDocs.slice(0, limit).map(mapUser);
		if (cursorDocs.length > limit) {
			nextCursor =
				(cursorDocs[limit] as Record<string, unknown>)._id?.toString?.() ??
				String((cursorDocs[limit] as Record<string, unknown>)._id ?? "");
		}
	} else {
		// Page-based pagination
		total = await db.collection("users").countDocuments(query);
		const skip = (page - 1) * limit;
		const docs = (await db
			.collection("users")
			.find(query)
			.sort({ createdAt: -1 })
			.skip(skip)
			.limit(limit)
			.toArray()) as unknown[];
		users = docs.map(mapUser);
		nextCursor = null;
	}

	return { users, nextCursor, total };
}

/**
 * Ambil daftar tim dengan dukungan pagination (page/limit) dan cursor, serta fuzzy search pada nama.
 * @param db MongoDB Db instance
 * @param options Pagination dan search options: { page, limit, cursor, search }
 * @returns { teams: Team[], nextCursor: string | null, total?: number }
 */
export async function getTeams(
	db: Db,
	options?: {
		page?: number;
		limit?: number;
		cursor?: string;
		search?: string;
	},
): Promise<{ teams: Team[]; nextCursor: string | null; total?: number }> {
	const limit = Math.max(1, Math.min(Number(options?.limit) || 10, 100));
	const page = Math.max(1, Number(options?.page) || 1);
	const query: Record<string, unknown> = {};

	// Optional fuzzy search by name (case-insensitive regex matching)
	if (options?.search) {
		query.name = { $regex: options.search, $options: "i" };
	}

	let teams: Team[] = [];
	let nextCursor: string | null = null;
	let total: number | undefined = undefined;

	// Helper to map MongoDB team doc to Team type, with type-safe property access
	function mapTeam(doc: unknown): Team {
		const team = doc as Record<string, unknown>;
		return {
			_id:
				team._id && typeof team._id === "object" && "toString" in team._id
					? (team._id as { toString(): string }).toString()
					: String(team._id ?? ""),
			name: typeof team.name === "string" ? team.name : "",
			slug: typeof team.slug === "string" ? team.slug : "",
			description:
				typeof team.description === "string" ? team.description : undefined,
			createdAt: team.createdAt instanceof Date ? team.createdAt : new Date(),
			updatedAt: team.updatedAt instanceof Date ? team.updatedAt : new Date(),
		};
	}

	if (options?.cursor) {
		// Cursor-based pagination: fetch one more to check if there's a next page
		(query as unknown as { [key: string]: unknown })._id = {
			$gt: new ObjectId(options.cursor),
		};
		const cursorDocs = (await db
			.collection("teams")
			.find(query)
			.sort({ _id: 1 })
			.limit(limit + 1)
			.toArray()) as unknown[];
		teams = cursorDocs.slice(0, limit).map(mapTeam);
		if (cursorDocs.length > limit) {
			nextCursor =
				(cursorDocs[limit] as Record<string, unknown>)._id?.toString?.() ??
				String((cursorDocs[limit] as Record<string, unknown>)._id ?? "");
		}
	} else {
		// Page-based pagination
		total = await db.collection("teams").countDocuments(query);
		const skip = (page - 1) * limit;
		const docs = (await db
			.collection("teams")
			.find(query)
			.sort({ createdAt: -1 })
			.skip(skip)
			.limit(limit)
			.toArray()) as unknown[];
		teams = docs.map(mapTeam);
		nextCursor = null;
	}

	return { teams, nextCursor, total };
}
