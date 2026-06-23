import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { canManageAdsHomepage } from "@/lib/ads-homepage-access";
import logger from "@/lib/logger";
import type {
  BulkUpsertAdsItem,
  BulkUpsertAdsPayload,
  CreateAdsHomepagePayload,
} from "@/types/ads";
import {
  AdsManagementService,
  GetHomepageAdsOptions,
} from "@/services/ads/AdsHomepageService";

// ─── Body parsers ─────────────────────────────────────────────────────────────

function parseBulkUpsertPayload(json: unknown): BulkUpsertAdsPayload | null {
  if (!json || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;

  if (typeof o.position !== "string" || !o.position.trim()) return null;
  if (!Array.isArray(o.items)) return null;

  const items: BulkUpsertAdsItem[] = [];

  for (const raw of o.items) {
    if (!raw || typeof raw !== "object") return null;
    const it = raw as Record<string, unknown>;

    const banner = it.banner as Record<string, unknown> | undefined;
    if (
      !banner ||
      typeof banner.url !== "string" ||
      typeof banner.filename !== "string" ||
      typeof banner.mimetype !== "string" ||
      typeof banner.size !== "number"
    ) {
      return null;
    }

    if (
      typeof it.name !== "string" ||
      !String(it.name).trim() ||
      typeof it.linkUrl !== "string" ||
      typeof it.order !== "number" ||
      (typeof it.startedAt !== "string" && !(it.startedAt instanceof Date)) ||
      (typeof it.endedAt !== "string" && !(it.endedAt instanceof Date))
    ) {
      return null;
    }

    const item: BulkUpsertAdsItem = {
      name: it.name.trim(),
      banner: {
        url: banner.url,
        filename: banner.filename,
        mimetype: banner.mimetype,
        size: banner.size,
      },
      linkUrl: it.linkUrl,
      order: it.order,
      startedAt: it.startedAt as string,
      endedAt: it.endedAt as string,
    };

    if (typeof it.serverId === "string") item.serverId = it.serverId;
    if (typeof it.variant === "string") item.variant = it.variant;
    if (typeof it.span === "number" && (it.span === 1 || it.span === 2)) {
      item.span = it.span;
    }
    if (typeof it.isActive === "boolean") item.isActive = it.isActive;

    items.push(item);
  }

  return { position: o.position.trim(), items };
}

function parseCreatePayload(json: unknown): CreateAdsHomepagePayload | null {
  if (!json || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;

  const banner = o.banner;
  if (!banner || typeof banner !== "object") return null;
  const b = banner as Record<string, unknown>;

  // linkUrl, position, startedAt, endedAt, name wajib; yang lain opsional
  if (
    typeof o.name !== "string" ||
    !o.name.trim() ||
    typeof o.linkUrl !== "string" ||
    typeof o.position !== "string" ||
    (typeof o.startedAt !== "string" && !(o.startedAt instanceof Date)) ||
    (typeof o.endedAt !== "string" && !(o.endedAt instanceof Date))
  ) {
    return null;
  }

  if (
    typeof b.url !== "string" ||
    typeof b.filename !== "string" ||
    typeof b.mimetype !== "string" ||
    typeof b.size !== "number"
  ) {
    return null;
  }

  const payload: CreateAdsHomepagePayload = {
    name: o.name.trim(),
    banner: {
      url: b.url,
      filename: b.filename,
      mimetype: b.mimetype,
      size: b.size,
    },
    linkUrl: o.linkUrl,
    position: o.position,
    startedAt: o.startedAt as string,
    endedAt: o.endedAt as string,
  };

  if (typeof o.variant === "string") payload.variant = o.variant;
  if (typeof o.span === "number" && (o.span === 1 || o.span === 2)) {
    payload.span = o.span;
  }
  if (typeof o.order === "number") payload.order = o.order;
  if (typeof o.isActive === "boolean") payload.isActive = o.isActive;
  if (typeof o.clicks === "number") payload.clicks = o.clicks;

  return payload;
}

// ─── Route handlers ───────────────────────────────────────────────────────────

/**
 * GET /api/ads/homepage
 *
 * Query params (semua opsional):
 * - `position` — filter posisi, mis. "headline"
 * - `isActive` — "true" | "false" (default: hanya aktif)
 * - `includeDeleted` — "true" | "false" (default: false)
 * - `page` — nomor halaman (default: 1)
 * - `limit` — jumlah per halaman (default: 50, maks: 200)
 *
 * Endpoint ini bersifat publik (tidak memerlukan autentikasi)
 * agar dapat dikonsumsi oleh halaman frontend.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const options: GetHomepageAdsOptions = {};

  const position = searchParams.get("position");
  if (position) options.position = position;

  const isActiveParam = searchParams.get("isActive");
  if (isActiveParam === "false") options.isActive = false;
  else if (isActiveParam === "true") options.isActive = true;

  const includeDeletedParam = searchParams.get("includeDeleted");
  if (includeDeletedParam === "true") options.includeDeleted = true;

  const filterByDateParam = searchParams.get("filterByDate");
  if (filterByDateParam === "true") options.filterByDate = true;

  const pageParam = parseInt(searchParams.get("page") ?? "1", 10);
  if (!isNaN(pageParam)) options.page = pageParam;

  const limitParam = parseInt(searchParams.get("limit") ?? "50", 10);
  if (!isNaN(limitParam)) options.limit = limitParam;

  try {
    const { ads, total } = await AdsManagementService.getHomepageAds(options);

    return NextResponse.json(
      {
        success: true,
        ads,
        total,
        page: options.page ?? 1,
        limit: options.limit ?? 50,
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    const err = error as Error & { status?: number };
    const status = typeof err.status === "number" ? err.status : 500;
    logger.error({ err }, "GET /api/ads/homepage failed");
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status },
    );
  }
}

/**
 * PUT /api/ads/homepage
 *
 * Bulk-upsert seluruh slot iklan untuk satu `position` secara atomik.
 *
 * - Item dengan `serverId` → update dokumen yang sudah ada.
 * - Item tanpa `serverId` → insert dokumen baru.
 * - Dokumen di DB untuk `position` yang tidak ada dalam `items` → soft-delete.
 *
 * Body wajib: `{ position, items: [{ banner, linkUrl, order, startedAt, endedAt, serverId? }] }`
 */
export async function PUT(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageAdsHomepage(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let payload: BulkUpsertAdsPayload | null;
  try {
    payload = parseBulkUpsertPayload(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!payload) {
    return NextResponse.json(
      {
        error:
          "Body tidak valid. Wajib: position (string), items (array of { name, banner, linkUrl, order, startedAt, endedAt }).",
      },
      { status: 400 },
    );
  }

  try {
    const actor = {
      _id: user._id,
      name: user.name ?? "",
      email: user.email ?? "",
    };
    const ads = await AdsManagementService.bulkUpsertHomepageAds(
      payload,
      actor,
    );

    logger.info(
      { userId: user._id, position: payload.position, count: ads.length },
      "PUT /api/ads/homepage: bulk upsert berhasil",
    );

    return NextResponse.json({ success: true, ads }, { status: 200 });
  } catch (error: unknown) {
    const err = error as Error & { status?: number };
    const status = typeof err.status === "number" ? err.status : 500;
    logger.error({ err, userId: user._id }, "PUT /api/ads/homepage failed");
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status },
    );
  }
}

/**
 * POST /api/ads/homepage
 *
 * Simpan satu dokumen iklan (satu banner per dokumen) ke koleksi `ads_homepage`.
 * Banner biasanya dari respons `POST /api/ads/media` action `finalize`.
 *
 * Body wajib: `{ name, banner, linkUrl, position, startedAt, endedAt }`
 * Body opsional: `{ variant, span, order, isActive, clicks }`
 */
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageAdsHomepage(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let payload: CreateAdsHomepagePayload | null;
  try {
    payload = parseCreatePayload(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!payload) {
    return NextResponse.json(
      {
        error:
          "Body tidak valid. Wajib: name, banner { url, filename, mimetype, size }, linkUrl, position, startedAt (ISO), endedAt (ISO).",
      },
      { status: 400 },
    );
  }

  try {
    const actor = {
      _id: user._id,
      name: user.name ?? "",
      email: user.email ?? "",
    };
    const ad = await AdsManagementService.createHomepageAds(payload, actor);

    logger.info(
      { userId: user._id, adId: ad._id },
      "POST /api/ads/homepage: ad created",
    );

    return NextResponse.json({ success: true, ad }, { status: 201 });
  } catch (error: unknown) {
    const err = error as Error & { status?: number };
    const status = typeof err.status === "number" ? err.status : 500;
    logger.error({ err, userId: user._id }, "POST /api/ads/homepage failed");
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status },
    );
  }
}
