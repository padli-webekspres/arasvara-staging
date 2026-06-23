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

export interface AuditLogPayload {
  actor: AuditLogActor;
  action: AuditLogAction;
  entity: string;
  entityId: string | ObjectId;
  details?: string;
  oldValue?: any;
  newValue?: any;
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
