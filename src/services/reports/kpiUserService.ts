import { Db, ObjectId } from "mongodb";
import {
	KPIWriterTeamResponse,
	KPIEditorResponse,
	KPISummaryResponse,
	IndividualTargetState,
} from "@/types/reports/kpiUser";
import { UserProfile } from "@/types/user";
import logger from "@/lib/logger";
import {
	DEFAULT_SLA_MINUTES,
	PeriodBounds,
	buildSiteTargetDisplay,
	buildUnsetIndividualTarget,
	currentPeriodMonthWib,
	getMonthBoundsWib,
	getPreviousMonthBoundsWib,
	momGrowthRate,
	publicViewReferrerMatch,
	roundNumber,
	safePercent,
	toObjectIdOrNull,
} from "@/lib/analytics/metrics-core";

/** Audit actions counted as editor processing activity. */
export const EDITOR_PROCESS_ACTIONS = [
	"PUBLISH",
	"SCHEDULE",
	"REJECT",
	"UPDATE",
] as const;

type ScopeOptions = {
	period?: string;
	search?: string;
	scopedUserIds?: string[] | null;
};

type ActivitySource = "audit_log" | "editor_activities";

type RevisionBucket = { submitted: number; rejected: number };
type ProcessBucket = {
	processed: number;
	revision: number;
	articleIds: ObjectId[];
};

const INDIVIDUAL_TARGET_LABEL = "Target individual belum diset";

function resolvePeriod(period?: string): string {
	const trimmed = period?.trim();
	return trimmed && trimmed.length > 0 ? trimmed : currentPeriodMonthWib();
}

function toUserProfile(user: Record<string, unknown>): UserProfile {
	return {
		_id: String(user._id),
		name: String(user.name ?? ""),
		email: String(user.email ?? ""),
		avatar: user.avatar as UserProfile["avatar"],
		role: user.role as UserProfile["role"],
	};
}

function buildIndividualTarget(
	siteContextValue: number | null,
	siteContextLabel = "site",
): IndividualTargetState {
	const unset = buildUnsetIndividualTarget({
		label: siteContextLabel,
		value: siteContextValue,
	});
	return {
		status: "unset",
		label: INDIVIDUAL_TARGET_LABEL,
		siteContextValue: unset.contextValue,
		siteContextLabel: unset.contextLabel,
	};
}

function parseScopedObjectIds(scopedUserIds?: string[] | null): ObjectId[] | null {
	if (scopedUserIds == null) return null;
	return scopedUserIds
		.map((id) => toObjectIdOrNull(id))
		.filter((id): id is ObjectId => id != null);
}

function periodTimestampMatch(bounds: PeriodBounds): Record<string, unknown> {
	const range = { $gte: bounds.start, $lt: bounds.end };
	return {
		$or: [
			{ publishedAt: range },
			{ submittedAt: range },
			{ createdAt: range },
			{ updatedAt: range },
		],
	};
}

/**
 * Distinct authorIds for articles of any status that were active in the period.
 * Optional scopedUserIds limits to self (Editor self-only).
 */
export async function discoverAuthorIdsInPeriod(
	db: Db,
	bounds: PeriodBounds,
	scopedUserIds?: string[] | null,
): Promise<ObjectId[]> {
	const match: Record<string, unknown> = {
		deletedAt: { $in: [null, ""] },
		authorId: { $ne: null },
		...periodTimestampMatch(bounds),
	};

	const scopedIds = parseScopedObjectIds(scopedUserIds);
	if (scopedIds) {
		match.authorId = { $in: scopedIds };
	}

	const rows = await db
		.collection("articles")
		.aggregate<{ _id: ObjectId }>([
			{ $match: match },
			{ $group: { _id: "$authorId" } },
		])
		.toArray();

	return rows
		.map((r) => toObjectIdOrNull(r._id))
		.filter((id): id is ObjectId => id != null);
}

/**
 * Distinct actor._id from audit_log editor process actions in the period.
 */
