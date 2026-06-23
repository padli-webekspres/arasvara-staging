import { Db } from "mongodb";
import { ADS_HOMEPAGE_COLLECTION } from "./AdsHomepageService";
import { ADS_ARTICLE_COLLECTION } from "./AdsSingleArticleService";

export interface AdsHistoryItem {
  _id: string;
  name: string;
  type: "homepage" | "article";
  positionOrPlacement: string;
  startedAt: Date;
  endedAt: Date;
  deletedAt: Date | null;
  status: "habis masa pakai" | "taken down";
  clicks: number;
  bannerUrl: string;
}

/**
 * Mengambil histori iklan dari koleksi homepage dan article yang sudah berakhir
 * atau telah didelete (soft-delete).
 *
 * @param db Koneksi database MongoDB
 */
export async function getAdsHistory(db: Db): Promise<AdsHistoryItem[]> {
  const now = new Date();

  // 1. Ambil dokumen dari ads_homepage dan ads_article secara paralel
  const [homepageDocs, articleDocs] = await Promise.all([
    db.collection(ADS_HOMEPAGE_COLLECTION).find({
      $or: [
        { endedAt: { $lt: now } },
        { deletedAt: { $ne: null } }
      ]
    }).toArray(),
    db.collection(ADS_ARTICLE_COLLECTION).find({
      $or: [
        { endedAt: { $lt: now } },
        { deletedAt: { $ne: null } }
      ]
    }).toArray()
  ]);

  // 2. Pemetaan ke bentuk terpadu AdsHistoryItem
  const mapDoc = (doc: any, type: "homepage" | "article"): AdsHistoryItem => {
    const deletedAt = doc.deletedAt ? new Date(doc.deletedAt) : null;
    const endedAt = new Date(doc.endedAt);

    // Logika Status: 
    // Jika didelete, dan selisih deletedAt dan endedAt <= 1 jam, maka "habis masa pakai".
    // Jika didelete lebih awal (> 1 jam sebelum endedAt), maka "taken down".
    // Jika tidak didelete dan endedAt telah lewat, maka "habis masa pakai".
    let status: "habis masa pakai" | "taken down" = "habis masa pakai";
    
    if (deletedAt) {
      const diffMs = endedAt.getTime() - deletedAt.getTime();
      // Selisih positif > 1 jam = didelete jauh sebelum masa berakhir
      if (diffMs > 1 * 60 * 60 * 1000) {
        status = "taken down";
      } else {
        status = "habis masa pakai";
      }
    } else if (now.getTime() > endedAt.getTime()) {
      status = "habis masa pakai";
    }

    return {
      _id: doc._id.toString(),
      name: doc.name || "Iklan Tanpa Nama",
      type,
      positionOrPlacement: type === "homepage" 
        ? String(doc.position || "Home Headline").toUpperCase() 
        : String(doc.placement || "Article Horizontal").toUpperCase(),
      startedAt: doc.startedAt,
      endedAt: doc.endedAt,
      deletedAt: doc.deletedAt || null,
      status,
      clicks: doc.clicks || 0,
      bannerUrl: doc.banner?.url || ""
    };
  };

  const homepageHistory = homepageDocs.map(doc => mapDoc(doc, "homepage"));
  const articleHistory = articleDocs.map(doc => mapDoc(doc, "article"));

  // 3. Gabungkan dan urutkan berdasarkan tanggal berakhir/penghapusan terbaru
  const combined = [...homepageHistory, ...articleHistory].sort((a, b) => {
    const timeA = a.deletedAt ? a.deletedAt.getTime() : a.endedAt.getTime();
    const timeB = b.deletedAt ? b.deletedAt.getTime() : b.endedAt.getTime();
    return timeB - timeA;
  });

  return combined;
}
