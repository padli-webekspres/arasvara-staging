import { Db, ObjectId } from "mongodb";
import {
	KPIWriterTeamResponse,
	KPIEditorResponse,
} from "@/types/reports/kpiUser";
import { UserProfile } from "@/types/user";
import logger from "@/lib/logger";
import { MonthlyTargetKey } from "@/types/monthlyTarget";
import { ROLES } from "@/lib/auth-client";

/**
 * Mengambil data KPI untuk Tim Penulis (Reporter, Writer, Contributor).
 *
 * Fungsi ini mengagregasi metrik performa untuk semua penulis (reporter, writer, contributor)
 * tanpa memisahkan per role, tetapi mecocokkan target bulanan setiap user dengan role-nya masing-masing.
 *
 * Metrik yang dihitung per penulis:
 * - `articlePublishedThisMonth`: Jumlah artikel berstatus PUBLISHED yang diterbitkan di periode ini.
 * - `monthlyTargetArticles`: Target bulanan yang sesuai dengan role user, diambil dari collection monthly_targets.
 *   Jika target role-spesifik tidak ada, fallback ke target global (role: null).
 * - `targetAchievementRate`: Persentase pencapaian target (articlePublished / monthlyTarget * 100), capped di 100%.
 * - `pageViewsThisMonth`: Total views dari ArticleView di periode ini (bukan lifetime viewCount dari Article).
 * - `monthlyRevisionRate`: Rasio draf yang dikembalikan / draf yang diajukan, dari collection EditorActivity.
 *   Jika tidak ada draf diajukan, nilai 0.
 *
 * @param db - Instance MongoDB Db
 * @param period - Format "YYYY-MM" (contoh: "2026-03"). Default: bulan saat ini jika kosong.
 * @param search - Filter nama penulis, case-insensitive (opsional).
 * @returns Array KPIWriterTeamResponse, diurutkan dari artikel terbanyak ke terendah.
 */
