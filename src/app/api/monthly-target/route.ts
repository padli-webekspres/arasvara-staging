import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/db";
import { getUserFromRequest } from "@/lib/auth";
import { ROLES } from "@/lib/auth-client";
import {
  getMonthlyTargets,
  bulkUpsertMonthlyTargets,
  UpsertTargetItem,
} from "@/services/monthlyTargetService";

// ─────────────────────────────────────────────────────────────────────────────
// Role yang diizinkan untuk mengelola Monthly Target KPI
// ─────────────────────────────────────────────────────────────────────────────
const ALLOWED_ROLES = [ROLES.ADMIN, ROLES.EDITOR_IN_CHIEF, ROLES.MANAGING_EDITOR];

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/monthly-target?period=YYYY-MM
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ambil semua target bulanan untuk satu periode tertentu.
 *
 * Query params:
 * - period (required): Format "YYYY-MM" (contoh: "2026-06")
 *
 * Tidak memerlukan autentikasi (data bersifat internal dan dibaca oleh admin).
 * Namun bisa dibatasi jika diperlukan.
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const period = url.searchParams.get("period");

    // Validasi query param
    if (!period) {
      return NextResponse.json(
        { error: "Parameter 'period' wajib diisi (format: YYYY-MM)." },
        { status: 400 },
      );
    }

    const db = await connectToDatabase();
    const targets = await getMonthlyTargets(db, period);

    return NextResponse.json({ data: targets, period });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Terjadi kesalahan server." },
      { status: err?.status || 500 },
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/monthly-target
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Simpan (upsert/hapus) seluruh target bulanan secara batch untuk satu periode.
 *
 * Body JSON yang diharapkan:
 * {
 *   period: "YYYY-MM",
 *   items: [
 *     {
 *       key: MonthlyTargetKey,
 *       value: string,          // kosong = hapus target
 *       scopeType: TargetScopeType,
 *       categoryId?: string     // wajib jika scopeType === "CHANNEL"
 *     },
 *     ...
 *   ]
 * }
 *
 * Memerlukan autentikasi dan role yang diizinkan (admin / editor-in-chief / managing-editor).
 */
export async function POST(req: NextRequest) {
  try {
    // ── Autentikasi ──────────────────────────────────────────────────────────
    const user = await getUserFromRequest(req);

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized: silakan login terlebih dahulu." },
        { status: 401 },
      );
    }

    const userRole = user.role?.toLowerCase?.() || user.role;
    if (!ALLOWED_ROLES.includes(userRole)) {
      return NextResponse.json(
        { error: "Forbidden: Anda tidak memiliki akses untuk mengubah target KPI." },
        { status: 403 },
      );
    }

    // ── Parsing Body ─────────────────────────────────────────────────────────
    let body: { period?: string; items?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Body request tidak valid (bukan JSON yang benar)." },
        { status: 400 },
      );
    }

    const { period, items } = body;

    // Validasi period
    if (!period || typeof period !== "string") {
      return NextResponse.json(
        { error: "Field 'period' wajib diisi dan harus berupa string (format: YYYY-MM)." },
        { status: 400 },
      );
    }

    // Validasi items
    if (!Array.isArray(items)) {
      return NextResponse.json(
        { error: "Field 'items' harus berupa array." },
        { status: 400 },
      );
    }

    if (items.length === 0) {
      return NextResponse.json(
        { error: "Field 'items' tidak boleh berupa array kosong." },
        { status: 400 },
      );
    }

    // ── Validasi Struktur Setiap Item ─────────────────────────────────────────
    const validItems: UpsertTargetItem[] = [];
    const invalidItems: { index: number; reason: string }[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      if (!item || typeof item !== "object") {
        invalidItems.push({ index: i, reason: "Item bukan objek." });
        continue;
      }

      const o = item as Record<string, unknown>;

      // Validasi field yang wajib ada
      if (typeof o.key !== "string") {
        invalidItems.push({ index: i, reason: "Field 'key' wajib berupa string." });
        continue;
      }

      if (typeof o.scopeType !== "string") {
        invalidItems.push({ index: i, reason: "Field 'scopeType' wajib berupa string." });
        continue;
      }

      if (typeof o.value !== "string") {
        invalidItems.push({ index: i, reason: "Field 'value' wajib berupa string." });
        continue;
      }

      validItems.push({
        key: o.key as any,
        value: o.value,
        scopeType: o.scopeType as any,
        categoryId: typeof o.categoryId === "string" ? o.categoryId : undefined,
      });
    }

    // Jika terlalu banyak item tidak valid, hentikan
    if (invalidItems.length > 0 && validItems.length === 0) {
      return NextResponse.json(
        {
          error: "Seluruh item dalam payload tidak valid.",
          invalidItems,
        },
        { status: 400 },
      );
    }

    // ── Eksekusi Service ───────────────────────────────────────────────────────
    const db = await connectToDatabase();

    const result = await bulkUpsertMonthlyTargets(db, period, validItems);

    return NextResponse.json(
      {
        message: "Target bulanan berhasil diperbarui.",
        period,
        result: {
          upserted: result.upserted,
          deleted: result.deleted,
          skipped: result.skipped + invalidItems.length,
        },
        ...(invalidItems.length > 0 && { warnings: invalidItems }),
      },
      { status: 200 },
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Terjadi kesalahan server internal." },
      { status: err?.status || 500 },
    );
  }
}
