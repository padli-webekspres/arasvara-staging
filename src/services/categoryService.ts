import { Db, ObjectId } from "mongodb";
import type {
	Category,
	CategoryWithParent,
	CategoryListResult,
} from "@/types/category";
import type { AuditLogActor } from "@/types/auditLog";
import { AuditLogAction } from "@/types/auditLog";
import slugify from "slugify";
import logger from "@/lib/logger";
import { createAuditLog, requireAuditActor } from "@/services/auditLogService";
import { normalizeFeaturedImage } from "@/lib/helper-article";
import { isReservedRootSegment } from "@/lib/article-public-path";
import type { ArticleListResponse } from "@/types/article";
import type { UserProfile } from "@/types/user";

const NICKNAME_MAX = 48;

/** Normalkan nickname untuk disimpan di DB (opsional); string kosong = tidak di-set di create. */
function normalizeNickname(value: unknown): string | undefined {
	if (value === undefined || value === null) return undefined;
	if (typeof value !== "string") {
		throw new Error("Nickname must be a string.");
	}
	const t = value.trim();
	if (!t) return undefined;
	if (t.length > NICKNAME_MAX) {
		throw new Error(`Nickname must be at most ${NICKNAME_MAX} characters.`);
	}
	return t;
}

/** Satu dokumen category dari Mongo → bentuk konsisten untuk response API */
export function serializeCategory(doc: Record<string, unknown>): Category {
	const parentIdRaw = doc.parentId;
	const nicknameRaw = doc.nickname;
	const nicknameStr =
		typeof nicknameRaw === "string" && nicknameRaw.trim()
			? nicknameRaw.trim()
			: undefined;

	const descRaw = doc.description;
	const orderRaw = doc.order;
	const featuredOrderRaw = doc.featuredOrder;

	return {
		_id: String(doc._id ?? ""),
		name: String(doc.name ?? ""),
		slug: String(doc.slug ?? ""),
		...(nicknameStr ? { nickname: nicknameStr } : {}),
		showOnNavbar: !!doc.showOnNavbar,
		featured: !!doc.featured,
		description: typeof descRaw === "string" ? descRaw : undefined,
		...(typeof orderRaw === "number" ? { order: orderRaw } : {}),
		...(typeof featuredOrderRaw === "number" ? { featuredOrder: featuredOrderRaw } : {}),
		parentId:
			parentIdRaw != null && parentIdRaw !== undefined
				? String(parentIdRaw)
				: undefined,
		createdAt:
			doc.createdAt instanceof Date
				? doc.createdAt
				: typeof doc.createdAt === "string"
					? doc.createdAt
					: undefined,
		updatedAt:
			doc.updatedAt instanceof Date
				? doc.updatedAt
				: typeof doc.updatedAt === "string"
					? doc.updatedAt
					: undefined,
	};
}

function validateCategoryInput({
	name,
	description,
}: {
	name: string;
	description: string;
}) {
	if (typeof name !== "string" || name.length < 3 || name.length > 32) {
		throw new Error("Name must be a string between 3 and 32 characters.");
	}
	if (
		typeof description !== "string" ||
		description.length < 10 ||
		description.length > 100
	) {
		throw new Error(
			"Description must be a string between 10 and 100 characters.",
		);
	}
}

/** Snapshot dokumen kategori untuk kolom audit (ringkas). */
function categoryDocAuditSnapshot(doc: Record<string, unknown>) {
	const nicknameRaw = doc.nickname;
	const nicknameStr =
		typeof nicknameRaw === "string" && nicknameRaw.trim()
			? nicknameRaw.trim()
			: undefined;
	const orderRaw = doc.order;
	const featuredOrderRaw = doc.featuredOrder;
	return {
		name: String(doc.name ?? ""),
		slug: String(doc.slug ?? ""),
		description:
			typeof doc.description === "string" ? doc.description : undefined,
		parentId:
			doc.parentId != null && doc.parentId !== "" ? String(doc.parentId) : null,
		...(nicknameStr ? { nickname: nicknameStr } : {}),
		showOnNavbar: !!doc.showOnNavbar,
		featured: !!doc.featured,
		...(typeof orderRaw === "number" ? { order: orderRaw } : {}),
		...(typeof featuredOrderRaw === "number" ? { featuredOrder: featuredOrderRaw } : {}),
	};
}

