import { Db, ObjectId } from "mongodb";
import { ADS_HOMEPAGE_COLLECTION } from "@/services/ads/AdsHomepageService";
import { ADS_ARTICLE_COLLECTION } from "@/services/ads/AdsSingleArticleService";
import logger from "@/lib/logger";

export const AD_CLICK_EVENTS_COLLECTION = "ad_click_events";

export type AdClickType = "homepage" | "article";

export interface RecordAdClickInput {
  adId: string;
  adType: AdClickType;
}

function parseObjectId(id: string): ObjectId | null {
  const trimmed = id?.trim();
  if (!trimmed || !ObjectId.isValid(trimmed)) return null;
  return new ObjectId(trimmed);
}

/**
 * Mencatat klik iklan: increment counter pada dokumen iklan + event time-series.
 * Event dipakai agregasi tren harian dashboard AE.
 */
export async function recordAdClick(
  db: Db,
  input: RecordAdClickInput,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const oid = parseObjectId(input.adId);
  if (!oid) {
    return { ok: false, reason: "ID iklan tidak valid" };
  }

  const collectionName =
    input.adType === "homepage"
      ? ADS_HOMEPAGE_COLLECTION
      : ADS_ARTICLE_COLLECTION;

  const col = db.collection(collectionName);
  const ad = await col.findOne({
    _id: oid,
    $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
    isActive: { $ne: false },
  });

  if (!ad) {
    return { ok: false, reason: "Iklan tidak ditemukan atau tidak aktif" };
  }

  const now = new Date();
  const banner = ad.banner as { url?: string } | undefined;
  const categorySlugs =
    input.adType === "article" && Array.isArray(ad.categories)
      ? (ad.categories as Array<{ slug?: string }>)
          .map((c) => c.slug?.trim())
          .filter(Boolean)
      : [];

  const event = {
    adId: oid,
    adType: input.adType,
    adName: typeof ad.name === "string" ? ad.name : "Iklan",
    position: typeof ad.position === "string" ? ad.position : null,
    placement: typeof ad.placement === "string" ? ad.placement : null,
    categorySlugs,
    clickedAt: now,
  };

  await Promise.all([
    col.updateOne({ _id: oid }, { $inc: { clicks: 1 }, $set: { updatedAt: now } }),
    db.collection(AD_CLICK_EVENTS_COLLECTION).insertOne(event),
  ]);

  return { ok: true };
}

/** Indeks disarankan — dipanggil sekali saat startup/route pertama (idempotent). */
export async function ensureAdClickEventIndexes(db: Db): Promise<void> {
  try {
    const col = db.collection(AD_CLICK_EVENTS_COLLECTION);
    await col.createIndex({ clickedAt: -1 });
    await col.createIndex({ adType: 1, clickedAt: -1 });
    await col.createIndex({ adId: 1, clickedAt: -1 });
  } catch (err) {
    logger.warn({ err }, "ensureAdClickEventIndexes: gagal membuat indeks (non-fatal)");
  }
}