export async function discoverEditorIdsInPeriod(
	db: Db,
	bounds: PeriodBounds,
	scopedUserIds?: string[] | null,
): Promise<ObjectId[]> {
	const match: Record<string, unknown> = {
		entity: "articles",
		createdAt: { $gte: bounds.start, $lt: bounds.end },
		action: { $in: [...EDITOR_PROCESS_ACTIONS] },
	};

	const scopedIds = parseScopedObjectIds(scopedUserIds);
	if (scopedIds) {
		match.$or = [
			{ "actor._id": { $in: scopedIds } },
			{ "actor._id": { $in: scopedIds.map((id) => String(id)) } },
		];
	} else {
		match["actor._id"] = { $exists: true, $ne: null };
	}

	const rows = await db
		.collection("audit_log")
		.aggregate<{ _id: unknown }>([
			{ $match: match },
			{ $group: { _id: "$actor._id" } },
		])
		.toArray();

	return rows
		.map((r) => toObjectIdOrNull(r._id))
		.filter((id): id is ObjectId => id != null);
}

type FallbackProfileSource = "author" | "editor";

/**
 * Load user profiles by ids; fill orphans from article.author or audit_log.actor denorm.
 */
export async function loadUserProfilesByIds(
	db: Db,
	ids: ObjectId[],
	options: { search?: string; fallbackSource?: FallbackProfileSource } = {},
): Promise<Record<string, unknown>[]> {
	if (ids.length === 0) return [];

	const users = await db
		.collection("users")
		.find(
			{ _id: { $in: ids } },
			{
				projection: {
					_id: 1,
					name: 1,
					email: 1,
					avatar: 1,
					role: 1,
				},
			},
		)
		.toArray();

	const byId = new Map(users.map((u) => [String(u._id), u as Record<string, unknown>]));
	const missing = ids.filter((id) => !byId.has(String(id)));

	if (missing.length > 0) {
		const fallbackSource = options.fallbackSource ?? "author";
		if (fallbackSource === "author") {
			const samples = await db
				.collection("articles")
				.aggregate<{
					_id: ObjectId;
					author?: { name?: string; email?: string; avatar?: unknown };
				}>([
					{ $match: { authorId: { $in: missing } } },
					{ $sort: { updatedAt: -1 } },
					{
						$group: {
							_id: "$authorId",
							author: { $first: "$author" },
						},
					},
				])
				.toArray();

			for (const sample of samples) {
				const id = String(sample._id);
				if (byId.has(id)) continue;
				byId.set(id, {
					_id: sample._id,
					name: sample.author?.name || "User tidak diketahui",
					email: sample.author?.email || "",
					avatar: sample.author?.avatar,
					role: undefined,
				});
			}
		} else {
			const samples = await db
				.collection("audit_log")
				.aggregate<{
					_id: unknown;
					actor?: {
						name?: string;
						email?: string;
						avatarUrl?: string;
						avatar?: unknown;
					};
				}>([
					{
						$match: {
							$or: [
								{ "actor._id": { $in: missing } },
								{ "actor._id": { $in: missing.map((id) => String(id)) } },
							],
						},
					},
					{ $sort: { createdAt: -1 } },
					{
						$group: {
							_id: "$actor._id",
							actor: { $first: "$actor" },
						},
					},
				])
				.toArray();

			for (const sample of samples) {
				const id = String(sample._id);
				if (byId.has(id)) continue;
				const oid = toObjectIdOrNull(sample._id) ?? sample._id;
				byId.set(id, {
					_id: oid,
					name: sample.actor?.name || "User tidak diketahui",
					email: sample.actor?.email || "",
					avatar: sample.actor?.avatar ?? sample.actor?.avatarUrl,
					role: undefined,
				});
			}
		}

		// Still missing after denorm — keep a minimal stub so metrics can attach
		for (const id of missing) {
			const key = String(id);
			if (byId.has(key)) continue;
			byId.set(key, {
				_id: id,
				name: "User tidak diketahui",
				email: "",
				role: undefined,
			});
		}
	}

	let profiles = ids
		.map((id) => byId.get(String(id)))
		.filter((u): u is Record<string, unknown> => u != null);

	const search = options.search?.trim();
	if (search && search.length >= 2) {
		const re = new RegExp(
			search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
			"i",
		);
		profiles = profiles.filter((u) => re.test(String(u.name ?? "")));
	}

	return profiles;
}