export async function createCategory(
	db: Db,
	{
		name,
		description,
		parentId,
		nickname,
		showOnNavbar,
		order,
	}: {
		name: string;
		description: string;
		parentId?: string;
		nickname?: string | null;
		showOnNavbar?: boolean;
		order?: number;
	},
	actor: AuditLogActor,
) {
	logger.info({ name }, "createCategory dimulai");
	try {
		const auditActor = requireAuditActor(actor);
		validateCategoryInput({ name, description });
		let trimmedNickname: string | undefined;
		try {
			trimmedNickname =
				nickname === undefined || nickname === null
					? undefined
					: normalizeNickname(nickname);
		} catch (msg: unknown) {
			const err: any = msg instanceof Error ? msg : new Error(String(msg));
			err.status = 400;
			throw err;
		}
		const slug = slugify(name, { lower: true, strict: true });
		if (isReservedRootSegment(slug)) {
			const err: any = new Error(
				`Category slug "${slug}" is a reserved root segment.`,
			);
			err.status = 400;
			throw err;
		}
		// Slug uniqueness check
		const slugExists = await db.collection("categories").findOne({ slug });
		if (slugExists) {
			const err: any = new Error("Category slug already exists.");
			err.status = 409;
			throw err;
		}
		// Convert parentId to ObjectId if provided, else null
		let mongoParentId: ObjectId | undefined = undefined;
		if (parentId) {
			try {
				mongoParentId = new ObjectId(parentId);
			} catch {
				const err: any = new Error("Invalid parentId format.");
				err.status = 400;
				throw err;
			}
			// Check parent exists
			if (mongoParentId instanceof ObjectId) {
				const parentExists = await db
					.collection("categories")
					.findOne({ _id: mongoParentId });
				if (!parentExists) {
					const err: any = new Error("Parent category not found.");
					err.status = 400;
					throw err;
				}
			}
		}
		const insertCategory: Record<string, unknown> = {
			name,
			slug,
			description,
			parentId: mongoParentId ?? null,
			showOnNavbar: !!showOnNavbar,
			createdAt: new Date(),
		};
		if (trimmedNickname) insertCategory.nickname = trimmedNickname;
		if (typeof order === "number") insertCategory.order = order;
		const result = await db
			.collection("categories")
			.insertOne(insertCategory as any);
		const saved = await db.collection("categories").findOne({
			_id: result.insertedId,
		});
		if (!saved) {
			throw new Error("Failed to read category after insert.");
		}

		try {
			await createAuditLog(db, {
				actor: auditActor,
				action: AuditLogAction.CREATE,
				entity: "CATEGORY",
				entityId: String(saved._id),
				details: `Kategori baru: ${name} (${slug})`,
				newValue: categoryDocAuditSnapshot(saved as Record<string, unknown>),
			});
		} catch (auditErr) {
			logger.error(
				{ err: auditErr, categoryId: String(saved._id) },
				"createAuditLog gagal setelah createCategory",
			);
		}

		logger.info({ categoryId: String(saved._id) }, "createCategory selesai");
		return serializeCategory(saved);
	} catch (err) {
		logger.error({ err, name }, "createCategory gagal");
		throw err;
	}
}

