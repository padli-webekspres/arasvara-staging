/**
 * In-app notifications — koleksi `notifications`.
 * CRUD ringkas: satu / bulk; daftar dengan filter, offset page, atau cursor (infinite scroll).
 */

import {
  Db,
  Document,
  ObjectId,
  type Filter,
  type WithId,
} from "mongodb";
import { escapeRegexLiteral } from "@/services/auditLogService";
import logger from "@/lib/logger";
import type {
  CreateNotificationInput,
  GetNotificationsQuery,
  GetNotificationsResult,
  LegacyCreateNotificationInput,
  Notification,
  NotificationActor,
  NotificationType,
  ReadAtFilterMode,
} from "@/types/notification";

export const NOTIFICATIONS_COLLECTION = "notifications";

/** Actor fallback untuk payload legacy tanpa `actor` (mis. job scheduler). */
const LEGACY_SYSTEM_ACTOR: NotificationActor = {
  _id: "000000000000000000000001",
  name: "Penjadwal sistem",
  email: "scheduler@arasvara.local",
};

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const SORT: Record<string, 1 | -1> = { createdAt: -1, _id: -1 };

// ─── Cursor (createdAt desc + _id desc) ───────────────────────────────────────

type CursorPayload = { c: string; i: string };

function encodeCursor(createdAt: Date, id: ObjectId): string {
  const payload: CursorPayload = {
    c: createdAt.toISOString(),
    i: id.toHexString(),
  };
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodeCursor(cursor: string): CursorPayload | null {
  try {
    const raw = Buffer.from(cursor, "base64url").toString("utf8");
    const o = JSON.parse(raw) as unknown;
    if (
      o &&
      typeof o === "object" &&
      typeof (o as CursorPayload).c === "string" &&
      typeof (o as CursorPayload).i === "string" &&
      ObjectId.isValid((o as CursorPayload).i)
    ) {
      return o as CursorPayload;
    }
  } catch {
    /* abaikan */
  }
  return null;
}

function cursorOlderThanFilter(payload: CursorPayload): Filter<Document> {
  const d = new Date(payload.c);
  const oid = new ObjectId(payload.i);
  if (Number.isNaN(d.getTime())) return {};
  return {
    $or: [{ createdAt: { $lt: d } }, { $and: [{ createdAt: d }, { _id: { $lt: oid } }] }],
  };
}

// ─── ObjectId helpers ─────────────────────────────────────────────────────────

function tryObjectId(id: string): ObjectId | null {
  const t = id.trim();
  if (!/^[a-f\d]{24}$/i.test(t)) return null;
  try {
    return new ObjectId(t);
  } catch {
    return null;
  }
}

/** Simpan sebagai ObjectId jika hex 24 karakter; terima juga instance ObjectId */
function refIdForStorage(id: string | ObjectId): string | ObjectId {
  if (id instanceof ObjectId) return id;
  const t = id.trim();
  return tryObjectId(t) ?? t;
}

/** Filter $or agar cocok dengan dokumen lama (ObjectId atau string) */
function refIdMatchFilter(field: string, id: string): Filter<Document> {
  const oid = tryObjectId(id);
  if (oid) {
    return { $or: [{ [field]: oid }, { [field]: id.trim() }] };
  }
  return { [field]: id.trim() };
}

// ─── Escape search (DRY dengan audit log) ─────────────────────────────────────

function buildSearchFilter(search?: string): Filter<Document> | null {
  const term = search?.trim();
  if (!term) return null;
  const escaped = escapeRegexLiteral(term);
  const rx = new RegExp(escaped, "i");
  return {
    $or: [
      { "actor.name": rx },
      { "actor.email": rx },
      { "receiver.name": rx },
      { "receiver.email": rx },
      { title: rx },
      { message: rx },
    ],
  };
}

function readStatusFilter(
  mode: ReadAtFilterMode | undefined,
): Filter<Document> | null {
  if (!mode || mode === "all") return null;
  if (mode === "unread") {
    return { $or: [{ readAt: null }, { readAt: { $exists: false } }] };
  }
  return { readAt: { $ne: null, $exists: true } };
}

// ─── Dokumen ↔ API ─────────────────────────────────────────────────────────────

function actorFromDoc(raw: unknown): NotificationActor {
  if (!raw || typeof raw !== "object") {
    return { _id: "", name: "", email: "" };
  }
  const r = raw as Record<string, unknown>;
  const idRaw = r._id;
  let _id: string | ObjectId;
  if (idRaw instanceof ObjectId) {
    _id = idRaw;
  } else if (typeof idRaw === "string") {
    _id = idRaw;
  } else {
    _id = String(idRaw ?? "");
  }
  const actor: NotificationActor = {
    _id,
    name: String(r.name ?? ""),
    email: String(r.email ?? ""),
  };
  if (typeof r.avatarUrl === "string" && r.avatarUrl.trim()) {
    actor.avatarUrl = r.avatarUrl.trim();
  }
  return actor;
}

function toDate(v: unknown): Date {
  if (v instanceof Date) return v;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? new Date(0) : d;
}

export function docToNotification(doc: WithId<Document>): Notification {
  const d = doc as Record<string, unknown>;
  const topId = doc._id;
  const _id: string | ObjectId =
    topId instanceof ObjectId ? topId : String(topId);
  return {
    _id,
    receiver: actorFromDoc(d.receiver),
    actor: actorFromDoc(d.actor),
    type: d.type as NotificationType,
    title: String(d.title ?? ""),
    message: String(d.message ?? ""),
    ...(typeof d.targetId === "string" && d.targetId
      ? { targetId: d.targetId }
      : {}),
    ...(typeof d.link === "string" && d.link ? { link: d.link } : {}),
    ...(typeof d.icon === "string" && d.icon ? { icon: d.icon } : {}),
    ...(typeof d.imageUrl === "string" && d.imageUrl
      ? { imageUrl: d.imageUrl }
      : {}),
    isPushSent: Boolean(d.isPushSent),
    readAt:
      d.readAt == null || d.readAt === undefined
        ? null
        : toDate(d.readAt),
    createdAt: toDate(d.createdAt),
    ...(d.meta &&
    typeof d.meta === "object" &&
    d.meta !== null &&
    !Array.isArray(d.meta)
      ? { meta: d.meta as Record<string, unknown> }
      : {}),
  };
}

function validateNotificationActors(
  receiver: NotificationActor,
  actor: NotificationActor,
): void {
  const errors: string[] = [];
  if (!receiver.name?.trim()) errors.push("receiver.name wajib diisi");
  if (!receiver.email?.trim()) errors.push("receiver.email wajib diisi");
  if (!actor.name?.trim()) errors.push("actor.name wajib diisi");
  if (!actor.email?.trim()) errors.push("actor.email wajib diisi");
  if (!receiver._id?.toString().trim()) errors.push("receiver._id wajib diisi");
  if (!actor._id?.toString().trim()) errors.push("actor._id wajib diisi");
  if (errors.length > 0) {
    throw Object.assign(new Error(errors.join("; ")), { status: 400 });
  }
}

function payloadToInsertDoc(
  input: CreateNotificationInput,
  now: Date,
): Record<string, unknown> {
  const readAt =
    input.readAt === undefined ? null : input.readAt;
  const doc: Record<string, unknown> = {
    receiver: {
      _id: refIdForStorage(input.receiver._id),
      name: input.receiver.name.trim(),
      email: input.receiver.email.trim(),
      ...(input.receiver.avatarUrl?.trim()
        ? { avatarUrl: input.receiver.avatarUrl.trim() }
        : {}),
    },
    actor: {
      _id: refIdForStorage(input.actor._id),
      name: input.actor.name.trim(),
      email: input.actor.email.trim(),
      ...(input.actor.avatarUrl?.trim()
        ? { avatarUrl: input.actor.avatarUrl.trim() }
        : {}),
    },
    type: input.type,
    title: input.title.trim(),
    message: (input.message ?? "").trim(),
    isPushSent: input.isPushSent ?? false,
    readAt,
    createdAt: input.createdAt ?? now,
  };
  if (input.targetId?.trim()) doc.targetId = input.targetId.trim();
  if (input.link?.trim()) doc.link = input.link.trim();
  if (input.icon?.trim()) doc.icon = input.icon.trim();
  if (input.imageUrl?.trim()) doc.imageUrl = input.imageUrl.trim();
  if (input.meta && typeof input.meta === "object") doc.meta = input.meta;
  return doc;
}

async function fetchUserActor(
  db: Db,
  userId: string | ObjectId,
): Promise<NotificationActor> {
  const uid =
    typeof userId === "string" ? userId.trim() : userId.toHexString();
  const oid = tryObjectId(uid);
  const filter = (
    oid ? { _id: oid } : { _id: uid }
  ) as Filter<Document>;
  const u = await db.collection("users").findOne(filter);
  if (!u || typeof u !== "object") {
    return {
      _id: uid,
      name: "",
      email: "",
    };
  }
  const doc = u as Document;
  const id = doc._id instanceof ObjectId ? doc._id.toHexString() : String(doc._id);
  return {
    _id: id,
    name: String(doc.name ?? "").trim(),
    email: String(doc.email ?? "").trim(),
    ...(typeof doc.avatarUrl === "string" && doc.avatarUrl.trim()
      ? { avatarUrl: doc.avatarUrl.trim() }
      : {}),
  };
}

function refIdFromParam(id: string | ObjectId | undefined): string | undefined {
  if (id === undefined || id === null) return undefined;
  const s = typeof id === "string" ? id.trim() : id.toHexString();
  return s || undefined;
}

function buildListFilter(query: GetNotificationsQuery): Filter<Document> {
  const parts: Filter<Document>[] = [];

  const receiverRaw = query.receiverId ?? query.userId;
  const receiverId = refIdFromParam(receiverRaw);
  if (receiverId) {
    parts.push(refIdMatchFilter("receiver._id", receiverId));
  }
  const actorId = refIdFromParam(query.actorId);
  if (actorId) {
    parts.push(refIdMatchFilter("actor._id", actorId));
  }
  if (query.type !== undefined && String(query.type).trim() !== "") {
    parts.push({ type: String(query.type).trim() });
  }
  const readPart = readStatusFilter(query.readAt);
  if (readPart) parts.push(readPart);
  const searchPart = buildSearchFilter(query.search);
  if (searchPart) parts.push(searchPart);

  if (parts.length === 0) return {};
  if (parts.length === 1) return parts[0];
  return { $and: parts };
}

async function countUnreadForReceiver(
  db: Db,
  receiverId: string,
): Promise<number> {
  const col = db.collection(NOTIFICATIONS_COLLECTION);
  const base = refIdMatchFilter("receiver._id", receiverId.trim());
  const unread: Filter<Document> = {
    $and: [
      base,
      {
        $or: [{ readAt: null }, { readAt: { $exists: false } }],
      },
    ],
  };
  return col.countDocuments(unread);
}

function normalizeListQuery(
  query: GetNotificationsQuery,
): GetNotificationsQuery & { safeLimit: number; receiverId?: string } {
  const receiverRaw = query.receiverId ?? query.userId;
  const receiverId = refIdFromParam(receiverRaw as string | ObjectId | undefined);
  const rawLimit = query.limit ?? DEFAULT_LIMIT;
  const safeLimit = Math.min(Math.max(1, rawLimit), MAX_LIMIT);

  let page = query.page;
  if (
    page === undefined &&
    query.skip !== undefined &&
    query.cursor === undefined &&
    !query.cursor
  ) {
    const skip = Math.max(0, query.skip);
    page = Math.floor(skip / safeLimit) + 1;
  }
  if (page === undefined || page < 1) page = 1;

  const includeUnreadCount =
    query.includeUnreadCount !== false && Boolean(receiverId);

  return {
    ...query,
    receiverId,
    page,
    limit: safeLimit,
    safeLimit,
    includeUnreadCount,
  };
}

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createOneNotification(
  db: Db,
  input: CreateNotificationInput,
): Promise<Notification> {
  validateNotificationActors(input.receiver, input.actor);

  const col = db.collection(NOTIFICATIONS_COLLECTION);
  const now = new Date();
  const doc = payloadToInsertDoc(input, now);
  const result = await col.insertOne(doc as Document);

  logger.info(
    {
      notificationId: result.insertedId.toHexString(),
      type: input.type,
      receiverId: String(input.receiver._id),
    },
    "notificationService: satu notifikasi dibuat",
  );

  const inserted = await col.findOne({ _id: result.insertedId });
  if (!inserted) {
    throw new Error("Notifikasi tidak ditemukan setelah insert");
  }
  return docToNotification(inserted as WithId<Document>);
}

export async function createBulkNotifications(
  db: Db,
  inputs: CreateNotificationInput[],
): Promise<Notification[]> {
  if (!inputs.length) return [];

  const now = new Date();
  const docs: Record<string, unknown>[] = [];
  for (const input of inputs) {
    validateNotificationActors(input.receiver, input.actor);
    docs.push(payloadToInsertDoc(input, now));
  }

  const col = db.collection(NOTIFICATIONS_COLLECTION);
  const result = await col.insertMany(docs as Document[], { ordered: true });

  const ids = Object.values(result.insertedIds);
  const inserted = await col
    .find({ _id: { $in: ids } })
    .sort(SORT)
    .toArray();

  logger.info({ count: inserted.length }, "notificationService: bulk notifikasi dibuat");

  return inserted.map((d) => docToNotification(d as WithId<Document>));
}

/** Alias legacy — isi `receiver` dari koleksi `users` */
export async function createNotification(
  db: Db,
  input: LegacyCreateNotificationInput,
): Promise<Notification> {
  const receiver = await fetchUserActor(db, input.userId);
  const actorSource = input.actor;
  let actor: NotificationActor;

  if (actorSource?._id) {
    const fromDb = await fetchUserActor(db, actorSource._id);
    actor = {
      _id: actorSource._id,
      name: (actorSource.name ?? fromDb.name).trim(),
      email: (actorSource.email ?? fromDb.email).trim(),
      ...(actorSource.avatarUrl ?? fromDb.avatarUrl
        ? { avatarUrl: actorSource.avatarUrl ?? fromDb.avatarUrl }
        : {}),
    };
  } else {
    actor = { ...LEGACY_SYSTEM_ACTOR };
  }

  const receiverFixed: NotificationActor = {
    ...receiver,
    email:
      receiver.email ||
      `${String(receiver._id).replace(/\W/g, "").slice(0, 24) || "user"}@placeholder.local`,
    name: receiver.name || "Pengguna",
  };

  const actorFixed: NotificationActor = {
    ...actor,
    email:
      actor.email ||
      `${String(actor._id).replace(/\W/g, "").slice(0, 24)}@placeholder.local`,
    name: actor.name || "Pengguna",
  };

  return createOneNotification(db, {
    receiver: receiverFixed,
    actor: actorFixed,
    type: input.type as NotificationType,
    title: input.title,
    message: input.message ?? "",
    ...(input.targetId ? { targetId: input.targetId } : {}),
    ...(input.link ? { link: input.link } : {}),
    ...(input.icon ? { icon: input.icon } : {}),
    ...(input.imageUrl ? { imageUrl: input.imageUrl } : {}),
    ...(input.meta ? { meta: input.meta } : {}),
    isPushSent: input.isPushSent ?? false,
  });
}

// ─── Read (filter + offset | cursor) ──────────────────────────────────────────

export async function getNotifications(
  db: Db,
  query: GetNotificationsQuery,
): Promise<GetNotificationsResult> {
  const q = normalizeListQuery(query);
  const col = db.collection(NOTIFICATIONS_COLLECTION);
  const filterBase = buildListFilter(q);

  let unreadCount: number | undefined;
  if (q.includeUnreadCount && q.receiverId) {
    unreadCount = await countUnreadForReceiver(db, q.receiverId);
  }

  const useCursor = Boolean(q.cursor?.trim());
  let cursorFilter: Filter<Document> = {};
  if (useCursor) {
    const parsed = decodeCursor(q.cursor!.trim());
    if (!parsed) {
      throw Object.assign(new Error("cursor tidak valid"), { status: 400 });
    }
    cursorFilter = cursorOlderThanFilter(parsed);
  }

  const filter: Filter<Document> =
    Object.keys(cursorFilter).length === 0
      ? filterBase
      : Object.keys(filterBase).length === 0
        ? cursorFilter
        : { $and: [filterBase, cursorFilter] };

  const fetchLimit = q.safeLimit + 1;

  if (useCursor) {
    const docs = await col
      .find(filter)
      .sort(SORT)
      .limit(fetchLimit)
      .toArray();

    const hasMore = docs.length > q.safeLimit;
    const slice = hasMore ? docs.slice(0, q.safeLimit) : docs;
    const last = slice[slice.length - 1];
    const nextCursor =
      hasMore && last
        ? encodeCursor(
            toDate((last as Document).createdAt),
            last._id as ObjectId,
          )
        : null;

    return {
      notifications: slice.map((d) =>
        docToNotification(d as WithId<Document>),
      ),
      limit: q.safeLimit,
      hasMore,
      nextCursor,
      ...(unreadCount !== undefined ? { unreadCount } : {}),
    };
  }

  const skip = (q.page! - 1) * q.safeLimit;
  const [docs, total] = await Promise.all([
    col.find(filter).sort(SORT).skip(skip).limit(fetchLimit).toArray(),
    col.countDocuments(filter),
  ]);

  const hasMore = docs.length > q.safeLimit;
  const slice = hasMore ? docs.slice(0, q.safeLimit) : docs;
  const last = slice[slice.length - 1];
  const nextCursor =
    hasMore && last
      ? encodeCursor(
          toDate((last as Document).createdAt),
          last._id as ObjectId,
        )
      : null;

  return {
    notifications: slice.map((d) =>
      docToNotification(d as WithId<Document>),
    ),
    total,
    page: q.page,
    limit: q.safeLimit,
    hasMore,
    nextCursor,
    ...(unreadCount !== undefined ? { unreadCount } : {}),
  };
}

// ─── Mark read ────────────────────────────────────────────────────────────────

export async function markOneRead(
  db: Db,
  notificationId: string | ObjectId,
  receiverUserId: string | ObjectId,
): Promise<boolean> {
  const nid =
    typeof notificationId === "string"
      ? notificationId.trim()
      : notificationId.toHexString();
  if (!ObjectId.isValid(nid)) return false;

  const rid =
    typeof receiverUserId === "string"
      ? receiverUserId.trim()
      : receiverUserId.toHexString();

  const col = db.collection(NOTIFICATIONS_COLLECTION);
  const receiverMatch = refIdMatchFilter("receiver._id", rid);
  const now = new Date();

  const result = await col.updateOne(
    {
      _id: new ObjectId(nid),
      ...receiverMatch,
      $or: [{ readAt: null }, { readAt: { $exists: false } }],
    },
    { $set: { readAt: now } },
  );

  return result.modifiedCount > 0;
}

export async function markAllRead(
  db: Db,
  receiverUserId: string | ObjectId,
): Promise<number> {
  const rid =
    typeof receiverUserId === "string"
      ? receiverUserId.trim()
      : receiverUserId.toHexString();

  const col = db.collection(NOTIFICATIONS_COLLECTION);
  const receiverMatch = refIdMatchFilter("receiver._id", rid);
  const now = new Date();

  const result = await col.updateMany(
    {
      ...receiverMatch,
      $or: [{ readAt: null }, { readAt: { $exists: false } }],
    },
    { $set: { readAt: now } },
  );

  return result.modifiedCount;
}