async function fetchGlobalTargetValue(
	db: Db,
	period: string,
	key: string,
): Promise<number | null> {
	const doc = await db.collection("monthly_targets").findOne({
		key,
		period,
		scopeType: "GLOBAL",
	});
	const value = doc?.value;
	if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
		return null;
	}
	return value;
}

async function countPublishedByAuthor(
	db: Db,
	authorIds: ObjectId[],
	bounds: PeriodBounds,
): Promise<Map<string, number>> {
	if (authorIds.length === 0) return new Map();

	const rows = await db
		.collection("articles")
		.aggregate<{ _id: ObjectId; count: number }>([
			{
				$match: {
					authorId: { $in: authorIds },
					status: "PUBLISHED",
					publishedAt: { $gte: bounds.start, $lt: bounds.end },
					deletedAt: { $in: [null, ""] },
				},
			},
			{ $group: { _id: "$authorId", count: { $sum: 1 } } },
		])
		.toArray();

	const map = new Map<string, number>();
	for (const row of rows) {
		if (row._id == null) continue;
		map.set(String(row._id), row.count || 0);
	}
	return map;
}

/**
 * Consumption pageviews in period for articles authored by the given users.
 * Excludes internal admin referrers.
 */
async function pageviewsByAuthor(
	db: Db,
	authorIds: ObjectId[],
	bounds: PeriodBounds,
): Promise<Map<string, number>> {
	if (authorIds.length === 0) return new Map();

	const rows = await db
		.collection("article_views")
		.aggregate<{ _id: ObjectId; pageViews: number }>([
			{
				$match: {
					viewedAt: { $gte: bounds.start, $lt: bounds.end },
					...publicViewReferrerMatch(),
				},
			},
			{
				$group: {
					_id: "$articleId",
					views: { $sum: 1 },
				},
			},
			{
				$lookup: {
					from: "articles",
					localField: "_id",
					foreignField: "_id",
					as: "article",
				},
			},
			{ $unwind: "$article" },
			{
				$match: {
					"article.authorId": { $in: authorIds },
					"article.deletedAt": { $in: [null, ""] },
				},
			},
			{
				$group: {
					_id: "$article.authorId",
					pageViews: { $sum: "$views" },
				},
			},
		])
		.toArray();

	const map = new Map<string, number>();
	for (const row of rows) {
		if (row._id == null) continue;
		map.set(String(row._id), row.pageViews || 0);
	}
	return map;
}

async function countSitePageviews(
	db: Db,
	bounds: PeriodBounds,
): Promise<number> {
	return db.collection("article_views").countDocuments({
		viewedAt: { $gte: bounds.start, $lt: bounds.end },
		...publicViewReferrerMatch(),
	});
}