export async function updateCategory(
	db: Db,
	categoryId: string,
	{
		name,
		description,
		parentId,
		nickname,
		showOnNavbar,
		order,
	}: {
		name?: string;
		description?: string;
		parentId?: string | null;
		nickname?: string | null;
		showOnNavbar?: boolean;
		order?: number | null;
	},
	actor: AuditLogActor,
) {
	logger.info({ categoryId }, "updateCategory dimulai");
	try {
		const auditActor = requireAuditActor(actor);
		let query: any = {};
		if (/^[a-f\d]{24}$/i.test(categoryId)) {
			query._id = new ObjectId(categoryId);
		} else {
			// Menggunakan field 'slug' untuk pencarian kategori non-ObjectId
			query.slug = categoryId;
		}
		const existingCategory = await db.collection("categories").findOne(query);
		if (!existingCategory) {
			const err: any = new Error("Category not found.");
			err.status = 404;
			throw err;
		}
		const oldValue = categoryDocAuditSnapshot(
			existingCategory as Record<string, unknown>,
		);
		if (name !== undefined) {
			if (typeof name !== "string" || name.length < 3 || name.length > 32) {
				const err: any = new Error(
					"Name must be a string between 3 and 32 characters.",
				);
				err.status = 400;
				throw err;
			}
		}
		if (description !== undefined) {
			if (
				typeof description !== "string" ||
				description.length < 10 ||
				description.length > 100
			) {
				const err: any = new Error(
					"Description must be a string between 10 and 100 characters.",
				);
				err.status = 400;
				throw err;
			}
		}
		let mongoParentId: ObjectId | undefined = undefined;
		if (parentId !== undefined) {
			if (parentId) {
				try {
					mongoParentId = new ObjectId(parentId);
				} catch {
					const err: any = new Error("Invalid parentId format.");
					err.status = 400;
					throw err;
				}
				// Tidak boleh self-parent (menggunakan perbandingan ObjectId yang aman)
				if (existingCategory._id.equals(mongoParentId)) {
					const err: any = new Error("Category cannot be its own parent.");
					err.status = 400;
					throw err;
				}
				// Check parent exists
				if (mongoParentId instanceof ObjectId) {
					const parentExists = await db
						.collection("categories")
						.findOne({ _id: mongoParentId });
					if (!parentExists) {
						const err: any = new Error("Parent category not found.");
						err.status = 400;
						throw err;
					}
				}
			} else {
				mongoParentId = undefined;
			}
		}
		// If name is changed, generate new slug and check uniqueness
		let slug = existingCategory.slug;
		if (name !== undefined && name !== existingCategory.name) {
			slug = slugify(name, { lower: true, strict: true });
			if (isReservedRootSegment(slug)) {
				const err: any = new Error(
					`Category slug "${slug}" is a reserved root segment.`,
				);
				err.status = 400;
				throw err;
			}
			const slugExists = await db
				.collection("categories")
				.findOne({ slug, _id: { $ne: existingCategory._id } });
			if (slugExists) {
				const err: any = new Error("Category slug already exists.");
				err.status = 409;
				throw err;
			}
		}
		const setUpdates: Record<string, unknown> = {
			updatedAt: new Date(),
		};

		const unsetFields: Record<string, string> = {};

		if (name !== undefined) {
			setUpdates.name = name;
			setUpdates.slug = slug;
		}
		if (description !== undefined) {
			setUpdates.description = description;
		}
		if (parentId !== undefined) {
			if (!parentId || !String(parentId).trim()) {
				setUpdates.parentId = null;
			} else if (mongoParentId !== undefined) {
				setUpdates.parentId = mongoParentId;
			}
		}

		if (showOnNavbar !== undefined) {
			setUpdates.showOnNavbar = !!showOnNavbar;
		}

		if (order !== undefined) {
			if (order === null) {
				unsetFields.order = "";
			} else if (typeof order === "number" && order > 0) {
				setUpdates.order = order;
			}
		}
		if (nickname !== undefined) {
			if (nickname === null || nickname === "") {
				unsetFields.nickname = "";
			} else if (typeof nickname === "string") {
				try {
					const n = normalizeNickname(nickname);
					if (n !== undefined) {
						setUpdates.nickname = n;
					} else {
						unsetFields.nickname = "";
					}
				} catch (msg: unknown) {
					const err: any = msg instanceof Error ? msg : new Error(String(msg));
					err.status = 400;
					throw err;
				}
			} else {
				const err: any = new Error("Nickname must be a string or empty.");
				err.status = 400;
				throw err;
			}
		}

		const updateDoc: Record<string, unknown> = { $set: setUpdates };
		if (Object.keys(unsetFields).length > 0) {
			updateDoc.$unset = unsetFields;
		}

		await db.collection("categories").updateOne(query, updateDoc as any);
		const updatedCategory = await db.collection("categories").findOne(query);
		if (!updatedCategory) return null;

		try {
			await createAuditLog(db, {
				actor: auditActor,
				action: AuditLogAction.UPDATE,
				entity: "CATEGORY",
				entityId: String(existingCategory._id),
				details: `Memperbarui kategori: ${String(existingCategory.name)} (${String(existingCategory.slug)})`,
				oldValue,
				newValue: categoryDocAuditSnapshot(
					updatedCategory as Record<string, unknown>,
				),
			});
		} catch (auditErr) {
			logger.error(
				{ err: auditErr, categoryId: String(existingCategory._id) },
				"createAuditLog gagal setelah updateCategory",
			);
		}

		logger.info(
			{ categoryId: String(existingCategory._id) },
			"updateCategory selesai",
		);
		return serializeCategory(updatedCategory);
	} catch (err) {
		logger.error({ err, categoryId }, "updateCategory gagal");
		throw err;
	}
}

