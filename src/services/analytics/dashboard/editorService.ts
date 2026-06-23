import { Db, ObjectId } from "mongodb";

export interface EditorDashboardStats {
  avgSlaMinutes: number;
  slaComplianceRate: number;
  monthlyReviewCount: number;
  monthlyReviewTarget: number;
  rejectionRate: number;
  pendingQueue: Array<{
    id: string;
    title: string;
    author: string;
    category: string;
    waitTime: string;
    submittedTime: string;
    statusColor: string;
  }>;
  calendarBacklog: Array<{
    id: string;
    title: string;
    author: string;
    category: string;
    scheduledTime: string;
    format: string;
  }>;
  editedChannels: Array<{
    name: string;
    pct: number;
    count: number;
    color: string;
  }>;
}

function normalizeObjectId(id: string | ObjectId | undefined | null): ObjectId | null {
  if (id == null) return null;
  try {
    if (id instanceof ObjectId) return id;
    const s = String(id).trim();
    return ObjectId.isValid(s) ? new ObjectId(s) : null;
  } catch {
    return null;
  }
}

/**
 * Mengambil data analitik dan performa suntingan redaksi khusus peran Editor.
 * Logika kueri dioptimalkan secara paralel tanpa data mock tiruan.
 *
 * @param db - Koneksi database MongoDB
 * @param editorId - ID pengguna aktif (role Editor)
 */
