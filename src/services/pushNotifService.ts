/**
 * Push Notification Service (Server-side)
 *
 * Bertanggung jawab atas:
 * - Menyimpan FCM token user ke collection push_tokens
 * - Menghapus token saat user logout atau unsubscribe
 * - Mengirim push notification ke penulis/user tertentu
 */

import { Db, ObjectId } from "mongodb";
import { sendFcmMessage, sendFcmMulticast } from "@/lib/firebaseAdmin";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PushToken {
  _id?: string;
  userId: string;
  token: string;
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SendPushPayload {
  title: string;
  body: string;
  link?: string;
}

// ─── Token Management ─────────────────────────────────────────────────────────

/**
 * Simpan atau update FCM token untuk user tertentu.
 * Menggunakan upsert: satu token hanya disimpan satu kali.
 */
export async function savePushToken(
  db: Db,
  userId: string,
  token: string,
  userAgent?: string,
): Promise<void> {
  const now = new Date();
  await db.collection("push_tokens").updateOne(
    { token }, // upsert berdasarkan token (bukan userId) karena satu user bisa punya banyak device
    {
      $set: {
        userId: new ObjectId(userId),
        token,
        userAgent: userAgent ?? null,
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true },
  );
}

/**
 * Hapus token tertentu dari database (saat logout atau unsubscribe).
 */
export async function deletePushToken(db: Db, token: string): Promise<void> {
  await db.collection("push_tokens").deleteOne({ token });
}

/**
 * Hapus semua token milik user tertentu (saat logout semua device).
 */
export async function deleteAllPushTokensByUser(
  db: Db,
  userId: string,
): Promise<void> {
  await db
    .collection("push_tokens")
    .deleteMany({ userId: new ObjectId(userId) });
}

/**
 * Ambil semua token aktif milik user tertentu.
 */
async function getPushTokensByUser(db: Db, userId: string): Promise<string[]> {
  const docs = await db
    .collection("push_tokens")
    .find({ userId: new ObjectId(userId) })
    .project({ token: 1 })
    .toArray();
  return docs.map((d) => d.token as string);
}

/**
 * Hapus token-token yang sudah expired/invalid dari database.
 */
async function cleanupExpiredTokens(
  db: Db,
  expiredTokens: string[],
): Promise<void> {
  if (!expiredTokens.length) return;
  await db
    .collection("push_tokens")
    .deleteMany({ token: { $in: expiredTokens } });
}

// ─── Send Push ────────────────────────────────────────────────────────────────

/**
 * Kirim push notification ke semua device aktif milik user tertentu.
 * Token yang expired/invalid akan otomatis dihapus dari database.
 */
export async function sendPushToUser(
  db: Db,
  userId: string,
  payload: SendPushPayload,
): Promise<void> {
  const tokens = await getPushTokensByUser(db, userId);
  if (!tokens.length) return; // user belum subscribe push notification

  const { expiredTokens } = await sendFcmMulticast(tokens, payload);

  // Bersihkan token yang sudah tidak valid
  await cleanupExpiredTokens(db, expiredTokens);
}

/**
 * Kirim push notification ke banyak user sekaligus.
 * Token yang expired/invalid akan otomatis dihapus dari database.
 */
export async function sendPushToUsers(
  db: Db,
  userIds: string[],
  payload: SendPushPayload,
): Promise<void> {
  if (!userIds.length) return;

  // Ambil semua token dari semua user sekaligus (lebih efisien dari N query)
  const docs = await db
    .collection("push_tokens")
    .find({ userId: { $in: userIds.map((id) => new ObjectId(id)) } })
    .project({ token: 1 })
    .toArray();

  const tokens = docs.map((d) => d.token as string);
  if (!tokens.length) return;

  const { expiredTokens } = await sendFcmMulticast(tokens, payload);
  await cleanupExpiredTokens(db, expiredTokens);
}
