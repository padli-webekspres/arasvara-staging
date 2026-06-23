import { Db } from "mongodb";

export interface AdminDashboardStats {
  stafOnline: number;
  dailyAuditCount: number;
  totalMedia: number;
  pendingReviewCount: number;
  scheduledCount: number;
  pushFunnel: {
    successRate: number;
    successCount: number;
    failedCount: number;
  };
  roleDistribution: Array<{
    role: string;
    label: string;
    count: number;
    percentage: number;
    color: string;
  }>;
  recentLogs: Array<{
    id: string;
    action: string;
    target: string;
    user: string;
    time: string;
    createdAt: string;
    detail: string;
  }>;
}

/**
 * Mengambil analitik dashboard performa sistem khusus Super Admin.
 * Kueri dioptimalkan secara maksimal dengan menghapus pemindaian berkas orphan media,
 * serta menambahkan penghitungan cepat naskah PENDING_REVIEW & SCHEDULED secara paralel.
 */
export async function getAdminDashboardStats(db: Db): Promise<AdminDashboardStats> {
  const now = new Date();
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 1000);

  // 1. Eksekusi paralel kueri basis data independen (cepat dan sangat irit resource)
  const [
    stafOnline,
    dailyAuditCount,
    totalMedia,
    pendingReviewCount,
    scheduledCount,
    pushFunnelResult,
    recentLogsRaw,
    rolesRaw
  ] = await Promise.all([
    // A. Menghitung staf/user aktif dalam 5 menit terakhir
    db.collection("users").countDocuments({
      $or: [
        { updatedAt: { $gte: fiveMinutesAgo } },
        { updatedAt: { $gte: fiveMinutesAgo.toISOString() } }
      ]
    }),
    // B. Menghitung aktivitas logs dalam 24 jam terakhir
    db.collection("audit_log").countDocuments({
      createdAt: { $gte: twentyFourHoursAgo }
    }),
    // C. Menghitung total seluruh dokumen media
    db.collection("media").countDocuments(),
    // D. Menghitung artikel Menunggu Submitted (status: PENDING_REVIEW)
    db.collection("articles").countDocuments({
      status: "PENDING_REVIEW",
      $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }]
    }),
    // E. Menghitung artikel Terjadwal Rilis (status: SCHEDULED)
    db.collection("articles").countDocuments({
      status: "SCHEDULED",
      $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }]
    }),
    // F. Mendapatkan rekap FCM push notification funnel
    db.collection("notifications").aggregate([
      {
        $group: {
          _id: "$isPushSent",
          count: { $sum: 1 }
        }
      }
    ]).toArray(),
    // G. Mengambil 5 audit log teranyar
    db.collection("audit_log")
      .find({})
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray(),
    // H. Menghitung jumlah pengguna berdasarkan role
    db.collection("users").aggregate([
      {
        $group: {
          _id: "$role",
          count: { $sum: 1 }
        }
      }
    ]).toArray()
  ]);

  // 2. Pengolahan rasio push notification FCM
  let successCount = 0;
  let failedCount = 0;
  pushFunnelResult.forEach((row) => {
    if (row._id === true) successCount = row.count;
    else if (row._id === false) failedCount = row.count;
  });
  const totalPush = successCount + failedCount;
  const successRate = totalPush > 0 ? parseFloat(((successCount / totalPush) * 100).toFixed(1)) : 100;

  // 3. Pengolahan data persentase pengguna berdasarkan role
  const totalUsers = rolesRaw.reduce((sum, item) => sum + (item.count || 0), 0);
  const roleDistribution = rolesRaw.map((item) => {
    const rawRole = (item._id || "writer").toLowerCase();
    let label = "Content Writer";
    let color = "#E05A47"; // Terakota/Orange
    
    if (rawRole === "admin") {
      label = "Super Admin";
      color = "#0F172A"; // Slate 900
    } else if (rawRole === "editor-in-chief") {
      label = "Pemimpin Redaksi";
      color = "#F59E0B"; // Amber 500
    } else if (rawRole === "editor") {
      label = "Editor Redaksi";
      color = "#10B981"; // Emerald 500
    } else if (rawRole === "account-executive") {
      label = "Account Executive";
      color = "#64748B"; // Slate 500
    }
    
    return {
      role: rawRole,
      label,
      count: item.count || 0,
      percentage: totalUsers > 0 ? parseFloat((((item.count || 0) / totalUsers) * 100).toFixed(1)) : 0,
      color
    };
  });

  // 4. Transformasi format audit logs agar sesuai dengan properti antarmuka Premium UI
  const recentLogs = recentLogsRaw.map((log: any) => {
    const createdDate = log.createdAt instanceof Date ? log.createdAt : new Date(log.createdAt);
    const diffMin = Math.max(0, Math.floor((now.getTime() - createdDate.getTime()) / 60000));
    let timeLabel = `${diffMin}m lalu`;
    
    if (diffMin >= 60) {
      const diffHrs = Math.floor(diffMin / 60);
      timeLabel = `${diffHrs}j lalu`;
      if (diffHrs >= 24) {
        timeLabel = `${Math.floor(diffHrs / 24)} hari lalu`;
      }
    }

    return {
      id: log._id.toString(),
      action: log.action || "MODIFY",
      target: log.entity ? `${log.entity} #${log.entityId}` : "Platform CMS",
      user: log.actor?.name || "Sistem",
      time: timeLabel,
      createdAt: createdDate.toISOString(),
      detail: log.details || "Modifikasi konfigurasi data Arasvara."
    };
  });

  return {
    stafOnline,
    dailyAuditCount,
    totalMedia,
    pendingReviewCount,
    scheduledCount,
    pushFunnel: {
      successRate,
      successCount,
      failedCount
    },
    roleDistribution,
    recentLogs
  };
}