/** Satu baris untuk POST `/categories/sort` (hanya kategori di navbar kiri). */
export type NavbarSortPayloadItem = {
	categoryId: string;
	showOnNavbar: boolean;
	order: number;
};

/**
 * Terapkan urutan navbar: update setiap ID di payload (showOnNavbar + order).
 * Untuk dokumen lain: showOnNavbar = false dan field order dihapus.
 */
export async function bulkApplyNavbarCategorySort(
	db: Db,
	rawItems: unknown,
	actor: AuditLogActor,
) {
	const auditActor = requireAuditActor(actor);
	if (!Array.isArray(rawItems)) {
		const err: any = new Error("items must be an array.");
		err.status = 400;
		throw err;
	}

	const items: NavbarSortPayloadItem[] = [];
	const seen = new Set<string>();
	for (let i = 0; i < rawItems.length; i++) {
		const row = rawItems[i];
		if (!row || typeof row !== "object") {
			const err: any = new Error("Each items entry must be an object.");
			err.status = 400;
			throw err;
		}
		const o = row as Record<string, unknown>;
		const categoryId =
			o.categoryId != null ? String(o.categoryId).trim() : "";
		const showOk = typeof o.showOnNavbar === "boolean" && o.showOnNavbar === true;
		const orderVal = o.order;
		const orderOk =
			typeof orderVal === "number" &&
			Number.isInteger(orderVal) &&
			orderVal >= 1;
		if (!categoryId) {
			const err: any = new Error("categoryId is required for each item.");
			err.status = 400;
			throw err;
		}
		if (!showOk || !orderOk) {
			const err: any = new Error(
				"Each item must include showOnNavbar: true and a positive integer order.",
			);
			err.status = 400;
			throw err;
		}
		if (seen.has(categoryId)) {
			const err: any = new Error(
				`Duplicate categoryId in items: "${categoryId}".`,
			);
			err.status = 400;
			throw err;
		}
		seen.add(categoryId);
		items.push({
			categoryId,
			showOnNavbar: true,
			order: orderVal as number,
		});
	}

	const col = db.collection("categories");

	const ids: ObjectId[] = [];
	for (const row of items) {
		try {
			ids.push(new ObjectId(row.categoryId));
		} catch {
			const err: any = new Error(
				`Invalid categoryId ObjectId format: "${row.categoryId}".`,
			);
			err.status = 400;
			throw err;
		}
	}

	if (items.length > 0) {
		const foundCount = await col.countDocuments({
			_id: { $in: ids },
		});
		if (foundCount !== items.length) {
			const err: any = new Error(
				"One or more categoryId values refer to categories that do not exist.",
			);
			err.status = 400;
			throw err;
		}
	}

	const now = new Date();

	await col.updateMany(
		ids.length === 0
			? {}
			: { _id: { $nin: ids } },
		{ $set: { showOnNavbar: false, updatedAt: now }, $unset: { order: "" } },
	);

	if (items.length > 0) {
		await col.bulkWrite(
			items.map((row) => ({
				updateOne: {
					filter: { _id: new ObjectId(row.categoryId) },
					update: {
						$set: {
							showOnNavbar: true,
							order: row.order,
							updatedAt: now,
						},
					},
				},
			})),
			{ ordered: true },
		);
	}

	logger.info({ count: items.length }, "bulkApplyNavbarCategorySort selesai");

	try {
		await createAuditLog(db, {
			actor: auditActor,
			action: AuditLogAction.UPDATE,
			entity: "CATEGORY",
			entityId: "navbar-sort-bulk",
			details:
				items.length === 0
					? "Navbar kategori dibersihkan (tidak ada entri)."
					: `Bulk urutan navbar: ${items.length} kategori.`,
			newValue: { items },
		});
	} catch (auditErr) {
		logger.error(
			{ err: auditErr },
			"createAuditLog gagal setelah bulkApplyNavbarCategorySort",
		);
	}
}