async function revisionByAuthor(
	db: Db,
	authorIds: ObjectId[],
	bounds: PeriodBounds,
): Promise<{ source: ActivitySource; map: Map<string, RevisionBucket> }> {
	if (authorIds.length === 0) {
		return { source: "audit_log", map: new Map() };
	}

	const audit = await db
		.collection("audit_log")
		.aggregate<{
			_id: unknown;
			rejects: number;
			publishes: number;
			pendingSubmits: number;
		}>([
			{
				$match: {
					entity: "articles",
					createdAt: { $gte: bounds.start, $lt: bounds.end },
					action: { $in: ["REJECT", "PUBLISH", "CREATE", "UPDATE"] },
				},
			},
			{
				$group: {
					_id: "$entityId",
					rejects: {
						$sum: { $cond: [{ $eq: ["$action", "REJECT"] }, 1, 0] },
					},
					publishes: {
						$sum: { $cond: [{ $eq: ["$action", "PUBLISH"] }, 1, 0] },
					},
					pendingSubmits: {
						$sum: {
							$cond: [{ $eq: ["$meta.statusTo", "PENDING_REVIEW"] }, 1, 0],
						},
					},
				},
			},
		])
		.toArray();

	if (audit.length > 0) {
		const entityIds = audit
			.map((row) => toObjectIdOrNull(row._id))
			.filter((id): id is ObjectId => id != null);

		const articles = await db
			.collection("articles")
			.find(
				{ _id: { $in: entityIds }, authorId: { $in: authorIds } },
				{ projection: { _id: 1, authorId: 1 } },
			)
			.toArray();

		const authorByArticle = new Map(
			articles.map((a) => [String(a._id), String(a.authorId)]),
		);
		const byAuthor = new Map<string, RevisionBucket>();

		for (const row of audit) {
			const authorId = authorByArticle.get(String(row._id));
			if (!authorId) continue;
			const bucket = byAuthor.get(authorId) || { submitted: 0, rejected: 0 };
			const rejects = row.rejects || 0;
			const publishes = row.publishes || 0;
			const pending = row.pendingSubmits || 0;
			bucket.rejected += rejects;
			// Prefer meta PENDING_REVIEW counts when present; else reject+publish proxy
			bucket.submitted += pending > 0 ? pending : rejects + publishes;
			byAuthor.set(authorId, bucket);
		}

		if (byAuthor.size > 0) {
			return { source: "audit_log", map: byAuthor };
		}
	}

	const legacy = await db
		.collection("editor_activities")
		.aggregate<{ _id: ObjectId; submitted: number; rejected: number }>([
			{
				$match: {
					authorId: { $in: authorIds },
					timestamp: { $gte: bounds.start, $lt: bounds.end },
					deletedAt: { $in: [null, ""] },
				},
			},
			{
				$group: {
					_id: "$authorId",
					submitted: {
						$sum: {
							$cond: [{ $eq: ["$statusTo", "PENDING_REVIEW"] }, 1, 0],
						},
					},
					rejected: {
						$sum: {
							$cond: [
								{
									$and: [
										{ $eq: ["$statusFrom", "PENDING_REVIEW"] },
										{ $eq: ["$statusTo", "REJECTED"] },
									],
								},
								1,
								0,
							],
						},
					},
				},
			},
		])
		.toArray();

	const map = new Map<string, RevisionBucket>();
	for (const row of legacy) {
		if (row._id == null) continue;
		map.set(String(row._id), {
			submitted: row.submitted || 0,
			rejected: row.rejected || 0,
		});
	}
	return { source: "editor_activities", map };
}

function actorIdMatch(editorIds: ObjectId[]): Record<string, unknown> {
	const strings = editorIds.map((id) => String(id));
	return {
		$or: [
			{ "actor._id": { $in: editorIds } },
			{ "actor._id": { $in: strings } },
		],
	};
}

