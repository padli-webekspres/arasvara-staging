import { ObjectId } from "mongodb";

export interface AuditLogActor {
  _id: string | ObjectId;
  name: string;
  email: string;
  avatarUrl?: string;
}

export enum AuditLogAction {
  CREATE = "CREATE",
  UPDATE = "UPDATE",
  DELETE = "DELETE",
  PUBLISH = "PUBLISH",
  SCHEDULE = "SCHEDULE",
  TAKE_DOWN = "TAKE_DOWN",
  REJECT = "REJECT",
}

/** Metadata tambahan untuk audit log editorial */
export interface AuditLogMeta {
  statusFrom?: string;
  statusTo?: string;
  articleTitle?: string;
  sectionType?: string;
  platform?: string;
  reason?: string;
  articleCount?: number;
  /** ID dokumen asal saat migrasi dari koleksi lain */
  originalId?: string;
  /** Nama koleksi sumber migrasi, mis. `editor_activities` */
  migratedFrom?: string;
}

/** Nama entity audit log — single source of truth */
export const AuditLogEntity = {
  ARTICLES: "articles",
  SECTION_FEATURED: "section_featured",
  SECTION_EDITOR_CHOICES: "section_editor_choices",
  SECTION_POPULAR: "section_popular",
  SECTION_HEADLINE: "section_headline",
  CAROUSEL_SECTION: "CAROUSEL_SECTION",
  SOCMED_VIDEO_SECTION: "SOCMED_VIDEO_SECTION",
} as const;

export type AuditLogEntityValue =
  (typeof AuditLogEntity)[keyof typeof AuditLogEntity];

/** Semua entity yang termasuk aktivitas editorial */
export const EDITORIAL_ENTITIES: readonly AuditLogEntityValue[] =
  Object.values(AuditLogEntity);

export interface AuditLogPayload {
  actor: AuditLogActor;
  action: AuditLogAction;
  entity: string;
  entityId: string | ObjectId;
  details?: string;
  oldValue?: any;
  newValue?: any;
  meta?: AuditLogMeta;
  createdAt: string | Date;
  ipAddress?: string;
}

/** Parameter query daftar audit log (collections `audit_log`) */
export interface AuditLogQueryParams {
  actorId?: string | ObjectId;
  /** Cocok persis (case-insensitive) */
  action?: string;
  /** Nama entity persis (case-insensitive) */
  entity?: string;
  /** Satu hari kalender (UTC); Date atau string `YYYY-MM-DD` */
  createdAtDay?: Date | string;
  /**
   * Partial match case-insensitive pada actor.name, actor.email,
   * details, oldValue, newValue (nilai di-string-kan).
   */
  search?: string;
  limit?: number;
  page?: number;
}

/** Dokumen audit log untuk respons API (ObjectId → string) */
export interface SerializedAuditLog extends AuditLogPayload {
  _id: string;
}

export interface AuditLogListResult {
  logs: SerializedAuditLog[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