export async function deleteCategory(
	db: Db,
	categoryId: string,
	actor: AuditLogActor,
) {
	logger.info({ categoryId }, "deleteCategory dimulai");
	try {
		const auditActor = requireAuditActor(actor);
		let query: any = {};
		if (/^[a-f\d]{24}$/i.test(categoryId)) {
			query._id = new ObjectId(categoryId);
		} else {
			// Menggunakan field 'slug' untuk pencarian kategori non-ObjectId
			query.slug = categoryId;
		}
		const category = await db.collection("categories").findOne(query);
		if (!category) {
			const err: any = new Error("Category not found.");
			err.status = 404;
			throw err;
		}
		const entityIdStr = String(category._id);
		const oldValue = categoryDocAuditSnapshot(
			category as Record<string, unknown>,
		);
		// Cek apakah ada child category
		const childCount = await db
			.collection("categories")
			.countDocuments({ parentId: category._id });
		if (childCount > 0) {
			const err: any = new Error(
				"Cannot delete: category has child categories.",
			);
			err.status = 400;
			throw err;
		}
		// Cek apakah ada artikel di kategori ini
		const articleCount = await db
			.collection("articles")
			.countDocuments({ categoryId: category._id });
		if (articleCount > 0) {
			const err: any = new Error("Cannot delete: category has articles.");
			err.status = 400;
			throw err;
		}
		await db.collection("categories").deleteOne(query);

		try {
			await createAuditLog(db, {
				actor: auditActor,
				action: AuditLogAction.DELETE,
				entity: "CATEGORY",
				entityId: entityIdStr,
				details: `Menghapus kategori: ${String(category.name)} (${String(category.slug)})`,
				oldValue,
			});
		} catch (auditErr) {
			logger.error(
				{ err: auditErr, categoryId: entityIdStr },
				"createAuditLog gagal setelah deleteCategory",
			);
		}

		logger.info({ categoryId: entityIdStr }, "deleteCategory selesai");
		return { message: "Category deleted" };
	} catch (err) {
		logger.error({ err, categoryId }, "deleteCategory gagal");
		throw err;
	}
}

export async function getCategories(
	db: Db,
	{
		limit = 20,
		page = 1,
		isRoot = false,
		query = "",
		withChildren = false,
		onlyShowOnNavbar = false,
		onlyFeatured = false,
		sortBy = "order",
	}: {
		limit?: number;
		page?: number;
		isRoot?: boolean;
		query?: string;
		withChildren?: boolean;
		/** Jika true, hanya kategori dengan showOnNavbar === true */
		onlyShowOnNavbar?: boolean;
		/** Jika true, hanya kategori dengan featured === true */
		onlyFeatured?: boolean;
		/** Sorting field: 'name', 'order', atau 'featuredOrder' (default: 'order') */
		sortBy?: "name" | "order" | "featuredOrder";
	} = {},
): Promise<CategoryListResult> {
	const skip = (page - 1) * limit;
	const col = db.collection("categories");
	const filter: Record<string, unknown> = {};
	if (isRoot) filter.parentId = null;
	if (onlyShowOnNavbar) filter.showOnNavbar = true;
	if (onlyFeatured) filter.featured = true;
	if (query.length >= 2) {
		filter.$or = [
			{ name: { $regex: query, $options: "i" } },
			{ description: { $regex: query, $options: "i" } },
		];
	}

	// Determine sort order based on sortBy parameter
	const sortOrder: Record<string, 1 | -1> =
		sortBy === "name"
			? { name: 1 }
			: sortBy === "featuredOrder"
				? { featuredOrder: 1, name: 1 }
				: { order: 1, name: 1 };

	const [categories, total] = await Promise.all([
		col.find(filter).sort(sortOrder).skip(skip).limit(limit).toArray(),
		col.countDocuments(filter),
	]);

	let result: CategoryWithParent[];
	if (withChildren) {
		const allCategories = await col.find({}).sort({ name: 1 }).toArray();
		const byId = new Map(
			allCategories.map((c) => [String(c._id), serializeCategory(c)]),
		);
		const childrenByParentId = new Map<string, unknown[]>();
		for (const cat of allCategories) {
			if (cat.parentId != null) {
				const key = String(cat.parentId);
				if (!childrenByParentId.has(key)) childrenByParentId.set(key, []);
				childrenByParentId.get(key)!.push(cat);
			}
		}
		function attachChildren(cat: Record<string, unknown>): CategoryWithParent {
			const base = serializeCategory(cat);
			const children = (childrenByParentId.get(String(cat._id)) || []).map(
				(row) => attachChildren(row as Record<string, unknown>),
			);
			return { ...base, children };
		}
		result = categories.map((cat) => {
			const base = attachChildren(cat);
			return {
				...base,
				parent: cat.parentId ? (byId.get(String(cat.parentId)) ?? null) : null,
			};
		});
	} else {
		const parentIds = [
			...new Set(
				categories
					.filter((c) => c.parentId != null)
					.map((c) => String(c.parentId)),
			),
		];
		const parentMap = new Map<string, Record<string, unknown>>();
		if (parentIds.length > 0) {
			const parents = await col
				.find({ _id: { $in: parentIds.map((id) => new ObjectId(id)) } })
				.toArray();
			for (const p of parents) parentMap.set(String(p._id), p);
		}
		result = categories.map((cat) => {
			const base = serializeCategory(cat);
			let parent: Category | null = null;
			if (cat.parentId) {
				const p = parentMap.get(String(cat.parentId));
				parent = p ? serializeCategory(p) : null;
			}
			return {
				...base,
				parent,
			};
		});
	}
	return {
		categories: result,
		pagination: {
			page,
			limit,
			total,
			totalPages: Math.ceil(total / limit),
		},
	};
}