async function processByEditor(
	db: Db,
	editorIds: ObjectId[],
	bounds: PeriodBounds,
): Promise<{ source: ActivitySource; map: Map<string, ProcessBucket> }> {
	if (editorIds.length === 0) {
		return { source: "audit_log", map: new Map() };
	}

	const audit = await db
		.collection("audit_log")
		.aggregate<{
			_id: unknown;
			processed: number;
			revision: number;
			articleIds: unknown[];
		}>([
			{
				$match: {
					entity: "articles",
					createdAt: { $gte: bounds.start, $lt: bounds.end },
					action: { $in: [...EDITOR_PROCESS_ACTIONS] },
					...actorIdMatch(editorIds),
				},
			},
			{
				$group: {
					_id: "$actor._id",
					processed: {
						$sum: {
							$cond: [
								{ $in: ["$action", ["PUBLISH", "SCHEDULE"]] },
								1,
								0,
							],
						},
					},
					revision: {
						$sum: {
							$cond: [
								{
									$or: [
										{ $eq: ["$action", "REJECT"] },
										{
											$and: [
												{ $eq: ["$meta.statusFrom", "PENDING_REVIEW"] },
												{ $in: ["$meta.statusTo", ["DRAFT", "REJECTED"]] },
											],
										},
									],
								},
								1,
								0,
							],
						},
					},
					articleIds: {
						$addToSet: {
							$cond: [
								{ $in: ["$action", ["PUBLISH", "SCHEDULE"]] },
								"$entityId",
								"$$REMOVE",
							],
						},
					},
				},
			},
		])
		.toArray();

	if (audit.length > 0) {
		const map = new Map<string, ProcessBucket>();
		for (const row of audit) {
			if (row._id == null) continue;
			const articleIds = (row.articleIds || [])
				.map((id) => toObjectIdOrNull(id))
				.filter((id): id is ObjectId => id != null);
			map.set(String(row._id), {
				processed: row.processed || 0,
				revision: row.revision || 0,
				articleIds,
			});
		}
		if (map.size > 0) {
			return { source: "audit_log", map };
		}
	}

	const legacy = await db
		.collection("editor_activities")
		.aggregate<{
			_id: ObjectId;
			processed: number;
			revision: number;
			articleIds: ObjectId[];
		}>([
			{
				$match: {
					userId: { $in: editorIds },
					timestamp: { $gte: bounds.start, $lt: bounds.end },
					deletedAt: { $in: [null, ""] },
				},
			},
			{
				$group: {
					_id: "$userId",
					processed: {
						$sum: {
							$cond: [
								{
									$in: ["$statusTo", ["PUBLISHED", "SCHEDULED", "APPROVED"]],
								},
								1,
								0,
							],
						},
					},
					revision: {
						$sum: {
							$cond: [
								{
									$and: [
										{ $eq: ["$statusFrom", "PENDING_REVIEW"] },
										{ $in: ["$statusTo", ["DRAFT", "REJECTED"]] },
									],
								},
								1,
								0,
							],
						},
					},
					articleIds: {
						$addToSet: {
							$cond: [
								{
									$in: ["$statusTo", ["PUBLISHED", "SCHEDULED", "APPROVED"]],
								},
								"$articleId",
								"$$REMOVE",
							],
						},
					},
				},
			},
		])
		.toArray();

	const map = new Map<string, ProcessBucket>();
	for (const row of legacy) {
		if (row._id == null) continue;
		map.set(String(row._id), {
			processed: row.processed || 0,
			revision: row.revision || 0,
			articleIds: (row.articleIds || []).filter(Boolean),
		});
	}
	return { source: "editor_activities", map };
}

async function siteSlaMetrics(
	db: Db,
	bounds: PeriodBounds,
	targetSlaMinutes: number,
): Promise<{ avgMinutes: number; complianceRate: number }> {
	const rows = await db
		.collection("articles")
		.aggregate<{
			avgMinutes: number | null;
			total: number;
			compliant: number;
		}>([
			{
				$match: {
					status: "PUBLISHED",
					publishedAt: { $gte: bounds.start, $lt: bounds.end },
					submittedAt: { $ne: null },
					deletedAt: { $in: [null, ""] },
				},
			},
			{
				$project: {
					slaMinutes: {
						$divide: [{ $subtract: ["$publishedAt", "$submittedAt"] }, 60000],
					},
				},
			},
			{
				$group: {
					_id: null,
					avgMinutes: { $avg: "$slaMinutes" },
					total: { $sum: 1 },
					compliant: {
						$sum: {
							$cond: [{ $lte: ["$slaMinutes", targetSlaMinutes] }, 1, 0],
						},
					},
				},
			},
		])
		.toArray();

	const row = rows[0];
	if (!row || !row.total) {
		return { avgMinutes: 0, complianceRate: 0 };
	}
	return {
		avgMinutes: roundNumber(row.avgMinutes || 0, 1),
		complianceRate: safePercent(row.compliant, row.total),
	};
}

/**
 * Hide-zero rule for writer KPI rows (behavior-based).
 */
export function writerRowHasActivity(row: {
	articlePublishedThisMonth: number;
	pageViewsThisMonth: number;
	submittedCount: number;
	rejectedCount: number;
}): boolean {
	return (
		row.articlePublishedThisMonth > 0 ||
		row.pageViewsThisMonth > 0 ||
		row.submittedCount > 0 ||
		row.rejectedCount > 0
	);
}

/**
 * Hide-zero rule for editor KPI rows (behavior-based).
 */