export async function getKPIWriterTeam(
	db: Db,
	{ period, search }: { period?: string; search?: string },
): Promise<KPIWriterTeamResponse[]> {
	// ── Resolve periode yang digunakan ───────────────────────────────────────
	// Jika period tidak disediakan, gunakan bulan dan tahun saat ini
	const activePeriod = period || new Date().toISOString().slice(0, 7); // "YYYY-MM"

	const [yearStr, monthStr] = activePeriod.split("-");
	const year = parseInt(yearStr, 10);
	const month = parseInt(monthStr, 10);

	// Buat rentang tanggal awal dan akhir periode untuk filter DB
	const periodStart = new Date(year, month - 1, 1); // Awal bulan
	const periodEnd = new Date(year, month, 1); // Awal bulan berikutnya (exclusive)

	// ── Langkah 1: Ambil semua user dengan role penulis (reporter, writer, contributor) ──
	// Tidak ada pemisahan per role; semua penulis diambil, target cocokkan per user.role nanti.
	const writerRoles = ["reporter", "writer", "contributor"];
	const userQuery: Record<string, unknown> = {
		role: { $in: writerRoles },
		deletedAt: { $in: [null, ""] }, // Hanya user yang aktif (belum dihapus)
	};

	if (search && search.trim().length >= 2) {
		// Filter nama secara case-insensitive, minimum 2 karakter
		userQuery.name = { $regex: search, $options: "i" };
	}

	// Ambil semua field yang diperlukan untuk UserProfile lengkap
	const users = await db
		.collection("users")
		.find(userQuery, {
			projection: {
				_id: 1,
				name: 1,
				email: 1,
				avatar: 1,
				role: 1,
				teamId: 1,
				team: 1,
			},
		})
		.toArray();

	logger.info(
		{ userCount: users, search },
		"Fetched users for KPI Writer Team calculation",
	);

	if (users.length === 0) {
		return [];
	}

	// Kumpulkan semua userId untuk digunakan sebagai filter artikel
	const userIds = users.map((u) => new ObjectId(u._id));

	// ── Langkah 2: Ambil target artikel bulanan dari target global ───────────────────────
	// Mengingat data target bulanan di database disimpan dengan scopeType: "GLOBAL"
	// dan tidak memisahkan berdasarkan role penulis, kita ambil target global langsung.
	const globalTargetDoc = await db.collection("monthly_targets").findOne({
		key: "ARTICLES_PUBLISHED",
		period: activePeriod,
		scopeType: "GLOBAL",
	});
	const globalPublishTarget = globalTargetDoc?.value ?? 0;

	// Petakan target global ini ke semua role penulis (reporter, writer, contributor)
	const targetsByRole = new Map<string, number>();
	for (const writerRole of writerRoles) {
		targetsByRole.set(writerRole, globalPublishTarget);
	}

	// ── Langkah 3A: Agregasi Artikel untuk menghitung articlePublishedThisMonth ─────────
	// Hanya hitung artikel PUBLISHED di periode yang ditetapkan
	const articleAggregation = await db
		.collection("articles")
		.aggregate([
			{
				$match: {
					authorId: { $in: userIds },
					deletedAt: { $in: [null, ""] }, // Hanya artikel yang aktif (belum dihapus)
					status: "PUBLISHED",
					publishedAt: {
						$gte: periodStart,
						$lt: periodEnd,
					},
				},
			},
			{
				$group: {
					_id: "$authorId",
					articlePublishedThisMonth: { $sum: 1 },
				},
			},
		])
		.toArray();

	const articleMetricsMap = new Map(
		articleAggregation
			.filter((doc) => doc._id != null)
			.map((doc) => [doc._id.toString(), doc]),
	);

	// ── Langkah 3B: Agregasi ArticleView untuk menghitung pageViewsThisMonth ──────────
	// Views spesifik bulan, bukan lifetime viewCount dari Article
	const articleViewAggregation = await db
		.collection("article_views")
		.aggregate([
			{
				// 1. Filter views di bulan ini
				$match: {
					viewedAt: { $gte: periodStart, $lt: periodEnd },
					deletedAt: { $in: [null, ""] },
				},
			},
			{
				// 2. HITUNG DULU per artikel (Ini yang menyelamatkan performa!)
				$group: {
					_id: "$articleId",
					totalViewsPerArticle: { $sum: 1 },
				},
			},
			{
				// 3. Baru lookup ke articles untuk mencari tahu siapa penulisnya
				$lookup: {
					from: "articles",
					localField: "_id",
					foreignField: "_id",
					as: "article",
				},
			},
			{ $unwind: "$article" },
			{
				// 4. Group ulang berdasarkan authorId penulisnya
				$group: {
					_id: "$article.authorId",
					pageViewsThisMonth: { $sum: "$totalViewsPerArticle" }, // Jumlahkan views yang sudah dihitung tadi
				},
			},
		])
		.toArray();

	const articleViewMetricsMap = new Map(
		articleViewAggregation
			.filter((doc) => doc._id != null)
			.map((doc) => [doc._id.toString(), doc.pageViewsThisMonth]),
	);

	// ── Langkah 3C: Agregasi EditorActivity untuk menghitung monthlyRevisionRate ──────
	// Hitung: draf diajukan (status → PENDING_REVIEW) dan draf dikembalikan
	// (status PENDING_REVIEW → REJECTED) per authorId
	const editorActivityAggregation = await db
		.collection("editor_activities")
		.aggregate([
			{
				// Filter: hanya aktivitas di periode yang ditetapkan
				$match: {
					timestamp: {
						$gte: periodStart,
						$lt: periodEnd,
					},
					deletedAt: { $in: [null, ""] },
				},
			},
			{
				$group: {
					_id: "$authorId",

					// Draf yang diajukan: status berubah menjadi PENDING_REVIEW
					submittedCount: {
						$sum: {
							$cond: [{ $eq: ["$statusTo", "PENDING_REVIEW"] }, 1, 0],
						},
					},
					// Draf yang dikembalikan: status dari PENDING_REVIEW ke REJECTED
					rejectedCount: {
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

	logger.info(
		{ editorActivityAggregation },
		"editorActivityAggregation results for KPI calculation",
	);

	const editorActivityMetricsMap = new Map(
		editorActivityAggregation
			.filter((doc) => doc._id != null)
			.map((doc) => [
				doc._id.toString(),
				{
					submittedCount: doc.submittedCount,
					rejectedCount: doc.rejectedCount,
				},
			]),
	);

	// ── Langkah 4: Mapping data dengan perhitungan KPI per user ─────────────────────
	// Gabungkan data dari artikel, article_views, dan editor_activity dengan targets per role
	const results: KPIWriterTeamResponse[] = users
		.map((user) => {
			const articleMetrics = articleMetricsMap.get(user._id.toString()) || {
				articlePublishedThisMonth: 0,
			};
			const pageViewsThisMonth =
				articleViewMetricsMap.get(user._id.toString()) || 0;
			const editorActivityMetrics = editorActivityMetricsMap.get(
				user._id.toString(),
			) || { submittedCount: 0, rejectedCount: 0 };

			// Ambil target per role dari Map
			const monthlyTargetArticles = targetsByRole.get(user.role) || 0;

			// Hitung monthlyRevisionRate (skala 0 - 100)
			const monthlyRevisionRate =
				editorActivityMetrics.submittedCount > 0
					? (editorActivityMetrics.rejectedCount /
						editorActivityMetrics.submittedCount) * 100
					: 0;

			// Hitung target achievement rate (skala 0 - 100)
			const targetAchievementRate =
				monthlyTargetArticles > 0
					? (articleMetrics.articlePublishedThisMonth / monthlyTargetArticles) * 100
					: 0;

			// Konstruksi UserProfile lengkap dari user object
			const userProfile: UserProfile = {
				_id: user._id.toString(),
				name: user.name,
				email: user.email,
				avatar: user.avatar,
				role: user.role,
				teamId: user.teamId,
				team: user.team,
			};

			return {
				userId: user._id.toString(),
				user: userProfile,
				period: activePeriod,
				articlePublishedThisMonth: articleMetrics.articlePublishedThisMonth,
				monthlyTargetArticles,
				targetAchievementRate: Math.round(targetAchievementRate * 100) / 100,
				pageViewsThisMonth,
				monthlyRevisionRate: Math.round(monthlyRevisionRate * 100) / 100,
				submittedCount: editorActivityMetrics.submittedCount,
				rejectedCount: editorActivityMetrics.rejectedCount,
			};
		})
		.sort((a, b) => a.user.name.localeCompare(b.user.name, "id-ID"));

	return results;
}

/**
 * Mengambil data KPI untuk Tim Editor.
 *
 * Fungsi ini mengagregasi metrik performa untuk semua editor dalam periode yang ditetapkan.
 *
 * Metrik yang dihitung per editor:
 * - `articlesProcessedThisMonth`: Jumlah artikel yang disetujui/dipublikasikan/dijadwalkan editor (dari EditorActivity).
 * - `monthlyTargetProcess`: Target artikel yang harus diproses bulan ini, ambil dari monthly_targets.
 * - `targetAchievementRate`: Persentase pencapaian target (articlesProcessed / monthlyTargetProcess * 100).
 * - `articlesRevisionCountThisMonth`: Berapa kali editor mengembalikan draf ke penulis.
 * - `totalDraftsReviewedThisMonth`: Total draf yang disentuh editor (processed + revision).
 * - `editorStrictnessRate`: Rasio ketetatan (revisionCount / totalDrafts * 100).
 * - `avgProcessingTimeMinutes`: Rata-rata menit untuk memproses satu artikel (submittedAt → publishedAt).
 * - `targetSlaMinutes`: Target maksimal menit pemrosesan dari monthly_targets.
 * - `slaComplianceRate`: Persentase artikel yang selesai dalam batas SLA.
 *
 * @param db - Instance MongoDB Db
 * @param options.period - Format "YYYY-MM" (contoh: "2026-03"). Default: bulan saat ini jika kosong.
 * @param options.search - Filter nama editor, case-insensitive (opsional).
 * @returns Array KPIEditorResponse, diurutkan dari nama A-Z (Indonesian localization).
 */
export async function getKPIEditor(
	db: Db,
	{ period, search }: { period?: string; search?: string },
): Promise<KPIEditorResponse[]> {
	// ── Resolve periode yang digunakan ───────────────────────────────────────
	// Jika period tidak disediakan, gunakan bulan dan tahun saat ini
	const activePeriod = period || new Date().toISOString().slice(0, 7); // Format: "YYYY-MM"

	const [yearStr, monthStr] = activePeriod.split("-");
	const year = parseInt(yearStr, 10);
	const month = parseInt(monthStr, 10);

	// Buat rentang tanggal untuk filter database
	const periodStart = new Date(year, month - 1, 1); // Awal bulan
	const periodEnd = new Date(year, month, 1); // Awal bulan berikutnya (exclusive)

	// ── Langkah 1: Ambil semua editor aktif ───────────────────────────────────
	const editorQuery: Record<string, unknown> = {
		role: "editor",
		deletedAt: { $in: [null, ""] }, // Hanya editor yang aktif
	};

	if (search && search.trim().length >= 2) {
		// Filter nama case-insensitive, minimum 2 karakter
		editorQuery.name = { $regex: search, $options: "i" };
	}

	const editors = await db
		.collection("users")
		.find(editorQuery, {
			projection: {
				_id: 1,
				name: 1,
				email: 1,
				avatar: 1,
				role: 1,
				teamId: 1,
				team: 1,
			},
		})
		.toArray();

	if (editors.length === 0) {
		logger.info({ search }, "No editors found for KPI calculation");
		return [];
	}

	// Kumpulkan semua editor ID untuk query nantinya
	const editorIds = editors.map((e) => new ObjectId(e._id));

	// ── Langkah 2: Ambil target bulanan dari target global (scopeType: "GLOBAL") ───────
	// Query 1: Target artikel yang harus diproses oleh editor secara global
	const processTargetDoc = await db.collection("monthly_targets").findOne({
		key: "ARTICLES_TO_PROCESS",
		period: activePeriod,
		scopeType: "GLOBAL",
	});
	const monthlyTargetProcess = processTargetDoc?.value ?? 0;

	// Query 2: Target SLA pemrosesan editor secara global (dalam menit)
	const slaTargetDoc = await db.collection("monthly_targets").findOne({
		key: "PROCESSING_TIME_SLA_MINUTES",
		period: activePeriod,
		scopeType: "GLOBAL",
	});
	const targetSlaMinutes = slaTargetDoc?.value ?? 120; // Default 120 menit (2 jam) jika tidak diset

	// ── Langkah 3: Agregasi EditorActivity untuk Produktivitas & Kualitas ─────
	// Hitung: artikel yang diproses (publish/schedule) dan yang dikembalikan (revisi)
	const editorActivityAggregation = await db
		.collection("editor_activities")
		.aggregate([
			{
				// Filter: hanya editor ini, periode ini, tidak dihapus
				$match: {
					userId: { $in: editorIds },
					timestamp: {
						$gte: periodStart,
						$lt: periodEnd,
					},
					deletedAt: { $in: [null, ""] },
				},
			},
			{
				$group: {
					_id: "$userId",

					// Diproses: terbit / jadwal (termasuk transisi lama ke APPROVED)
					articlesProcessedThisMonth: {
						$sum: {
							$cond: [
								{
									$in: [
										"$statusTo",
										[
											"PUBLISHED",
											"SCHEDULED",
											"APPROVED",
										],
									],
								},
								1,
								0,
							],
						},
					},

					// Hitung: berapa kali draf dikembalikan (PENDING_REVIEW → DRAFT/REJECTED)
					articlesRevisionCountThisMonth: {
						$sum: {
							$cond: [
								{
									$and: [
										{ $eq: ["$statusFrom", "PENDING_REVIEW"] },
										{
											$in: ["$statusTo", ["DRAFT", "REJECTED"]],
										},
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

	const editorActivityMetricsMap = new Map(
		editorActivityAggregation
			.filter((doc) => doc._id != null)
			.map((doc) => [
				doc._id.toString(),
				{
					articlesProcessedThisMonth: doc.articlesProcessedThisMonth,
					articlesRevisionCountThisMonth: doc.articlesRevisionCountThisMonth,
				},
			]),
	);

	logger.info(
		{
			editorActivityMetricsMap: Array.from(editorActivityMetricsMap.entries()),
		},
		"Editor activity metrics aggregated for KPI calculation",
	);

	// ── Langkah 4: Hitung SLA - Ambil artikelyang diproses untuk waktu pemrosesan ──
	// Aggregasi kompleks: dari EditorActivity → lookup Article → hitung SLA per editor
	const slaAggregation = await db
		.collection("editor_activities")
		.aggregate([
			{
				// Filter: hanya yang publish/schedule di periode ini
				$match: {
					userId: { $in: editorIds },
					statusTo: { $in: ["PUBLISHED", "SCHEDULED", "APPROVED"] },
					timestamp: {
						$gte: periodStart,
						$lt: periodEnd,
					},
					deletedAt: { $in: [null, ""] },
				},
			},
			{
				// Lookup artikel untuk dapat submittedAt dan publishedAt
				$lookup: {
					from: "articles",
					localField: "articleId",
					foreignField: "_id",
					as: "article",
				},
			},
			{ $unwind: { path: "$article", preserveNullAndEmptyArrays: true } },
			{
				$group: {
					_id: "$userId",

					// Hitung total artikel yang berhasil diproses
					totalProcessedArticles: { $sum: 1 },

					// Hitung artikel yang selesai dalam batas SLA
					slaComplianceCount: {
						$sum: {
							$cond: [
								{
									$and: [
										{
											$ne: ["$article.submittedAt", null],
										},
										{
											$ne: ["$article.publishedAt", null],
										},
										{
											// Hitung selisih waktu dalam menit
											$lte: [
												{
													$divide: [
														{
															$subtract: [
																"$article.publishedAt",
																"$article.submittedAt",
															],
														},
														60000, // Konversi milliseconds ke menit
													],
												},
												targetSlaMinutes,
											],
										},
									],
								},
								1,
								0,
							],
						},
					},

					// Hitung total waktu pemrosesan (untuk rata-rata)
					totalProcessingTimeMinutes: {
						$sum: {
							$cond: [
								{
									$and: [
										{
											$ne: ["$article.submittedAt", null],
										},
										{
											$ne: ["$article.publishedAt", null],
										},
									],
								},
								{
									$divide: [
										{
											$subtract: [
												"$article.publishedAt",
												"$article.submittedAt",
											],
										},
										60000,
									],
								},
								0,
							],
						},
					},

					// Hitung artikel dengan data lengkap (untuk pembagi rata-rata)
					articlesWithCompleteData: {
						$sum: {
							$cond: [
								{
									$and: [
										{
											$ne: ["$article.submittedAt", null],
										},
										{
											$ne: ["$article.publishedAt", null],
										},
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

	logger.info(
		{ slaAggregation },
		"SLA aggregation results for KPI calculation",
	);

	const slaMetricsMap = new Map(
		slaAggregation
			.filter((doc) => doc._id != null)
			.map((doc) => [
				doc._id.toString(),
				{
					totalProcessedArticles: doc.totalProcessedArticles,
					slaComplianceCount: doc.slaComplianceCount,
					totalProcessingTimeMinutes: doc.totalProcessingTimeMinutes,
					articlesWithCompleteData: doc.articlesWithCompleteData,
				},
			]),
	);

	logger.info(
		{ slaMetricsMap: Array.from(slaMetricsMap.entries()) },
		"SLA metrics aggregated for editors",
	);

	// ── Langkah 5: Mapping & Perhitungan KPI per editor ──────────────────────
	const results: KPIEditorResponse[] = editors
		.map((editor) => {
			// Ambil metrik dari agregasi
			const activityMetrics = editorActivityMetricsMap.get(
				editor._id.toString(),
			) || {
				articlesProcessedThisMonth: 0,
				articlesRevisionCountThisMonth: 0,
			};

			const slaMetrics = slaMetricsMap.get(editor._id.toString()) || {
				totalProcessedArticles: 0,
				slaComplianceCount: 0,
				totalProcessingTimeMinutes: 0,
				articlesWithCompleteData: 0,
			};

			// ─── Perhitungan Metrik Produktivitas ───────────────────────────────
			const targetAchievementRate =
				monthlyTargetProcess > 0
					? (activityMetrics.articlesProcessedThisMonth /
							monthlyTargetProcess) *
						100
					: 0;

			// ─── Perhitungan Metrik Kualitas ────────────────────────────────────
			const totalDraftsReviewedThisMonth =
				activityMetrics.articlesProcessedThisMonth +
				activityMetrics.articlesRevisionCountThisMonth;

			const editorStrictnessRate =
				totalDraftsReviewedThisMonth > 0
					? (activityMetrics.articlesRevisionCountThisMonth /
							totalDraftsReviewedThisMonth) *
						100
					: 0;

			// ─── Perhitungan Metrik SLA ────────────────────────────────────────
			// Rata-rata waktu pemrosesan per artikel (dalam menit)
			const avgProcessingTimeMinutes =
				slaMetrics.articlesWithCompleteData > 0
					? slaMetrics.totalProcessingTimeMinutes /
						slaMetrics.articlesWithCompleteData
					: 0;

			// Persentase artikel yang selesai dalam batas SLA (minutes)
			const slaComplianceRate =
				slaMetrics.totalProcessedArticles > 0
					? (slaMetrics.slaComplianceCount /
							slaMetrics.totalProcessedArticles) *
						100
					: 0;

			// ─── Konstruksi UserProfile ────────────────────────────────────────
			const userProfile: UserProfile = {
				_id: editor._id.toString(),
				name: editor.name,
				email: editor.email,
				avatar: editor.avatar,
				role: editor.role,
				teamId: editor.teamId,
				team: editor.team,
			};

			// ─── Return KPI Response ────────────────────────────────────────────
			return {
				userId: editor._id.toString(),
				user: userProfile,
				period: activePeriod,
				articlesProcessedThisMonth: activityMetrics.articlesProcessedThisMonth,
				monthlyTargetProcess,
				targetAchievementRate: Math.round(targetAchievementRate * 100) / 100,
				totalDraftsReviewedThisMonth,
				articlesRevisionCountThisMonth:
					activityMetrics.articlesRevisionCountThisMonth,
				editorStrictnessRate: Math.round(editorStrictnessRate * 100) / 100,
				avgProcessingTimeMinutes: Math.round(avgProcessingTimeMinutes),
				targetSlaMinutes,
				slaComplianceRate: Math.round(slaComplianceRate * 100) / 100,
			};
		})
		.sort((a, b) => a.user.name.localeCompare(b.user.name, "id-ID"));

	return results;
}