export async function getCategoryByIdOrSlug(
	db: Db,
	idOrSlug: string,
): Promise<
	(CategoryWithParent & { totalArticles: number; totalViews: number }) | null
> {
	const col = db.collection("categories");
	let query: Record<string, unknown> = {};
	if (/^[a-f\d]{24}$/i.test(idOrSlug)) {
		query._id = new ObjectId(idOrSlug);
	} else {
		query.slug = idOrSlug;
	}
	const category = await col.findOne(query);
	if (!category) return null;
	const base = serializeCategory(category);
	// Aggregate total articles and total views
	const articleFilter = { categoryId: category._id };
	const [totalArticles, totalViews] = await Promise.all([
		db.collection("articles").countDocuments(articleFilter),
		db
			.collection("articles")
			.aggregate([
				{ $match: articleFilter },
				{ $group: { _id: null, sum: { $sum: "$viewCount" } } },
			])
			.toArray(),
	]);
	const views = totalViews[0]?.sum || 0;
	let parent: Category | null = null;
	if (category.parentId) {
		const p = await col.findOne({ _id: new ObjectId(category.parentId) });
		if (p) {
			parent = serializeCategory(p);
		}
	}
	return {
		...base,
		parent: parent ?? null,
		totalArticles,
		totalViews: views,
	};
}

/** Satu baris untuk POST `/categories/featured-sort` */
export type FeaturedSortPayloadItem = {
	categoryId: string;
	featured: boolean;
	featuredOrder: number;
};

/**
 * Terapkan urutan unggulan: update setiap ID di payload (featured + featuredOrder).
 * Untuk dokumen lain: featured = false dan field featuredOrder dihapus.
 */
