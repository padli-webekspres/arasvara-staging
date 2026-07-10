export type KpiSnapshotType = "daily" | "monthly";

export interface KpiSnapshotRecord {
  actorId: string;
  actorName: string;
  /** "YYYY-MM-DD" (daily) atau "YYYY-MM" (monthly) */
  date: string;
  snapshotType: KpiSnapshotType;
  publishCount: number;
  createCount: number;
  updateCount: number;
  scheduleCount: number;
  rejectCount: number;
  totalActions: number;
  createdAt: Date;
}
