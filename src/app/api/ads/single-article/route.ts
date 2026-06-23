import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { canManageAdsHomepage } from "@/lib/ads-homepage-access";
import logger from "@/lib/logger";
import { AdsSingleArticleService } from "@/services/ads/AdsSingleArticleService";
import type {
  AdsArticleCategory,
  AdsSingleArticlePlacement,
  BulkUpsertAdsArticleItem,
  BulkUpsertAdsArticlePayload,
  CreateAdsArticlePayload,
  GetArticleAdsOptions,
} from "@/types/ads";

// ─── Body parsers ─────────────────────────────────────────────────────────────

/** Validasi dan parse satu elemen `categories[]`. */
function parseCategoryItem(raw: unknown): AdsArticleCategory | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Record<string, unknown>;
  if (typeof c._id !== "string" || !c._id.trim()) return null;
  if (typeof c.slug !== "string" || !c.slug.trim()) return null;
  return { _id: c._id.trim(), slug: c.slug.trim() };
}

/** Validasi dan parse banner object. */
function parseBannerField(raw: unknown) {
  if (!raw || typeof raw !== "object") return null;
  const b = raw as Record<string, unknown>;
  if (
    typeof b.url !== "string" ||
    typeof b.filename !== "string" ||
    typeof b.mimetype !== "string" ||
    typeof b.size !== "number"
  ) {
    return null;
  }
  return {
    url: b.url,
    filename: b.filename,
    mimetype: b.mimetype,
    size: b.size,
  };
}