export async function bulkApplyFeaturedCategorySort(
	db: Db,
	rawItems: unknown,
	actor: AuditLogActor,
) {
	const auditActor = requireAuditActor(actor);
	if (!Array.isArray(rawItems)) {
		const err: any = new Error("items must be an array.");
		err.status = 400;
		throw err;
	}

	const items: FeaturedSortPayloadItem[] = [];
	const seen = new Set<string>();
	for (let i = 0; i < rawItems.length; i++) {
		const row = rawItems[i];
		if (!row || typeof row !== "object") {
			const err: any = new Error("Each items entry must be an object.");
			err.status = 400;
			throw err;
		}
		const o = row as Record<string, unknown>;
		const categoryId =
			o.categoryId != null ? String(o.categoryId).trim() : "";
		const featuredOk = typeof o.featured === "boolean" && o.featured === true;
		const orderVal = o.featuredOrder;
		const orderOk =
			typeof orderVal === "number" &&
			Number.isInteger(orderVal) &&
			orderVal >= 1;
		if (!categoryId) {
			const err: any = new Error("categoryId is required for each item.");
			err.status = 400;
			throw err;
		}
		if (!featuredOk || !orderOk) {
			const err: any = new Error(
				"Each item must include featured: true and a positive integer featuredOrder.",
			);
			err.status = 400;
			throw err;
		}
		if (seen.has(categoryId)) {
			const err: any = new Error(
				`Duplicate categoryId in items: "${categoryId}".`,
			);
			err.status = 400;
			throw err;
		}
		seen.add(categoryId);
		items.push({
			categoryId,
			featured: true,
			featuredOrder: orderVal as number,
		});
	}

	const col = db.collection("categories");

	const ids: ObjectId[] = [];
	for (const row of items) {
		try {
			ids.push(new ObjectId(row.categoryId));
		} catch {
			const err: any = new Error(
				`Invalid categoryId ObjectId format: "${row.categoryId}".`,
			);
			err.status = 400;
			throw err;
		}
	}

	if (items.length > 0) {
		const foundCount = await col.countDocuments({
			_id: { $in: ids },
		});
		if (foundCount !== items.length) {
			const err: any = new Error(
				"One or more categoryId values refer to categories that do not exist.",
			);
			err.status = 400;
			throw err;
		}
	}

	const now = new Date();

	await col.updateMany(
		ids.length === 0
			? {}
			: { _id: { $nin: ids } },
		{ $set: { featured: false, updatedAt: now }, $unset: { featuredOrder: "" } },
	);

	if (items.length > 0) {
		await col.bulkWrite(
			items.map((row) => ({
				updateOne: {
					filter: { _id: new ObjectId(row.categoryId) },
					update: {
						$set: {
							featured: true,
							featuredOrder: row.featuredOrder,
							updatedAt: now,
						},
					},
				},
			})),
			{ ordered: true },
		);
	}

	logger.info({ count: items.length }, "bulkApplyFeaturedCategorySort selesai");

	try {
		await createAuditLog(db, {
			actor: auditActor,
			action: AuditLogAction.UPDATE,
			entity: "CATEGORY",
			entityId: "featured-sort-bulk",
			details:
				items.length === 0
					? "Unggulan kategori dibersihkan (tidak ada entri)."
					: `Bulk urutan unggulan: ${items.length} kategori.`,
			newValue: { items },
		});
	} catch (auditErr) {
		logger.error(
			{ err: auditErr },
			"createAuditLog gagal setelah bulkApplyFeaturedCategorySort",
		);
	}
}

export interface FeaturedCategoryWithArticles extends Category {
	articles: ArticleListResponse[];
}

/**
 * Mengambil daftar kategori unggulan (featured: true) diurutkan berdasarkan featuredOrder
 * dan memuat artikel-artikel terbaru yang sudah dipublikasikan dari masing-masing kategori
 * dengan query seefisien mungkin menggunakan aggregation framework.
 */
