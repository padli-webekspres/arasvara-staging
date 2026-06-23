import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/db";
import { getUserFromRequest } from "@/lib/auth";
import logger from "@/lib/logger";
import { Db } from "mongodb";
import {
	getKPIWriterTeam,
	getKPIEditor,
} from "@/services/reports/kpiUserService";

// ┌─── Type-based KPI service handlers ──────────────────────────────────────┐
// │ Map type parameter ke service function yang sesuai                        │
// └──────────────────────────────────────────────────────────────────────────┘
const KPI_TYPE_HANDLERS: Record<
	string,
	(db: Db, options: { search?: string; period?: string }) => Promise<unknown>
> = {
	writer_team: async (db, options) => getKPIWriterTeam(db, options),
	editor: async (db, options) => getKPIEditor(db, options),
};

export async function GET(req: NextRequest) {
	try {
		// ─── Access Control ──────────────────────────────────────────────────────
		const user = await getUserFromRequest(req);
		if (!user) {
			return NextResponse.json(
				{ error: "Unauthorized: Authentication required." },
				{ status: 401 },
			);
		}

		// ─── Parse Query Parameters ─────────────────────────────────────────────
		const url = new URL(req.url);
		const type = url.searchParams.get("type");
		const search = url.searchParams.get("search") || undefined;
		const period =
			url.searchParams.get("period") || new Date().toISOString().slice(0, 7);

		// ─── Validasi: type parameter (wajib) ─────────────────────────────────────
		const validTypes = ["writer_team", "editor"];
		if (!type || typeof type !== "string" || !validTypes.includes(type)) {
			return NextResponse.json(
				{
					error: `Parameter 'type' wajib diisi. Nilai yang valid: ${validTypes.join(", ")}.`,
				},
				{ status: 400 },
			);
		}

		// validasi period wajib diisi
		if (!period) {
			return NextResponse.json(
				{
					error: "Parameter 'period' wajib diisi.",
				},
				{ status: 400 },
			);
		}

		// ─── Validasi: period format (YYYY-MM) ────────────────────────────────────
		const periodRegex = /^\d{4}-\d{2}$/;
		if (!periodRegex.test(period)) {
			return NextResponse.json(
				{
					error:
						"Parameter 'period' harus dalam format YYYY-MM (contoh: 2026-03).",
				},
				{ status: 400 },
			);
		}

		// ─── Connect Database ────────────────────────────────────────────────────
		const db = await connectToDatabase();

		// ─── Call Service Berdasarkan Type ────────────────────────────────────────
		const handler = KPI_TYPE_HANDLERS[type];
		if (!handler) {
			return NextResponse.json(
				{ error: `Tipe KPI '${type}' tidak dikenali.` },
				{ status: 400 },
			);
		}
		const options = { search, period };
		const result = await handler(db, options);
		logger.info({
			msg: "KPI fetched successfully",
			type,
			period,
			resultCount: Array.isArray(result) ? result.length : "unknown",
		});
		return NextResponse.json(result);
	} catch (error: unknown) {
		logger.error({
			msg: "Error in GET /api/reports/kpi",
			error: (error as Error)?.message,
			stack: (error as Error)?.stack,
		});
		return NextResponse.json(
			{ error: (error as Error)?.message || "Internal server error" },
			{ status: 500 },
		);
	}
}
