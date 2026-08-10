import { Team } from "../team";
import { UserProfile } from "../user";
import type { TargetDisplay } from "@/lib/analytics/metrics-core";

export type IndividualTargetState = {
	status: "unset" | "set";
	label: string;
	siteContextValue: number | null;
	siteContextLabel: string;
};

// Tab 1: Penulis (REPORTER, WRITER, CONTRIBUTOR) — API type remains writer_team
export interface KPIWriterTeamResponse {
	userId: string;
	user: UserProfile;
	period: string; // Format: "YYYY-MM" (contoh: "2026-03")

	// Metrik Produktivitas
	articlePublishedThisMonth: number;
	/** @deprecated Always 0 — individual target is never derived from GLOBAL site target */
	monthlyTargetArticles: number;
	/** @deprecated Always 0 when individual target unset */
	targetAchievementRate: number;
	individualTarget: IndividualTargetState;

	// Metrik Kualitas & Engagement
	pageViewsThisMonth: number;
	viewsPerArticle: number;
	contributionShare: number;
	monthlyRevisionRate: number;

	submittedCount: number;
	rejectedCount: number;
	momPublished: number | null;
	dataFreshness: { activitySource: "audit_log" | "editor_activities" };
	siteTargetStatus: "set" | "unset";
}

// Tab 2: Editor (EDITOR)
export interface KPIEditorResponse {
	userId: string;
	user: UserProfile;
	period: string;

	articlesProcessedThisMonth: number;
	/** @deprecated Always 0 — individual target unset */
	monthlyTargetProcess: number;
	/** @deprecated Always 0 when individual target unset */
	targetAchievementRate: number;
	individualTarget: IndividualTargetState;

	totalDraftsReviewedThisMonth: number;
	articlesRevisionCountThisMonth: number;
	editorStrictnessRate: number;

	avgProcessingTimeMinutes: number;
	targetSlaMinutes: number;
	slaComplianceRate: number;
	dataFreshness: { activitySource: "audit_log" | "editor_activities" };
}

export interface KPISummaryResponse {
	period: string;
	published: number;
	pageviews: number;
	viewsPerArticle: number;
	avgSlaMinutes: number;
	slaComplianceRate: number;
	targetSlaMinutes: number;
	sitePublishTarget: {
		status: "set" | "unset";
		value: number | null;
		scopeLabel: string;
		achievementRate: number | null;
	};
	concentrationTop1: number;
	pendingReview: number;
	alerts: Array<{
		type: string;
		severity: "info" | "warning" | "critical";
		message: string;
	}>;
}

/** Tab 3: Kanal/Rubrik — scorecard per root category vs CHANNEL targets */
export interface KPIChannelRow {
	categoryId: string;
	categoryName: string;
	categorySlug: string;
	period: string;
	articlesPublished: number;
	pageviews: number;
	viewsPerArticle: number;
	targets: {
		articles: TargetDisplay;
		pageviews: TargetDisplay;
	};
	momPublished: number | null;
	momPageviews: number | null;
}

export interface KPIChannelResponse {
	period: string;
	attribution: "consumption" | "publish_cohort";
	rows: KPIChannelRow[];
	dataFreshness: { computedAt: string };
}

/** @deprecated Team-based Head Of KPI removed — use KPIChannelRow */
export interface KPIHeadOfResponse {
	userId: string;
	user: UserProfile;
	role: "HEAD_OF";
	period: string;
	teamId: string;
	team?: Team;
	teamArticlesPublishedThisMonth: number;
	targetTeamArticles: number;
	articleAchievementRate: number;
	teamPageviewsThisMonth: number;
	targetTeamPageviews: number;
	pageviewAchievementRate: number;
	pageviewsGrowthMoM: number;
	teamAvgRevisionRate: number;
}