export async function getFeaturedCategoriesWithLatestArticles(
	db: Db,
	articleLimit: number = 4
): Promise<FeaturedCategoryWithArticles[]> {
	logger.info({ articleLimit }, "getFeaturedCategoriesWithLatestArticles dimulai");
	try {
		const col = db.collection("categories");
		
		const pipeline = [
			{ $match: { featured: true } },
			{ $sort: { featuredOrder: 1, name: 1 } },
			{
				$lookup: {
					from: "articles",
					let: { catId: "$_id" },
					pipeline: [
						{
							$match: {
								$expr: {
									$and: [
										{ $eq: ["$categoryId", "$$catId"] },
										{ $eq: ["$status", "PUBLISHED"] }
									]
								}
							}
						},
						{ $sort: { publishedAt: -1 } },
						{ $limit: articleLimit },
						{
							$lookup: {
								from: "users",
								localField: "authorId",
								foreignField: "_id",
								as: "authorArr"
							}
						},
						{ $addFields: { author: { $arrayElemAt: ["$authorArr", 0] } } },
						{
							$lookup: {
								from: "media",
								let: {
									fiId: {
										$cond: {
											if: { $eq: [{ $type: "$featuredImage" }, "objectId"] },
											then: "$featuredImage",
											else: {
												$cond: {
													if: { $eq: [{ $type: "$featuredImage" }, "object"] },
													then: {
														$ifNull: ["$featuredImage.mediaId", "$featuredImage._id"]
													},
													else: null
												}
											}
										}
									}
								},
								pipeline: [
									{
										$match: {
											$expr: {
												$and: [
													{ $ne: ["$$fiId", null] },
													{ $eq: ["$_id", "$$fiId"] }
												]
											}
										}
									},
									{ $project: { _id: 1, url: 1, caption: 1, credit: 1, takenBy: 1 } }
								],
								as: "fiMediaArr"
							}
						},
						{ $addFields: { featuredImageMedia: { $arrayElemAt: ["$fiMediaArr", 0] } } },
						{
							$project: {
								_id: 1,
								title: 1,
								slug: 1,
								publicPath: 1,
								urlFormat: 1,
								excerpt: 1,
								tags: 1,
								format: 1,
								galleryItems: 1,
								viewCount: 1,
								featuredImage: 1,
								featuredImageMedia: 1,
								author: {
									_id: 1,
									name: 1,
									email: 1,
									avatar: 1,
									role: 1
								},
								status: 1,
								publishedAt: 1,
								updatedAt: 1
							}
						}
					],
					as: "articlesArr"
				}
			}
		];

		const docs = await col.aggregate(pipeline).toArray();

		const result: FeaturedCategoryWithArticles[] = docs.map((doc) => {
			const serializedCat = serializeCategory(doc);
			const rawArticles = Array.isArray(doc.articlesArr) ? doc.articlesArr : [];
			
			const articles: ArticleListResponse[] = rawArticles.map((art: Record<string, unknown>) => {
				const authorRaw = art.author as Record<string, unknown> | undefined;
				const authorMapped: UserProfile = authorRaw
					? {
							_id: String(authorRaw._id ?? ""),
							name: String(authorRaw.name ?? ""),
							email: String(authorRaw.email ?? ""),
							avatar: authorRaw.avatar as UserProfile["avatar"],
							role: (authorRaw.role ?? "SUBSCRIBER") as UserProfile["role"],
						}
					: { _id: "", name: "", email: "", role: "SUBSCRIBER" };

				const format =
					art.format === "GALLERY" ? ("GALLERY" as const) : ("STANDARD" as const);

				let featuredImage = normalizeFeaturedImage(
					art.featuredImage,
					art.featuredImageMedia as Record<string, unknown> | null,
				);

				if (!featuredImage && format === "GALLERY" && Array.isArray(art.galleryItems)) {
					const firstWithUrl = (art.galleryItems as Record<string, unknown>[]).find(
						(g) => typeof g?.url === "string" && g.url.trim(),
					);
					if (firstWithUrl) {
						featuredImage = {
							mediaId: String(firstWithUrl.mediaId ?? ""),
							url: String(firstWithUrl.url),
							caption:
								typeof firstWithUrl.caption === "string"
									? firstWithUrl.caption
									: "",
							credit:
								typeof firstWithUrl.credit === "string"
									? firstWithUrl.credit
									: "",
						};
					}
				}

				const publishedAt =
					art.publishedAt instanceof Date
						? art.publishedAt
						: art.publishedAt
							? new Date(String(art.publishedAt))
							: new Date(0);
				const updatedAt =
					art.updatedAt instanceof Date
						? art.updatedAt
						: art.updatedAt
							? new Date(String(art.updatedAt))
							: publishedAt;

				return {
					_id: String(art._id ?? ""),
					title: String(art.title ?? ""),
					slug: String(art.slug ?? ""),
					publicPath: art.publicPath ? String(art.publicPath) : null,
					urlFormat: art.urlFormat === "structured" ? "structured" : "legacy",
					excerpt: art.excerpt ? String(art.excerpt) : "",
					category: serializedCat,
					tags: Array.isArray(art.tags) ? art.tags : [],
					featuredImage: featuredImage ?? undefined,
					author: authorMapped,
					status: (art.status as ArticleListResponse["status"]) ?? "PUBLISHED",
					format,
					viewCount: typeof art.viewCount === "number" ? art.viewCount : 0,
					publishedAt,
					updatedAt,
				};
			});

			return {
				...serializedCat,
				articles
			};
		});

		logger.info({ count: result.length }, "getFeaturedCategoriesWithLatestArticles selesai");
		return result;
	} catch (err) {
		logger.error({ err }, "getFeaturedCategoriesWithLatestArticles gagal");
		throw err;
	}
}
