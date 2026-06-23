import { Team } from "../team";
import { UserProfile } from "../user";

// Tab 1: Tim Penulis (REPORTER, WRITER, CONTRIBUTOR)
export interface KPIWriterTeamResponse {
	userId: string;
	user: UserProfile;
	period: string; // Format: "YYYY-MM" (contoh: "2026-03")

	// Metrik Produktivitas
	articlePublishedThisMonth: number; // Jumlah artikel yang berhasil dipublikasi bulan ini
	monthlyTargetArticles: number; // Target artikel yang ditetapkan Redpel untuk bulan ini
	targetAchievementRate: number; // Persentase pencapaian target (articlePublished / target * 100)

	// Metrik Kualitas & Engagement
	pageViewsThisMonth: number; // Total pembaca dari semua artikel yang diterbitkan bulan ini
	monthlyRevisionRate: number; // Rasio revisi (0-1): berapa kali draf dikembalikan editor / total draf diajukan

	// Number pending_reviews -> draft & draft -> pending_reviews
	submittedCount: number;
	rejectedCount: number;
}

// Tab 2: Tim Editor (EDITOR)
export interface KPIEditorResponse {
	userId: string;
	user: UserProfile;
	period: string; // Format: "YYYY-MM"

	// ─── Metrik Produktivitas & Target ─────────────────────────────────────
	articlesProcessedThisMonth: number; // Artikel yang di-approve oleh editor ini
	monthlyTargetProcess: number; // Diambil dari MonthlyTargetKey.ARTICLES_TO_PROCESS
	targetAchievementRate: number; // Persentase (articlesProcessedThisMonth / monthlyTargetProcess * 100)

	// ─── Metrik Kualitas (Quality Control) ─────────────────────────────────
	totalDraftsReviewedThisMonth: number; // Total draf yang masuk ke mejanya (Processed + Rejected)
	articlesRevisionCountThisMonth: number; // Berapa kali mengembalikan draf
	editorStrictnessRate: number; // Rasio ketetatan (Revision Count / Total Drafts Reviewed)

	// ─── Metrik Efisiensi & Kecepatan (SLA) ────────────────────────────────
	avgProcessingTimeMinutes: number; // menit kerja dari PENDING_REVIEW ke dipublikasikan / dijadwalkan
	targetSlaMinutes: number; // Diambil dari MonthlyTargetKey.PROCESSING_TIME_SLA_MINUTES (misal: 2 jam)
	slaComplianceRate: number; // Persentase draf yang diselesaikan LEBIH CEPAT atau SAMA DENGAN targetSlaMinutes
}

// Tab 3: Kepala Desk (HEAD_OF)
export interface KPIHeadOfResponse {
	userId: string; // ID milik Head Of
	user: UserProfile; // Profil lengkap Head Of
	role: "HEAD_OF";
	period: string; // Format: "YYYY-MM"

	// ─── Identitas Tim yang Dipimpin ────────────────────────────────────────
	teamId: string;
	team?: Team; // Misal: "Tim Hard News" atau "Tim Lifestyle"

	// ─── Metrik Produktivitas Tim (Kuantitas) ───────────────────────────────
	teamArticlesPublishedThisMonth: number; // Total gabungan artikel terbit dari SEMUA anggota tim ini
	targetTeamArticles: number; // Diambil dari MonthlyTargetKey.TEAM_ARTICLES
	articleAchievementRate: number; // Persentase (teamArticlesPublished / targetTeamArticles * 100)

	// ─── Metrik Dampak & Pertumbuhan Tim (Traffic) ──────────────────────────
	teamPageviewsThisMonth: number; // Total gabungan views dari SEMUA artikel milik tim ini bulan ini
	targetTeamPageviews: number; // Diambil dari MonthlyTargetKey.TEAM_PAGEVIEWS
	pageviewAchievementRate: number; // Persentase (teamPageviews / targetTeamPageviews * 100)
	pageviewsGrowthMoM: number; // Persentase pertumbuhan views tim ini dibanding bulan lalu (Tren)

	// ─── Metrik Kualitas Tim (Quality Control) ──────────────────────────────
	teamAvgRevisionRate: number; // Rata-rata revision rate dari seluruh penulis di dalam tim ini
}

// Tab 4: Tim Bisnis (ACCOUNT_EXECUTIVE)
// export interface KPIAccountExecutiveResponse {
// 	userId: string;
// 	user: UserProfile;
// 	role: "ACCOUNT_EXECUTIVE";
// 	sponsoredArticles: number; // Artikel Sponsor Terbit
// 	sponsoredPageviews: number; // Traffic Konten Sponsor
// }