export function editorRowHasActivity(row: {
	articlesProcessedThisMonth: number;
	articlesRevisionCountThisMonth: number;
	totalDraftsReviewedThisMonth: number;
}): boolean {
	return (
		row.articlesProcessedThisMonth > 0 ||
		row.articlesRevisionCountThisMonth > 0 ||
		row.totalDraftsReviewedThisMonth > 0
	);
}

export function compareWritersByPublishedDesc(
	a: { articlePublishedThisMonth: number; user: { name: string } },
	b: { articlePublishedThisMonth: number; user: { name: string } },
): number {
	if (b.articlePublishedThisMonth !== a.articlePublishedThisMonth) {
		return b.articlePublishedThisMonth - a.articlePublishedThisMonth;
	}
	return a.user.name.localeCompare(b.user.name, "id-ID");
}

export function compareEditorsByProcessedDesc(
	a: { articlesProcessedThisMonth: number; user: { name: string } },
	b: { articlesProcessedThisMonth: number; user: { name: string } },
): number {
	if (b.articlesProcessedThisMonth !== a.articlesProcessedThisMonth) {
		return b.articlesProcessedThisMonth - a.articlesProcessedThisMonth;
	}
	return a.user.name.localeCompare(b.user.name, "id-ID");
}

/**
 * KPI Penulis — behavior-based: anyone with authorId on articles active in period.
 * Individual monthly targets stay unset — site GLOBAL target is context only.
 */
export async function getKPIWriterTeam(
	db: Db,
	{ period, search, scopedUserIds }: ScopeOptions,
): Promise<KPIWriterTeamResponse[]> {
	const activePeriod = resolvePeriod(period);
	const bounds = getMonthBoundsWib(activePeriod);
	const { previous } = getPreviousMonthBoundsWib(activePeriod);

	const discoveredIds = await discoverAuthorIdsInPeriod(
		db,
		bounds,
		scopedUserIds,
	);
	if (discoveredIds.length === 0) return [];

	const users = await loadUserProfilesByIds(db, discoveredIds, {
		search,
		fallbackSource: "author",
	});
	if (users.length === 0) return [];

	const authorIds = users
		.map((u) => toObjectIdOrNull(u._id))
		.filter((id): id is ObjectId => id != null);

	const sitePublishTargetValue = await fetchGlobalTargetValue(
		db,
		activePeriod,
		"ARTICLES_PUBLISHED",
	);
	const siteTarget = buildSiteTargetDisplay(0, sitePublishTargetValue);
	const individualTarget = buildIndividualTarget(sitePublishTargetValue);

	const [publishedMap, publishedPrevMap, pageviewsMap, revision] =
		await Promise.all([
			countPublishedByAuthor(db, authorIds, bounds),
			countPublishedByAuthor(db, authorIds, previous),
			pageviewsByAuthor(db, authorIds, bounds),
			revisionByAuthor(db, authorIds, bounds),
		]);

	logger.info(
		{
			period: activePeriod,
			writers: users.length,
			activitySource: revision.source,
		},
		"KPI writers aggregated (behavior-based)",
	);

	const results: KPIWriterTeamResponse[] = users
		.map((user) => {
			const userId = String(user._id);
			const published = publishedMap.get(userId) || 0;
			const publishedPrev = publishedPrevMap.get(userId) || 0;
			const pageViewsThisMonth = pageviewsMap.get(userId) || 0;
			const rev = revision.map.get(userId) || { submitted: 0, rejected: 0 };
			const viewsPerArticle =
				published > 0 ? roundNumber(pageViewsThisMonth / published, 1) : 0;

			return {
				userId,
				user: toUserProfile(user),
				period: activePeriod,
				articlePublishedThisMonth: published,
				monthlyTargetArticles: 0,
				targetAchievementRate: 0,
				individualTarget,
				pageViewsThisMonth,
				viewsPerArticle,
				contributionShare: 0, // filled after hide-zero filter
				monthlyRevisionRate: safePercent(rev.rejected, rev.submitted),
				submittedCount: rev.submitted,
				rejectedCount: rev.rejected,
				momPublished: momGrowthRate(published, publishedPrev),
				dataFreshness: { activitySource: revision.source },
				siteTargetStatus: siteTarget.status,
			};
		})
		.filter(writerRowHasActivity);

	const totalPublished = results.reduce(
		(sum, row) => sum + row.articlePublishedThisMonth,
		0,
	);
	for (const row of results) {
		row.contributionShare = safePercent(
			row.articlePublishedThisMonth,
			totalPublished,
		);
	}

	results.sort(compareWritersByPublishedDesc);

	return results;
}

