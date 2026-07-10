import type {
  EditorActivityPayload,
  EditorActivityListParams,
  SerializedEditorActivity,
} from "@/types/analytics/editorActivity";
import { EDITORIAL_ENTITIES } from "@/types/auditLog";
import type { Db, Document } from "mongodb";
import { ObjectId } from "mongodb";

const LEGACY_COLLECTION = "editor_activities";
const AUDIT_COLLECTION = "audit_log";
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/** Karakter regex di-escape supaya search literal aman untuk user input */
export function escapeRegexLiteral(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function normalizeObjectId(
  id: string | ObjectId | undefined | null,
): ObjectId | null {
  if (id == null) return null;
  try {
    if (id instanceof ObjectId) return id;
    const s = String(id).trim();
    return ObjectId.isValid(s) ? new ObjectId(s) : null;
  } catch {
    return null;
  }
}

function idToHexString(id: string | ObjectId): string {
  if (typeof id === "string") return id;
  return id.toHexString();
}

/**
 * Legacy writer (dipertahankan sementara agar backward compatible).
 * Read path Fase D sudah memakai `audit_log`.
 */
export async function createEditorActivity(
  db: Db,
  payload: EditorActivityPayload,
): Promise<{ _id: string }> {
  const actorId = normalizeObjectId(payload.actor._id);
  const articleId = normalizeObjectId(payload.article._id);
  const authorId = normalizeObjectId(payload.article.author._id);

  if (!actorId || !articleId || !authorId) {
    throw Object.assign(new Error("actor._id, article._id, dan author._id harus ObjectId valid"), {
      status: 400,
    });
  }

  const now = new Date();
  const reason = typeof payload.reason === "string" ? payload.reason.trim() : undefined;

  const doc: Record<string, unknown> = {
    actor: {
      _id: actorId,
      name: String(payload.actor.name ?? "").trim(),
      email: String(payload.actor.email ?? "").trim(),
      ...(payload.actor.avatarUrl?.trim()
        ? { avatarUrl: payload.actor.avatarUrl.trim() }
        : {}),
    },
    action: payload.action,
    statusFrom: payload.statusFrom,
    statusTo: payload.statusTo,
    article: {
      _id: articleId,
      title: String(payload.article.title ?? "").trim(),
      author: payload.article.author,
    },
    ...(reason ? { reason, meta: { reason } } : {}),
    userId: actorId,
    articleId,
    authorId,
    timestamp: now,
    createdAt: now,
    deletedAt: null,
  };

  const result = await db.collection<Document>(LEGACY_COLLECTION).insertOne(doc as Document);
  return { _id: result.insertedId.toHexString() };
}

function buildMatchFilter(params: EditorActivityListParams): Document {
  const filter: Record<string, unknown> = {
    entity: { $in: [...EDITORIAL_ENTITIES] },
  };

  const action = typeof params.action === "string" ? params.action.trim() : "";
  if (action) {
    filter.action = action;
  }

  const entity = typeof params.entity === "string" ? params.entity.trim() : "";
  if (entity) {
    if (!EDITORIAL_ENTITIES.includes(entity as (typeof EDITORIAL_ENTITIES)[number])) {
      throw Object.assign(new Error("entity tidak valid"), { status: 400 });
    }
    filter.entity = entity;
  }

  const trimmedUserId = typeof params.userId === "string" ? params.userId.trim() : "";
  if (trimmedUserId) {
    const userOid = normalizeObjectId(trimmedUserId);
    if (!userOid) {
      throw Object.assign(new Error("userId tidak valid"), { status: 400 });
    }
    filter["actor._id"] = userOid;
  }

  const createdAtRange: Record<string, Date> = {};
  if (params.createdFrom instanceof Date && !Number.isNaN(params.createdFrom.getTime())) {
    createdAtRange.$gte = params.createdFrom;
  }
  if (params.createdTo instanceof Date && !Number.isNaN(params.createdTo.getTime())) {
    createdAtRange.$lte = params.createdTo;
  }
  if (Object.keys(createdAtRange).length > 0) {
    filter.createdAt = createdAtRange;
  }

  const rawSearch = typeof params.search === "string" ? params.search.trim() : "";
  if (rawSearch) {
    const rx = escapeRegexLiteral(rawSearch);
    filter.$or = [
      { "actor.name": { $regex: rx, $options: "i" } },
      { "actor.email": { $regex: rx, $options: "i" } },
      { details: { $regex: rx, $options: "i" } },
      { "meta.articleTitle": { $regex: rx, $options: "i" } },
      { "meta.reason": { $regex: rx, $options: "i" } },
    ];
  }

  return filter as Document;
}

function asAuditMeta(
  value: unknown,
): {
  reason?: string;
  articleTitle?: string;
  statusFrom?: string;
  statusTo?: string;
} {
  if (typeof value !== "object" || value == null) return {};
  const meta = value as Record<string, unknown>;
  return {
    ...(typeof meta.reason === "string" ? { reason: meta.reason } : {}),
    ...(typeof meta.articleTitle === "string"
      ? { articleTitle: meta.articleTitle }
      : {}),
    ...(typeof meta.statusFrom === "string" ? { statusFrom: meta.statusFrom } : {}),
    ...(typeof meta.statusTo === "string" ? { statusTo: meta.statusTo } : {}),
  };
}

function documentToSerialized(doc: Document): SerializedEditorActivity | null {
  const _id = doc._id;
  if (!(_id instanceof ObjectId)) return null;

  const createdRaw = doc.createdAt;
  let createdAt: Date;
  if (createdRaw instanceof Date) createdAt = createdRaw;
  else if (typeof createdRaw === "string" || typeof createdRaw === "number") {
    createdAt = new Date(createdRaw);
  } else {
    return null;
  }
  if (Number.isNaN(createdAt.getTime())) return null;

  const actor = doc.actor as
    | { _id?: unknown; name?: string; email?: string; avatarUrl?: string }
    | undefined;
  if (!actor) return null;

  const uid = normalizeObjectId(actor._id as string | ObjectId);
  const meta = asAuditMeta(doc.meta);
  const details = typeof doc.details === "string" ? doc.details.trim() : "";
  const entity = typeof doc.entity === "string" ? doc.entity : "";

  const targetTitle = meta.articleTitle?.trim() || details || "-";
  const reasonText = meta.reason?.trim() || details || undefined;

  const serialized: SerializedEditorActivity = {
    _id: _id.toHexString(),
    timestamp: createdAt.toISOString(),
    user: {
      _id: uid ? uid.toHexString() : idToHexString(String(actor._id ?? "")),
      name: String(actor.name ?? ""),
      ...(actor.email?.trim() ? { email: actor.email.trim() } : {}),
      ...(actor.avatarUrl?.trim() ? { avatar: actor.avatarUrl.trim() } : {}),
    },
    action: String(doc.action ?? "") as SerializedEditorActivity["action"],
    entity,
    details: details || undefined,
    target: targetTitle,
    ...(reasonText
      ? {
          meta: {
            ...meta,
            reason: reasonText,
          },
        }
      : Object.keys(meta).length > 0
        ? { meta }
        : {}),
  };

  const entityId = doc.entityId;
  const articleId =
    entityId instanceof ObjectId
      ? entityId.toHexString()
      : typeof entityId === "string"
        ? entityId
        : "";
  if (articleId || meta.articleTitle) {
    serialized.article = {
      _id: articleId || "",
      title: meta.articleTitle || targetTitle,
    };
  }
  if (meta.statusFrom) serialized.statusFrom = meta.statusFrom;
  if (meta.statusTo) serialized.statusTo = meta.statusTo;

  return serialized;
}

function normalizedPagination(params: EditorActivityListParams): {
  skip: number;
  limit: number;
} {
  let skip = 0;
  if (typeof params.skip === "number" && Number.isFinite(params.skip)) {
    skip = Math.max(0, Math.floor(params.skip));
  }

  let limit =
    typeof params.limit === "number" && Number.isFinite(params.limit)
      ? Math.floor(params.limit)
      : DEFAULT_LIMIT;
  if (limit <= 0) limit = DEFAULT_LIMIT;
  limit = Math.min(limit, MAX_LIMIT);

  return { skip, limit };
}

export async function listEditorActivities(
  db: Db,
  params: EditorActivityListParams,
): Promise<{ data: SerializedEditorActivity[]; total: number }> {
  const { skip, limit } = normalizedPagination(params);
  const filter = buildMatchFilter(params);
  const col = db.collection<Document>(AUDIT_COLLECTION);

  const [raw, total] = await Promise.all([
    col
      .find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
    col.countDocuments(filter),
  ]);

  const data: SerializedEditorActivity[] = [];
  for (const d of raw) {
    const row = documentToSerialized(d);
    if (row) data.push(row);
  }

  const userIds = [
    ...new Set(
      data
        .map((row) => row.user._id)
        .filter((id) => id && ObjectId.isValid(id)),
    ),
  ];
  const slugByUserId = new Map<string, string>();
  if (userIds.length > 0) {
    const users = await db
      .collection("users")
      .find(
        { _id: { $in: userIds.map((id) => new ObjectId(id)) } },
        { projection: { slug: 1 } },
      )
      .toArray();
    for (const u of users) {
      if (u._id && u.slug) {
        slugByUserId.set(u._id.toString(), String(u.slug));
      }
    }
  }
  for (const row of data) {
    const slug = slugByUserId.get(row.user._id);
    if (slug) row.user.slug = slug;
  }

  return { data, total };
}
