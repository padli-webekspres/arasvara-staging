import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/db";
import { getUserFromRequest } from "@/lib/auth";
import logger from "@/lib/logger";
import {
	badRequestAnalyticsResponse,
	canAccessAggregateAnalytics,
	forbiddenAnalyticsResponse,
	isFullAnalyticsRole,
	resolveAnalyticsScopeUserIds,
	unauthorizedAnalyticsResponse,
} from "@/lib/analytics/analytics-auth";
import { isValidPeriodMonth } from "@/lib/analytics/metrics-core";
import {
	getKPIWriterTeam,
	getKPIEditor,
	getKPISummary,
} from "@/services/reports/kpiUserService";
import { getKPIChannel } from "@/services/reports/channelKpiService";

const VALID_TYPES = ["writer_team", "editor", "summary", "channel"] as const;
type KpiType = (typeof VALID_TYPES)[number];

export async function GET(req: NextRequest) {
	try {
		const user = await getUserFromRequest(req);
		if (!user) return unauthorizedAnalyticsResponse();
		if (!canAccessAggregateAnalytics(user)) return forbiddenAnalyticsResponse();

		const url = new URL(req.url);
		const type = url.searchParams.get("type") as KpiType | null;
		const search = url.searchParams.get("search") || undefined;
		const period = url.searchParams.get("period") || undefined;
		const attribution = url.searchParams.get("attribution") || undefined;

		if (!type || !VALID_TYPES.includes(type)) {
			return badRequestAnalyticsResponse(
				`Parameter 'type' wajib diisi. Nilai yang valid: ${VALID_TYPES.join(", ")}.`,
			);
		}

		if (!period) {
			return badRequestAnalyticsResponse("Parameter 'period' wajib diisi.");
		}

		if (!isValidPeriodMonth(period)) {
			return badRequestAnalyticsResponse(
				"Parameter 'period' harus dalam format YYYY-MM (contoh: 2026-03).",
			);
		}

		// Org-wide types require full analytics roles; writer_team + editor are self-scoped for Editor
		if (
			(type === "summary" || type === "channel") &&
			!isFullAnalyticsRole(user.role)
		) {
			return forbiddenAnalyticsResponse();
		}

		const db = await connectToDatabase();

		if (type === "summary") {
			const data = await getKPISummary(db, { period });
			logger.info({ msg: "KPI summary fetched", period });
			return NextResponse.json({ success: true, data });
		}

		if (type === "channel") {
			const data = await getKPIChannel(db, { period, attribution });
			logger.info({
				msg: "KPI channel fetched",
				period,
				rows: data.rows.length,
			});
			return NextResponse.json({ success: true, data });
		}

		const scope = await resolveAnalyticsScopeUserIds(db, user);
		const scopedUserIds = scope.mode === "all" ? null : scope.userIds;
		const options = { search, period, scopedUserIds };

		const result =
			type === "writer_team"
				? await getKPIWriterTeam(db, options)
				: await getKPIEditor(db, options);

		logger.info({
			msg: "KPI fetched successfully",
			type,
			period,
			resultCount: result.length,
		});

		// Keep returning array for writer_team / editor (compat with existing UI)
		return NextResponse.json(result);
	} catch (error: unknown) {
		const message = (error as Error)?.message || "Internal server error";
		if (
			message.includes("Invalid period") ||
			message.includes("Parameter") ||
			message.includes("attribution")
		) {
			return badRequestAnalyticsResponse(message);
		}
		logger.error({
			msg: "Error in GET /api/reports/kpi",
			error: message,
			stack: (error as Error)?.stack,
		});
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