/**
 * KPI Editor — behavior-based: anyone who processed articles in audit_log.
 * Process/revision prefer audit_log; SLA from processed article timestamps.
 */
export async function getKPIEditor(
	db: Db,
	{ period, search, scopedUserIds }: ScopeOptions,
): Promise<KPIEditorResponse[]> {
	const activePeriod = resolvePeriod(period);
	const bounds = getMonthBoundsWib(activePeriod);

	const discoveredIds = await discoverEditorIdsInPeriod(
		db,
		bounds,
		scopedUserIds,
	);
	if (discoveredIds.length === 0) return [];

	const editors = await loadUserProfilesByIds(db, discoveredIds, {
		search,
		fallbackSource: "editor",
	});
	if (editors.length === 0) return [];

	const editorIds = editors
		.map((u) => toObjectIdOrNull(u._id))
		.filter((id): id is ObjectId => id != null);

	const [processTargetValue, slaTargetValue] = await Promise.all([
		fetchGlobalTargetValue(db, activePeriod, "ARTICLES_TO_PROCESS"),
		fetchGlobalTargetValue(db, activePeriod, "PROCESSING_TIME_SLA_MINUTES"),
	]);
	const targetSlaMinutes = slaTargetValue ?? DEFAULT_SLA_MINUTES;
	const individualTarget = buildIndividualTarget(processTargetValue);

	const process = await processByEditor(db, editorIds, bounds);

	const allArticleIds = [
		...new Set(
			[...process.map.values()].flatMap((b) =>
				b.articleIds.map((id) => String(id)),
			),
		),
	]
		.map((id) => toObjectIdOrNull(id))
		.filter((id): id is ObjectId => id != null);

	const articlesWithTiming = allArticleIds.length
		? await db
				.collection("articles")
				.find(
					{
						_id: { $in: allArticleIds },
						submittedAt: { $ne: null },
						publishedAt: { $ne: null },
					},
					{ projection: { _id: 1, submittedAt: 1, publishedAt: 1 } },
				)
				.toArray()
		: [];

	const timingByArticle = new Map(
		articlesWithTiming.map((a) => [
			String(a._id),
			{
				minutes:
					(new Date(a.publishedAt).getTime() -
						new Date(a.submittedAt).getTime()) /
					60000,
			},
		]),
	);

	logger.info(
		{
			period: activePeriod,
			editors: editors.length,
			activitySource: process.source,
		},
		"KPI editors aggregated (behavior-based)",
	);

	const results: KPIEditorResponse[] = editors
		.map((editor) => {
			const userId = String(editor._id);
			const bucket = process.map.get(userId) || {
				processed: 0,
				revision: 0,
				articleIds: [],
			};
			const totalDraftsReviewedThisMonth = bucket.processed + bucket.revision;

			let totalMinutes = 0;
			let timedCount = 0;
			let compliant = 0;
			for (const articleId of bucket.articleIds) {
				const timing = timingByArticle.get(String(articleId));
				if (!timing || !Number.isFinite(timing.minutes)) continue;
				totalMinutes += timing.minutes;
				timedCount += 1;
				if (timing.minutes <= targetSlaMinutes) compliant += 1;
			}

			return {
				userId,
				user: toUserProfile(editor),
				period: activePeriod,
				articlesProcessedThisMonth: bucket.processed,
				monthlyTargetProcess: 0,
				targetAchievementRate: 0,
				individualTarget,
				totalDraftsReviewedThisMonth,
				articlesRevisionCountThisMonth: bucket.revision,
				editorStrictnessRate: safePercent(
					bucket.revision,
					totalDraftsReviewedThisMonth,
				),
				avgProcessingTimeMinutes:
					timedCount > 0 ? Math.round(totalMinutes / timedCount) : 0,
				targetSlaMinutes,
				slaComplianceRate: safePercent(compliant, timedCount),
				dataFreshness: { activitySource: process.source },
			};
		})
		.filter(editorRowHasActivity);

	results.sort(compareEditorsByProcessedDesc);

	return results;
}

