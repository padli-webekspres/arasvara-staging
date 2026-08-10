import { Db } from "mongodb";
import {
  DEFAULT_SLA_MINUTES,
  currentPeriodMonthWib,
} from "@/lib/analytics/metrics-core";

// ─── Interfaces ────────────────────────────────────────────────────────────

export interface WorkflowSummary {
  draft: number;
  pendingReview: number;
  scheduled: number;
  avgSlaMinutes: number;
  complianceRate: number;
  /** Effective SLA threshold used for compliance (minutes) */
  targetSlaMinutes: number;
}

export interface ThroughputResponPoint {
  date: string; // YYYY-MM-DD
  submitted: number;
  published: number;
  avgSla: number;
}

export interface QueueCalendarItem {
  id: string;
  title: string;
  author: string;
  category: string;
  format: string;
  submittedAt?: string;
  scheduledAt?: string;
  waitTimeMinutes?: number;
}

export interface QueueCalendarResult {
  pendingQueue: QueueCalendarItem[];
  scheduledCalendar: QueueCalendarItem[];
}

// Helper untuk format YYYY-MM-DD
function formatYmd(d: Date): string {
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// ─── 1. Get Workflow Summary (Card Row) ────────────────────────────────────

export async function getWorkflowSummary(
  db: Db,
  startDate?: Date,
  endDate?: Date
): Promise<WorkflowSummary> {
  const resolvedEnd = endDate ? new Date(endDate) : new Date();
  const resolvedStart = startDate ? new Date(startDate) : new Date();
  if (!startDate) {
    resolvedStart.setDate(resolvedEnd.getDate() - 7);
  }

  // 1. Snapshot counts (DRAFT, PENDING_REVIEW, SCHEDULED)
  const draft = await db.collection("articles").countDocuments({ status: "DRAFT" });
  const pendingReview = await db.collection("articles").countDocuments({ status: "PENDING_REVIEW" });
  const scheduled = await db.collection("articles").countDocuments({ status: "SCHEDULED" });

  // Single SLA threshold: monthly_targets → fallback 120 minutes (not hardcoded 30)
  const period = currentPeriodMonthWib(resolvedEnd);
  const slaTargetDoc = await db.collection("monthly_targets").findOne({
    key: "PROCESSING_TIME_SLA_MINUTES",
    period,
    scopeType: "GLOBAL",
  });
  const targetSlaMinutes =
    typeof slaTargetDoc?.value === "number" && slaTargetDoc.value > 0
      ? slaTargetDoc.value
      : DEFAULT_SLA_MINUTES;

  // 2. Average SLA & Compliance Rate for articles published in the range
  const slaPipeline = [
    {
      $match: {
        status: "PUBLISHED",
        submittedAt: { $ne: null },
        publishedAt: {
          $ne: null,
          $gte: resolvedStart,
          $lte: resolvedEnd,
        },
      },
    },
    {
      $project: {
        slaMinutes: {
          $divide: [
            { $subtract: ["$publishedAt", "$submittedAt"] },
            60000, // milidetik ke menit
          ],
        },
      },
    },
    {
      $group: {
        _id: null,
        avgSla: { $avg: "$slaMinutes" },
        total: { $sum: 1 },
        compliant: {
          $sum: {
            $cond: [{ $lte: ["$slaMinutes", targetSlaMinutes] }, 1, 0],
          },
        },
      },
    },
  ];

  const slaResult = await db.collection("articles").aggregate(slaPipeline).toArray();

  let avgSlaMinutes = 0;
  let complianceRate = 100; // Jika tidak ada artikel, compliance rate dianggap sempurna 100%

  if (slaResult && slaResult.length > 0) {
    const res = slaResult[0];
    avgSlaMinutes = res.avgSla ? parseFloat(res.avgSla.toFixed(1)) : 0;
    complianceRate = res.total > 0 ? parseFloat(((res.compliant / res.total) * 100).toFixed(1)) : 100;
  }

  return {
    draft,
    pendingReview,
    scheduled,
    avgSlaMinutes,
    complianceRate,
    targetSlaMinutes,
  };
}

// ─── 2. Get Throughput & Response Tren (Chart Row) ─────────────────────────

export async function getThroughputRespon(
  db: Db,
  startDate?: Date,
  endDate?: Date
): Promise<ThroughputResponPoint[]> {
  const resolvedEnd = endDate ? new Date(endDate) : new Date();
  const resolvedStart = startDate ? new Date(startDate) : new Date();
  if (!startDate) {
    resolvedStart.setDate(resolvedEnd.getDate() - 7);
  }

  // Generate date map
  const dateMap = new Map<string, ThroughputResponPoint>();
  const current = new Date(resolvedStart.getTime());
  current.setHours(0, 0, 0, 0);
  const end = new Date(resolvedEnd.getTime());
  end.setHours(0, 0, 0, 0);

  while (current <= end) {
    const ymdStr = formatYmd(current);
    dateMap.set(ymdStr, {
      date: ymdStr,
      submitted: 0,
      published: 0,
      avgSla: 0,
    });
    current.setDate(current.getDate() + 1);
  }

  // 1. Ambil naskah diajukan (submitted) per hari
  const submittedRaw = await db
    .collection("articles")
    .aggregate([
      {
        $match: {
          submittedAt: {
            $gte: resolvedStart,
            $lte: resolvedEnd,
          },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$submittedAt" } },
          count: { $sum: 1 },
        },
      },
    ])
    .toArray();

  submittedRaw.forEach((row) => {
    const key = row._id;
    if (dateMap.has(key)) {
      const data = dateMap.get(key)!;
      data.submitted = row.count;
    }
  });

  // 2. Ambil naskah terbit (published) & SLA per hari
  const publishedRaw = await db
    .collection("articles")
    .aggregate([
      {
        $match: {
          status: "PUBLISHED",
          publishedAt: {
            $gte: resolvedStart,
            $lte: resolvedEnd,
          },
          submittedAt: { $ne: null },
        },
      },
      {
        $project: {
          ymd: { $dateToString: { format: "%Y-%m-%d", date: "$publishedAt" } },
          slaMinutes: {
            $divide: [{ $subtract: ["$publishedAt", "$submittedAt"] }, 60000],
          },
        },
      },
      {
        $group: {
          _id: "$ymd",
          count: { $sum: 1 },
          avgSla: { $avg: "$slaMinutes" },
        },
      },
    ])
    .toArray();

  publishedRaw.forEach((row) => {
    const key = row._id;
    if (dateMap.has(key)) {
      const data = dateMap.get(key)!;
      data.published = row.count;
      data.avgSla = row.avgSla ? parseFloat(row.avgSla.toFixed(1)) : 0;
    }
  });

  return Array.from(dateMap.values());
}

// ─── 3. Get Pending Queue & Scheduled Calendar (Tables Row) ───────────────

export async function getQueueCalendar(db: Db): Promise<QueueCalendarResult> {
  // 1. Pending Review Queue (Limit 15 terlama)
  const pendingRaw = await db
    .collection("articles")
    .aggregate([
      { $match: { status: "PENDING_REVIEW" } },
      { $sort: { submittedAt: 1 } }, // Urutkan terlama dahulu (Urgent!)
      { $limit: 15 },
      {
        $lookup: {
          from: "users",
          localField: "authorId",
          foreignField: "_id",
          as: "authorObj",
        },
      },
      {
        $lookup: {
          from: "categories",
          localField: "categoryId",
          foreignField: "_id",
          as: "categoryObj",
        },
      },
      { $unwind: { path: "$authorObj", preserveNullAndEmptyArrays: true } },
      { $unwind: { path: "$categoryObj", preserveNullAndEmptyArrays: true } },
    ])
    .toArray();

  const now = new Date();
  const pendingQueue: QueueCalendarItem[] = pendingRaw.map((a) => {
    const submitted = a.submittedAt ? new Date(a.submittedAt) : new Date(a.createdAt);
    const diffMs = now.getTime() - submitted.getTime();
    const waitTimeMinutes = Math.max(0, Math.floor(diffMs / 60000));

    return {
      id: a._id.toString(),
      title: a.title,
      author: a.authorObj?.name || a.author?.name || "Tidak Diketahui",
      category: a.categoryObj?.name || a.category?.name || "Tanpa Kategori",
      format: a.format || "STANDARD",
      submittedAt: submitted.toISOString(),
      waitTimeMinutes,
    };
  });

  // 2. Scheduled Calendar (Limit 15 terbit hari ini)
  const scheduledRaw = await db
    .collection("articles")
    .aggregate([
      { $match: { status: "SCHEDULED" } },
      { $sort: { scheduledAt: 1 } }, // Urutkan terdekat
      { $limit: 15 },
      {
        $lookup: {
          from: "users",
          localField: "authorId",
          foreignField: "_id",
          as: "authorObj",
        },
      },
      {
        $lookup: {
          from: "categories",
          localField: "categoryId",
          foreignField: "_id",
          as: "categoryObj",
        },
      },
      { $unwind: { path: "$authorObj", preserveNullAndEmptyArrays: true } },
      { $unwind: { path: "$categoryObj", preserveNullAndEmptyArrays: true } },
    ])
    .toArray();

  const scheduledCalendar: QueueCalendarItem[] = scheduledRaw.map((a) => {
    const scheduled = a.scheduledAt ? new Date(a.scheduledAt) : new Date();
    return {
      id: a._id.toString(),
      title: a.title,
      author: a.authorObj?.name || a.author?.name || "Tidak Diketahui",
      category: a.categoryObj?.name || a.category?.name || "Tanpa Kategori",
      format: a.format || "STANDARD",
      scheduledAt: scheduled.toISOString(),
    };
  });

  return {
    pendingQueue,
    scheduledCalendar,
  };
}
