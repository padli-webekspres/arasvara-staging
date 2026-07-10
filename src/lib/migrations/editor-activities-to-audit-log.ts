import { ObjectId } from "mongodb";
import { AuditLogEntity } from "@/types/auditLog";

export const MIGRATED_FROM_EDITOR_ACTIVITIES = "editor_activities";

export type EditorActivitySourceDoc = {
  _id: ObjectId | string;
  actor?: {
    _id?: ObjectId | string;
    name?: string;
    email?: string;
    avatarUrl?: string;
  };
  action?: string;
  statusFrom?: string;
  statusTo?: string;
  reason?: string;
  article?: {
    _id?: ObjectId | string;
    title?: string;
  };
  meta?: {
    reason?: string;
  };
  timestamp?: Date | string;
  createdAt?: Date | string;
};

export type MigrationMappingFailure = {
  sourceId: string;
  reason: string;
};

export type MigrationMappingSuccess = {
  sourceId: string;
  auditDoc: Record<string, unknown>;
};

export type MigrationMappingResult =
  | { ok: true; data: MigrationMappingSuccess }
  | { ok: false; failure: MigrationMappingFailure };

function toObjectId(id: ObjectId | string | undefined | null): ObjectId | null {
  if (id == null) return null;
  try {
    if (id instanceof ObjectId) return id;
    const trimmed = String(id).trim();
    return ObjectId.isValid(trimmed) ? new ObjectId(trimmed) : null;
  } catch {
    return null;
  }
}

function toHexId(id: ObjectId | string | undefined | null): string | null {
  const oid = toObjectId(id);
  return oid ? oid.toHexString() : null;
}

function resolveTimestamp(doc: EditorActivitySourceDoc): Date | null {
  const raw = doc.timestamp ?? doc.createdAt;
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) return raw;
  if (typeof raw === "string" || typeof raw === "number") {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function resolveReason(doc: EditorActivitySourceDoc): string | undefined {
  const fromMeta =
    typeof doc.meta?.reason === "string" ? doc.meta.reason.trim() : "";
  const fromField = typeof doc.reason === "string" ? doc.reason.trim() : "";
  const reason = fromMeta || fromField;
  return reason || undefined;
}

function buildDetails(params: {
  action: string;
  statusFrom?: string;
  statusTo?: string;
  articleTitle?: string;
  reason?: string;
}): string {
  const { action, statusFrom, statusTo, articleTitle, reason } = params;
  const titlePart = articleTitle ? `: "${articleTitle}"` : "";

  if (statusFrom && statusTo) {
    const base = `Perubahan status ${statusFrom} → ${statusTo}`;
    return reason ? `${base}. Alasan: ${reason}` : base;
  }

  const base = `Aktivitas ${action}${titlePart}`;
  return reason ? `${base}. Alasan: ${reason}` : base;
}

/**
 * Transform satu dokumen `editor_activities` ke bentuk insert `audit_log`.
 * Mengembalikan failure jika field wajib tidak valid.
 */
export function mapEditorActivityToAuditLog(
  doc: EditorActivitySourceDoc,
): MigrationMappingResult {
  const sourceId = toHexId(doc._id);
  if (!sourceId) {
    return {
      ok: false,
      failure: { sourceId: String(doc._id ?? ""), reason: "_id tidak valid" },
    };
  }

  const actorId = toObjectId(doc.actor?._id);
  const articleId = toObjectId(doc.article?._id);
  const actorName = String(doc.actor?.name ?? "").trim();
  const actorEmail = String(doc.actor?.email ?? "").trim();
  const action = String(doc.action ?? "").trim();
  const articleTitle = String(doc.article?.title ?? "").trim();
  const createdAt = resolveTimestamp(doc);
  const reason = resolveReason(doc);
  const statusFrom =
    doc.statusFrom != null && String(doc.statusFrom).trim() !== ""
      ? String(doc.statusFrom).trim()
      : undefined;
  const statusTo =
    doc.statusTo != null && String(doc.statusTo).trim() !== ""
      ? String(doc.statusTo).trim()
      : undefined;

  if (!actorId) {
    return {
      ok: false,
      failure: { sourceId, reason: "actor._id tidak valid" },
    };
  }
  if (!actorName || !actorEmail) {
    return {
      ok: false,
      failure: { sourceId, reason: "actor.name atau actor.email kosong" },
    };
  }
  if (!action) {
    return {
      ok: false,
      failure: { sourceId, reason: "action kosong" },
    };
  }
  if (!articleId) {
    return {
      ok: false,
      failure: { sourceId, reason: "article._id tidak valid" },
    };
  }
  if (!createdAt) {
    return {
      ok: false,
      failure: { sourceId, reason: "timestamp/createdAt tidak valid" },
    };
  }

  const meta: Record<string, unknown> = {
    originalId: sourceId,
    migratedFrom: MIGRATED_FROM_EDITOR_ACTIVITIES,
  };
  if (statusFrom) meta.statusFrom = statusFrom;
  if (statusTo) meta.statusTo = statusTo;
  if (articleTitle) meta.articleTitle = articleTitle;
  if (reason) meta.reason = reason;

  const auditDoc: Record<string, unknown> = {
    actor: {
      _id: actorId,
      name: actorName,
      email: actorEmail,
      ...(doc.actor?.avatarUrl?.trim()
        ? { avatarUrl: doc.actor.avatarUrl.trim() }
        : {}),
    },
    action,
    entity: AuditLogEntity.ARTICLES,
    entityId: articleId,
    details: buildDetails({
      action,
      statusFrom,
      statusTo,
      articleTitle,
      reason,
    }),
    meta,
    createdAt,
  };

  return {
    ok: true,
    data: { sourceId, auditDoc },
  };
}

/** Filter dokumen aktif di koleksi `editor_activities` */
export function activeEditorActivitiesFilter(): Record<string, unknown> {
  return { deletedAt: { $in: [null, ""] } };
}

/** Filter dokumen hasil migrasi di koleksi `audit_log` */
export function migratedEditorActivitiesFilter(): Record<string, unknown> {
  return { "meta.migratedFrom": MIGRATED_FROM_EDITOR_ACTIVITIES };
}