function parseBulkUpsertPayload(json: unknown): BulkUpsertAdsArticlePayload | null {
  if (!json || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;

  if (!Array.isArray(o.categories) || o.categories.length === 0) return null;
  if (typeof o.placement !== "string" || !o.placement.trim()) return null;
  if (!Array.isArray(o.items)) return null;

  const categories: AdsArticleCategory[] = [];
  for (const raw of o.categories) {
    const cat = parseCategoryItem(raw);
    if (!cat) return null;
    categories.push(cat);
  }

  const items: BulkUpsertAdsArticleItem[] = [];
  for (const raw of o.items) {
    if (!raw || typeof raw !== "object") return null;
    const it = raw as Record<string, unknown>;

    const banner = parseBannerField(it.banner);
    if (!banner) return null;

    if (
      typeof it.name !== "string" ||
      !it.name.trim() ||
      typeof it.linkUrl !== "string" ||
      typeof it.order !== "number" ||
      (typeof it.startedAt !== "string" && !(it.startedAt instanceof Date)) ||
      (typeof it.endedAt !== "string" && !(it.endedAt instanceof Date))
    ) {
      return null;
    }

    const item: BulkUpsertAdsArticleItem = {
      name: it.name.trim(),
      banner,
      linkUrl: it.linkUrl,
      order: it.order,
      startedAt: it.startedAt as string,
      endedAt: it.endedAt as string,
    };

    if (typeof it.serverId === "string" && it.serverId.trim()) {
      item.serverId = it.serverId.trim();
    }
    if (typeof it.variant === "string") item.variant = it.variant;
    if (it.span === 1 || it.span === 2) item.span = it.span;
    if (typeof it.isActive === "boolean") item.isActive = it.isActive;

    items.push(item);
  }

  return {
    categories,
    placement: o.placement.trim() as AdsSingleArticlePlacement,
    items,
  };
}

function parseCreatePayload(json: unknown): CreateAdsArticlePayload | null {
  if (!json || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;

  const banner = parseBannerField(o.banner);
  if (!banner) return null;

  if (
    typeof o.name !== "string" ||
    !o.name.trim() ||
    typeof o.linkUrl !== "string" ||
    typeof o.placement !== "string" ||
    !o.placement.trim() ||
    (typeof o.startedAt !== "string" && !(o.startedAt instanceof Date)) ||
    (typeof o.endedAt !== "string" && !(o.endedAt instanceof Date))
  ) {
    return null;
  }

  if (!Array.isArray(o.categories) || o.categories.length === 0) return null;

  const categories: AdsArticleCategory[] = [];
  for (const raw of o.categories) {
    const cat = parseCategoryItem(raw);
    if (!cat) return null;
    categories.push(cat);
  }

  const payload: CreateAdsArticlePayload = {
    name: o.name.trim(),
    categories,
    placement: o.placement.trim() as AdsSingleArticlePlacement,
    banner,
    linkUrl: o.linkUrl,
    startedAt: o.startedAt as string,
    endedAt: o.endedAt as string,
  };

  if (typeof o.variant === "string") payload.variant = o.variant;
  if (o.span === 1 || o.span === 2) payload.span = o.span;
  if (typeof o.order === "number") payload.order = o.order;
  if (typeof o.isActive === "boolean") payload.isActive = o.isActive;

  return payload;
}

// ─── Route handlers ───────────────────────────────────────────────────────────

/**
 * GET /api/ads/single-article
 *
 * Endpoint publik — tidak memerlukan autentikasi.
 *
 * Query params (semua opsional):
 * - `categorySlug`  — satu atau beberapa slug (ulangi query key atau pisahkan koma); cocok case-insensitive
 * - `categoryId`    — `_id` kategori artikel; cocok dengan `categories._id` di dokumen iklan
 * - `placement`     — "vertical" | "horizontal"
 * - `isActive`      — "true" | "false" (default: true)
 * - `filterByDate`  — "true" | "false" (default: false)
 * - `includeDeleted`— "true" | "false" (default: false)
 * - `page`          — nomor halaman (default: 1)
 * - `limit`         — jumlah per halaman (default: 50, maks: 200)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const options: GetArticleAdsOptions = {};

  const slugSet = new Set<string>();
  for (const raw of searchParams.getAll("categorySlug")) {
    for (const part of raw.split(",")) {
      const t = part.trim();
      if (t) slugSet.add(t);
    }
  }
  const collectedSlugs = [...slugSet];
  if (collectedSlugs.length > 0) {
    options.categorySlugs = collectedSlugs;
  }

  const categoryId = searchParams.get("categoryId");
  if (categoryId?.trim()) options.categoryId = categoryId.trim();

  const placement = searchParams.get("placement");
  if (placement) options.placement = placement as AdsSingleArticlePlacement;

  const isActiveParam = searchParams.get("isActive");
  if (isActiveParam === "false") options.isActive = false;
  else if (isActiveParam === "true") options.isActive = true;

  if (searchParams.get("filterByDate") === "true") options.filterByDate = true;
  if (searchParams.get("includeDeleted") === "true") options.includeDeleted = true;

  const pageParam = parseInt(searchParams.get("page") ?? "1", 10);
  if (!isNaN(pageParam)) options.page = pageParam;

  const limitParam = parseInt(searchParams.get("limit") ?? "50", 10);
  if (!isNaN(limitParam)) options.limit = limitParam;

  try {
    const { ads, total } = await AdsSingleArticleService.getArticleAds(options);

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
    logger.error({ err }, "GET /api/ads/single-article gagal");
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status },
    );
  }
}

/**
 * PUT /api/ads/single-article
 *
 * Bulk-upsert seluruh slot iklan untuk scope (categories + placement).
 * Memerlukan autentikasi dengan role yang dapat mengelola ads.
 *
 * Body wajib:
 * ```json
 * {
 *   "categories": [{ "_id": "...", "slug": "..." }],
 *   "placement": "vertical" | "horizontal",
 *   "items": [{ "name", "banner", "linkUrl", "order", "startedAt", "endedAt", "serverId?" }]
 * }
 * ```
 */
export async function PUT(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageAdsHomepage(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let payload: BulkUpsertAdsArticlePayload | null;
  try {
    payload = parseBulkUpsertPayload(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!payload) {
    return NextResponse.json(
      {
        error:
          "Body tidak valid. Wajib: categories (array min 1 { _id, slug }), placement (string), items (array).",
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
    const ads = await AdsSingleArticleService.bulkUpsertArticleAds(
      payload,
      actor,
    );

    logger.info(
      {
        userId: user._id,
        placement: payload.placement,
        categorySlugs: payload.categories.map((c) => c.slug),
        count: ads.length,
      },
      "PUT /api/ads/single-article: bulk upsert berhasil",
    );

    return NextResponse.json({ success: true, ads }, { status: 200 });
  } catch (error: unknown) {
    const err = error as Error & { status?: number };
    const status = typeof err.status === "number" ? err.status : 500;
    logger.error({ err, userId: user._id }, "PUT /api/ads/single-article gagal");
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status },
    );
  }
}

/**
 * POST /api/ads/single-article
 *
 * Buat satu dokumen iklan artikel baru (admin quick-add).
 * Memerlukan autentikasi dengan role yang dapat mengelola ads.
 *
 * Body wajib:
 * ```json
 * {
 *   "name", "categories", "placement", "banner", "linkUrl", "startedAt", "endedAt"
 * }
 * ```
 */
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageAdsHomepage(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let payload: CreateAdsArticlePayload | null;
  try {
    payload = parseCreatePayload(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!payload) {
    return NextResponse.json(
      {
        error:
          "Body tidak valid. Wajib: name, categories [{ _id, slug }], placement, banner { url, filename, mimetype, size }, linkUrl, startedAt (ISO), endedAt (ISO).",
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
    const ad = await AdsSingleArticleService.createArticleAd(payload, actor);

    logger.info(
      { userId: user._id, adId: ad._id },
      "POST /api/ads/single-article: ad created",
    );

    return NextResponse.json({ success: true, ad }, { status: 201 });
  } catch (error: unknown) {
    const err = error as Error & { status?: number };
    const status = typeof err.status === "number" ? err.status : 500;
    logger.error({ err, userId: user._id }, "POST /api/ads/single-article gagal");
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status },
    );
  }
}