/**
 * Macro strip + alerts for the KPI page (org-level, monthly).
 */
export async function getKPISummary(
	db: Db,
	{ period }: { period?: string } = {},
): Promise<KPISummaryResponse> {
	const activePeriod = resolvePeriod(period);
	const bounds = getMonthBoundsWib(activePeriod);

	const [sitePublishTargetValue, slaTargetValue] = await Promise.all([
		fetchGlobalTargetValue(db, activePeriod, "ARTICLES_PUBLISHED"),
		fetchGlobalTargetValue(db, activePeriod, "PROCESSING_TIME_SLA_MINUTES"),
	]);
	const targetSlaMinutes = slaTargetValue ?? DEFAULT_SLA_MINUTES;

	const [published, pageviews, pendingReview, authorPublished, slaResolved] =
		await Promise.all([
			db.collection("articles").countDocuments({
				status: "PUBLISHED",
				publishedAt: { $gte: bounds.start, $lt: bounds.end },
				deletedAt: { $in: [null, ""] },
			}),
			countSitePageviews(db, bounds),
			db.collection("articles").countDocuments({
				status: "PENDING_REVIEW",
				deletedAt: { $in: [null, ""] },
			}),
			db
				.collection("articles")
				.aggregate<{ _id: ObjectId; count: number }>([
					{
						$match: {
							status: "PUBLISHED",
							publishedAt: { $gte: bounds.start, $lt: bounds.end },
							deletedAt: { $in: [null, ""] },
						},
					},
					{ $group: { _id: "$authorId", count: { $sum: 1 } } },
					{ $sort: { count: -1 } },
					{ $limit: 1 },
				])
				.toArray(),
			siteSlaMetrics(db, bounds, targetSlaMinutes),
		]);

	const top1Count = authorPublished[0]?.count || 0;
	const concentrationTop1 = safePercent(top1Count, published);
	const sitePublishTarget = buildSiteTargetDisplay(
		published,
		sitePublishTargetValue,
	);
	const viewsPerArticle =
		published > 0 ? roundNumber(pageviews / published, 1) : 0;

	const alerts: KPISummaryResponse["alerts"] = [];

	if (sitePublishTarget.status === "unset") {
		alerts.push({
			type: "target_unset",
			severity: "info",
			message: "Target terbit site (GLOBAL) belum diset untuk periode ini.",
		});
	} else if (
		sitePublishTarget.achievementRate != null &&
		sitePublishTarget.achievementRate < 50
	) {
		alerts.push({
			type: "site_target_behind",
			severity: "warning",
			message: `Pencapaian target terbit site ${sitePublishTarget.achievementRate}% — di bawah 50%.`,
		});
	}

	if (concentrationTop1 >= 50 && published > 0) {
		alerts.push({
			type: "concentration",
			severity: "critical",
			message: `Konsentrasi tinggi: 1 penulis menyumbang ${concentrationTop1}% output.`,
		});
	}

	if (pendingReview >= 10) {
		alerts.push({
			type: "pending_review",
			severity: pendingReview >= 25 ? "critical" : "warning",
			message: `${pendingReview} naskah masih menunggu review.`,
		});
	}

	if (slaResolved.complianceRate > 0 && slaResolved.complianceRate < 70) {
		alerts.push({
			type: "sla_compliance",
			severity: "warning",
			message: `SLA compliance ${slaResolved.complianceRate}% (target ≤ ${targetSlaMinutes} menit).`,
		});
	}

	return {
		period: activePeriod,
		published,
		pageviews,
		viewsPerArticle,
		avgSlaMinutes: slaResolved.avgMinutes,
		slaComplianceRate: slaResolved.complianceRate,
		targetSlaMinutes,
		sitePublishTarget,
		concentrationTop1,
		pendingReview,
		alerts,
	};
}
