import type { ObjectId } from "mongodb";
import type { ArticleStatus } from "../article";
import type { UserProfile } from "../user";
import type {
  AuditLogAction,
  AuditLogEntityValue,
} from "../auditLog";

/**
 * Pelaku aktivitas redaksi (= field `userId` di MongoDB untuk KPI).
 */
export interface EditorActivityActor {
  _id: string | ObjectId;
  name: string;
  email: string;
  avatarUrl?: string;
}

/** Aksi penting redaksi + RESTORE (soft-delete) yang dipakai di UI admin */
export type EditorActivityAction = AuditLogAction | "RESTORE";

export interface EditorActivityPayload {
  actor: EditorActivityActor;
  action: EditorActivityAction;

  statusFrom?: ArticleStatus;
  statusTo: ArticleStatus;

  reason?: string;
  article: {
    _id: string | ObjectId;
    title: string;
    author: UserProfile;
  };
}

/**
 * Bentuk dokumen di koleksi MongoDB `editor_activities`:
 * nested payload + field flat untuk agregasi KPI (`kpiUserService`).
 */
export interface EditorActivityStored extends EditorActivityPayload {
  /** Sama seperti `timestamp`; disamakan untuk query/konsistensi tipe */
  createdAt?: Date;

  /** Waktu aktivitas — dipakai aggregation KPI (`kpiUserService`) */
  timestamp: Date;

  userId: ObjectId;
  articleId: ObjectId;
  authorId: ObjectId;

  meta?: {
    reason?: string;
  };

  deletedAt?: Date | null;
}

/** Query untuk listing (GET `/api/analytics/editor-analytics`) */
export interface EditorActivityListParams {
  skip?: number;
  limit?: number;
  search?: string;
  /** Exact match pada field `action` */
  action?: string;
  /** Exact match pada field `entity` */
  entity?: string;
  createdFrom?: Date;
  createdTo?: Date;
  /** Filter pelaku aktivitas (= `userId`) */
  userId?: string;
}

/** Baris yang dikonsumsi admin UI (`editor-activity/page.tsx`) */
export interface SerializedEditorActivity {
  _id: string | ObjectId;
  /** ISO dari API atau `Date` untuk data lama/client */
  timestamp: string | Date;
  /** Dipetakan dari `actor` */
  user: {
    _id: string;
    name: string;
    slug?: string;
    email?: string;
    role?: UserProfile["role"];
    avatar?: UserProfile["avatar"];
  };
  action: EditorActivityAction;
  entity: AuditLogEntityValue | string;
  statusFrom?: ArticleStatus | string;
  statusTo?: ArticleStatus | string;
  article?: {
    _id: string;
    title: string;
  };
  details?: string;
  target?: string;
  meta?: {
    reason?: string;
    articleTitle?: string;
    statusFrom?: string;
    statusTo?: string;
  };
}

/** Alias historis untuk halaman aktivitas redaksi */
export type EditorActivity = SerializedEditorActivity;
