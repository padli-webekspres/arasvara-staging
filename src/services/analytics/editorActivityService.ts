import type {
  EditorActivityPayload,
  EditorActivityListParams,
  SerializedEditorActivity,
} from "@/types/analytics/editorActivity";
import type { Db, Document } from "mongodb";
import { ObjectId } from "mongodb";

const COLLECTION = "editor_activities";

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
 * Mencatat satu aktivitas redaksi (dipanggil dari service lain, bukan lewat REST).
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

  const actorDoc = {
    ...payload.actor,
    _id: actorId,
    name: String(payload.actor.name ?? "").trim(),
    email: String(payload.actor.email ?? "").trim(),
    ...(payload.actor.avatarUrl?.trim()
      ? { avatarUrl: payload.actor.avatarUrl.trim() }
      : {}),
  };

  const articleDoc = {
    ...payload.article,
    _id: articleId,
    title: String(payload.article.title ?? "").trim(),
    author: payload.article.author,
  };

  const doc: Record<string, unknown> = {
    actor: actorDoc,
    action: payload.action,
    statusFrom: payload.statusFrom,
    statusTo: payload.statusTo,
    article: articleDoc,
    ...(reason ? { reason, meta: { reason } } : {}),
    userId: actorId,
    articleId,
    authorId,
    timestamp: now,
    createdAt: now,
    deletedAt: null,
  };

  const result = await db.collection<Document>(COLLECTION).insertOne(doc as Document);

  return { _id: result.insertedId.toHexString() };
}

function buildMatchFilter(params: EditorActivityListParams): Document {
  const filter: Record<string, unknown> = {
    deletedAt: { $in: [null, ""] },
  };

  const action = typeof params.action === "string" ? params.action.trim() : "";
  if (action) {
    filter.action = action;
  }

  const trimmedUserId = typeof params.userId === "string" ? params.userId.trim() : "";
  if (trimmedUserId) {
    const userOid = normalizeObjectId(trimmedUserId);
    if (!userOid) {
      throw Object.assign(new Error("userId tidak valid"), {
        status: 400,
      });
    }
    filter.userId = userOid;
  }

  /**
   * Rentang tanggal (inklusif kedua tepi pada `timestamp`):
   * `createdTo` menggunakan akhir slice detik tersebut (exclusive upper bound pakai lte end).
   */
  const ts: Record<string, Date> = {};
  if (params.createdFrom instanceof Date && !Number.isNaN(params.createdFrom.getTime())) {
    ts.$gte = params.createdFrom;
  }
  if (params.createdTo instanceof Date && !Number.isNaN(params.createdTo.getTime())) {
    ts.$lte = params.createdTo;
  }
  if (Object.keys(ts).length > 0) {
    filter.timestamp = ts;
  }

  const rawSearch = typeof params.search === "string" ? params.search.trim() : "";
  if (rawSearch) {
    const rx = escapeRegexLiteral(rawSearch);
    filter.$or = [
      { "actor.name": { $regex: rx, $options: "i" } },
      { "actor.email": { $regex: rx, $options: "i" } },
      { "article.title": { $regex: rx, $options: "i" } },
    ];
  }

  return filter as Document;
}

function documentToSerialized(doc: Document): SerializedEditorActivity | null {
  const _id = doc._id;
  if (!(_id instanceof ObjectId)) return null;

  const tsRaw = doc.timestamp ?? doc.createdAt;
  let timestamp: Date;
  if (tsRaw instanceof Date) timestamp = tsRaw;
  else if (typeof tsRaw === "string" || typeof tsRaw === "number") {
    timestamp = new Date(tsRaw);
  } else {
    return null;
  }
  if (Number.isNaN(timestamp.getTime())) return null;

  const actor = doc.actor as
    | { _id?: unknown; name?: string; email?: string; avatarUrl?: string }
    | undefined;

  const article = doc.article as
    | { _id?: unknown; title?: string }
    | undefined;

  if (!actor || !article) return null;

  const uid = normalizeObjectId(actor._id as string | ObjectId);
  const aid = normalizeObjectId(article._id as string | ObjectId);

  const metaReason =
    typeof doc.meta === "object" && doc.meta != null && "reason" in doc.meta
      ? String((doc.meta as { reason?: unknown }).reason ?? "")
      : "";
  const fallbackReason =
    typeof doc.reason === "string" ? doc.reason.trim() : "";
  const reasonText = metaReason || fallbackReason;

  const statusFrom = doc.statusFrom as SerializedEditorActivity["statusFrom"];
  const statusTo = doc.statusTo as SerializedEditorActivity["statusTo"];
  const action = doc.action as SerializedEditorActivity["action"];

  return {
    _id: _id.toHexString(),
    timestamp: timestamp.toISOString(),
    user: {
      _id: uid ? uid.toHexString() : idToHexString(String(actor._id ?? "")),
      name: String(actor.name ?? ""),
      ...(actor.email?.trim() ? { email: actor.email.trim() } : {}),
      ...(actor.avatarUrl?.trim()
        ? { avatar: actor.avatarUrl.trim() }
        : {}),
    },
    action,
    statusFrom,
    statusTo,
    article: {
      _id: aid ? aid.toHexString() : idToHexString(String(article._id ?? "")),
      title: String(article.title ?? ""),
    },
    ...(reasonText ? { meta: { reason: reasonText } } : {}),
  };
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

  const col = db.collection<Document>(COLLECTION);

  const [cursor, total] = await Promise.all([
    col
      .find(filter)
      .sort({ timestamp: -1, _id: -1 })
      .skip(skip)
      .limit(limit),
    col.countDocuments(filter),
  ]);

  const raw = await cursor.toArray();
  const data: SerializedEditorActivity[] = [];
  for (const d of raw) {
    const row = documentToSerialized(d);
    if (row) data.push(row);
  }

  return { data, total };
}