export async function getEditorDashboardStats(db: Db, editorId: string | ObjectId): Promise<EditorDashboardStats> {
  const now = new Date();
  const editorOid = normalizeObjectId(editorId);
  if (!editorOid) throw new Error("ID Editor tidak valid");

  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const period = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}`;

  // 1. Eksekusi Paralel Kueri Basis Data Independen (Cepat & Efisien)
  const [
    slaTargetDoc,
    reviewTargetDoc,
    articlesReviewedThisMonth,
    editorActivitiesThisMonth,
    pendingQueueRaw,
    calendarBacklogRaw,
    editedChannelsRaw
  ] = await Promise.all([
    // A. Target maksimal SLA menit (dari monthly_targets)
    db.collection("monthly_targets").findOne({
      period,
      key: "PROCESSING_TIME_SLA_MINUTES",
      scopeType: "GLOBAL"
    }),
    // B. Target jumlah naskah diproses (dari monthly_targets)
    db.collection("monthly_targets").findOne({
      period,
      key: "ARTICLES_TO_PROCESS",
      scopeType: "GLOBAL"
    }),
    // C. Ambil semua naskah yang diterbitkan oleh editor ini bulan ini (untuk hitung SLA)
    db.collection("articles").find({
      status: "PUBLISHED",
      editorId: editorOid,
      publishedAt: { $gte: startOfMonth },
      submittedAt: { $ne: null },
      $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }]
    }).toArray(),
    // D. Hitung editor activities (proses vs kembalikan draf) untuk rejection rate
    db.collection("editor_activities").find({
      userId: editorOid,
      timestamp: { $gte: startOfMonth },
      deletedAt: { $in: [null, ""] }
    }).toArray(),
    // E. Antrean naskah PENDING_REVIEW (Urutkan dari terlama masuk)
    db.collection("articles").aggregate([
      {
        $match: {
          status: "PENDING_REVIEW",
          $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }]
        }
      },
      { $sort: { submittedAt: 1 } },
      { $limit: 10 },
      {
        $addFields: {
          authorObjectId: {
            $cond: {
              if: { $eq: [{ $type: "$authorId" }, "string"] },
              then: { $toObjectId: "$authorId" },
              else: "$authorId"
            }
          },
          categoryObjectId: {
            $cond: {
              if: { $eq: [{ $type: "$categoryId" }, "string"] },
              then: { $toObjectId: "$categoryId" },
              else: "$categoryId"
            }
          }
        }
      },
      {
        $lookup: {
          from: "users",
          localField: "authorObjectId",
          foreignField: "_id",
          as: "author"
        }
      },
      { $unwind: { path: "$author", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "categories",
          localField: "categoryObjectId",
          foreignField: "_id",
          as: "category"
        }
      },
      { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } }
    ]).toArray(),
    // F. Backlog Kalender Rilis Terjadwal 24 Jam (Hari ini)
    db.collection("articles").aggregate([
      {
        $match: {
          status: "SCHEDULED",
          publishedAt: { $gte: startOfDay, $lte: endOfDay },
          $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }]
        }
      },
      { $sort: { publishedAt: 1 } },
      {
        $addFields: {
          authorObjectId: {
            $cond: {
              if: { $eq: [{ $type: "$authorId" }, "string"] },
              then: { $toObjectId: "$authorId" },
              else: "$authorId"
            }
          },
          categoryObjectId: {
            $cond: {
              if: { $eq: [{ $type: "$categoryId" }, "string"] },
              then: { $toObjectId: "$categoryId" },
              else: "$categoryId"
            }
          }
        }
      },
      {
        $lookup: {
          from: "users",
          localField: "authorObjectId",
          foreignField: "_id",
          as: "author"
        }
      },
      { $unwind: { path: "$author", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "categories",
          localField: "categoryObjectId",
          foreignField: "_id",
          as: "category"
        }
      },
      { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } }
    ]).toArray(),
    // G. Topik Rubrikasi suntingan yang dipublish oleh Editor ini
    db.collection("articles").aggregate([
      {
        $match: {
          status: "PUBLISHED",
          editorId: editorOid,
          $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }]
        }
      },
      {
        $group: {
          _id: "$categoryId",
          count: { $sum: 1 }
        }
      },
      {
        $addFields: {
          categoryObjectId: {
            $cond: {
              if: { $eq: [{ $type: "$_id" }, "string"] },
              then: { $toObjectId: "$_id" },
              else: "$_id"
            }
          }
        }
      },
      {
        $lookup: {
          from: "categories",
          localField: "categoryObjectId",
          foreignField: "_id",
          as: "category"
        }
      },
      { $unwind: "$category" }
    ]).toArray()
  ]);

  // Target SLA & Jumlah Target Review Bulanan
  const targetSlaMinutes = slaTargetDoc?.value ?? 30; // default target 30 menit
  const monthlyReviewTarget = reviewTargetDoc?.value ?? 240; // default target 240 artikel

  // 2. Penghitungan Rata-rata SLA & Kepatuhan SLA
  let totalSlaMinutes = 0;
  let compliantCount = 0;
  const countReviewed = articlesReviewedThisMonth.length;

  articlesReviewedThisMonth.forEach((art) => {
    const sub = art.submittedAt ? new Date(art.submittedAt) : new Date(art.createdAt);
    const pub = new Date(art.publishedAt);
    const diffMin = Math.max(0, Math.floor((pub.getTime() - sub.getTime()) / 60000));
    totalSlaMinutes += diffMin;
    if (diffMin <= targetSlaMinutes) {
      compliantCount++;
    }
  });

  const avgSlaMinutes = countReviewed > 0 ? parseFloat((totalSlaMinutes / countReviewed).toFixed(1)) : 0;
  const slaComplianceRate = countReviewed > 0 ? parseFloat(((compliantCount / countReviewed) * 100).toFixed(1)) : 100;
  const monthlyReviewCount = countReviewed;

  // 3. Penghitungan Rejection / Revision Rate
  let processedCount = 0;
  let revisedCount = 0;
  
  editorActivitiesThisMonth.forEach((act: any) => {
    const statusTo = String(act.statusTo).toUpperCase();
    const statusFrom = String(act.statusFrom).toUpperCase();

    if (["PUBLISHED", "SCHEDULED", "APPROVED"].includes(statusTo)) {
      processedCount++;
    } else if (statusFrom === "PENDING_REVIEW" && ["DRAFT", "REJECTED"].includes(statusTo)) {
      revisedCount++;
    }
  });

  const totalTouched = processedCount + revisedCount;
  const rejectionRate = totalTouched > 0 ? parseFloat(((revisedCount / totalTouched) * 100).toFixed(1)) : 0;

  // 4. Pengolahan Data Antrean Pending Review
  const pendingQueue = pendingQueueRaw.map((art: any) => {
    const sub = art.submittedAt ? new Date(art.submittedAt) : new Date(art.createdAt);
    const diffMs = now.getTime() - sub.getTime();
    const diffMin = Math.max(0, Math.floor(diffMs / 60000));
    
    let waitTime = `${diffMin}m`;
    if (diffMin >= 60) {
      const hrs = Math.floor(diffMin / 60);
      const mins = diffMin % 60;
      waitTime = `${hrs}j ${mins}m`;
    }

    // SLA Compliance visual warning (SLA > 2 jam = sangat mendesak/terakota)
    const statusColor = diffMin >= 120
      ? "text-terakota bg-orange-50 dark:bg-orange-950/20 border-terakota/20"
      : "text-hijauSawah bg-green-50 dark:bg-green-950/20 border-hijauSawah/20";

    const submittedTime = sub.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit"
    });

    return {
      id: art._id.toString(),
      title: art.title || "Untitled Draft",
      author: art.author?.name || "Penulis Anonim",
      category: art.category?.name || "Kategori",
      waitTime,
      submittedTime,
      statusColor
    };
  });

  // 5. Pengolahan Kalender Rilis Terjadwal 24 Jam
  const calendarBacklog = calendarBacklogRaw.map((art: any) => {
    const pub = new Date(art.publishedAt);
    const scheduledTime = pub.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit"
    });

    return {
      id: art._id.toString(),
      title: art.title || "Untitled Article",
      author: art.author?.name || "Penulis Anonim",
      category: art.category?.name || "Kategori",
      scheduledTime,
      format: String(art.format || "STANDARD").toUpperCase()
    };
  });

  // 6. Pengolahan Topik Saluran Distribusi suntingan editor ini
  const totalEditedCount = editedChannelsRaw.reduce((sum, row) => sum + row.count, 0);
  const brandColors = ["#18181b", "#c16b4c", "#5c954e", "#dcae61", "#3b82f6", "#eab308"];
  const editedChannels = editedChannelsRaw.map((row: any, idx: number) => ({
    name: row.category.name || "Kategori",
    pct: totalEditedCount > 0 ? Math.round((row.count / totalEditedCount) * 100) : 0,
    count: row.count,
    color: brandColors[idx % brandColors.length]
  }));

  return {
    avgSlaMinutes,
    slaComplianceRate,
    monthlyReviewCount,
    monthlyReviewTarget,
    rejectionRate,
    pendingQueue,
    calendarBacklog,
    editedChannels
  };
}
