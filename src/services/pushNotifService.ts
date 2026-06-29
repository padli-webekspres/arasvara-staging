/**
 * Push Notification Service (Server-side)
 *
 * Bertanggung jawab atas:
 * - Menyimpan FCM token user ke collection push_tokens
 * - Menghapus token saat user logout atau unsubscribe
 * - Mengirim push notification ke penulis/user tertentu
 */

import { Db, ObjectId } from "mongodb";
import {
  initFirebaseAdmin,
  sendFcmMessage,
  sendFcmMulticast,
  sendFcmToTopic,
  subscribeTokenToCategoryTopic,
  toCategoryTopic,
} from "@/lib/firebaseAdmin";
import {
  buildAbsoluteUrl,
  getSiteBaseUrl,
  resolveFeaturedImageAbsoluteUrl,
} from "@/lib/og-image";
import type { ArticleMedia } from "@/types/article";
import logger from "@/lib/logger";

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

export interface SendPushResult {
  firebaseConfigured: boolean;
  tokenCount: number;
  sentCount: number;
  failedCount: number;
}

/**
 * Kirim push ke user dan kembalikan ringkasan hasil (untuk debugging).
 */
export async function sendPushToUserWithResult(
  db: Db,
  userId: string,
  payload: SendPushPayload,
): Promise<SendPushResult> {
  const firebaseConfigured = initFirebaseAdmin();
  if (!firebaseConfigured) {
    return {
      firebaseConfigured: false,
      tokenCount: 0,
      sentCount: 0,
      failedCount: 0,
    };
  }

  const tokens = await getPushTokensByUser(db, userId);
  if (!tokens.length) {
    return {
      firebaseConfigured: true,
      tokenCount: 0,
      sentCount: 0,
      failedCount: 0,
    };
  }

  let sentCount = 0;
  const expiredTokens: string[] = [];

  const results = await Promise.all(
    tokens.map((token) => sendFcmMessage(token, payload)),
  );

  results.forEach((success, index) => {
    if (success) {
      sentCount += 1;
    } else {
      expiredTokens.push(tokens[index]);
    }
  });

  await cleanupExpiredTokens(db, expiredTokens);

  return {
    firebaseConfigured: true,
    tokenCount: tokens.length,
    sentCount,
    failedCount: tokens.length - sentCount,
  };
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

// ─── Category topic subscriptions (guest + logged-in) ───────────────────────

export interface CategoryPushSubscription {
  token: string;
  categorySlug: string;
  userId?: ObjectId | null;
  userAgent?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Simpan subscription kategori + subscribe token ke FCM topic.
 */
export async function saveCategoryPushSubscription(
  db: Db,
  params: {
    token: string;
    categorySlug: string;
    userId?: string | null;
    userAgent?: string;
  },
): Promise<boolean> {
  const slug = params.categorySlug.trim().toLowerCase();
  const token = params.token.trim();
  if (!slug || !token) return false;

  const subscribed = await subscribeTokenToCategoryTopic(token, slug);
  if (!subscribed) return false;

  const now = new Date();
  const userOid =
    params.userId && ObjectId.isValid(params.userId)
      ? new ObjectId(params.userId)
      : null;

  await db.collection("category_push_subscriptions").updateOne(
    { token, categorySlug: slug },
    {
      $set: {
        token,
        categorySlug: slug,
        userId: userOid,
        userAgent: params.userAgent ?? null,
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true },
  );

  return true;
}

type ArticlePublishNotifyInput = {
  title?: string;
  publicPath?: string | null;
  featuredImage?: ArticleMedia | string | null;
  categoryId?: ObjectId | string | null;
  category?: { slug?: string; name?: string } | null;
};

/**
 * Kirim push ke subscriber topic kategori saat artikel baru dipublish.
 */
export async function notifyCategoryOnArticlePublished(
  db: Db,
  article: ArticlePublishNotifyInput,
): Promise<void> {
  if (!initFirebaseAdmin()) return;

  let categorySlug = article.category?.slug?.trim().toLowerCase() ?? "";
  let categoryName = article.category?.name?.trim() ?? "";

  if (!categorySlug && article.categoryId) {
    const cid =
      article.categoryId instanceof ObjectId
        ? article.categoryId
        : new ObjectId(String(article.categoryId));
    const cat = await db
      .collection("categories")
      .findOne({ _id: cid }, { projection: { slug: 1, name: 1 } });
    categorySlug = String(cat?.slug ?? "")
      .trim()
      .toLowerCase();
    categoryName = String(cat?.name ?? "").trim();
  }

  if (!categorySlug) {
    logger.warn(
      "notifyCategoryOnArticlePublished: category slug tidak ditemukan",
    );
    return;
  }

  const titleStr = String(article.title ?? "").trim();
  if (!titleStr) return;

  const displayName = categoryName || categorySlug;
  const publicPath = article.publicPath?.trim();
  const baseUrl = getSiteBaseUrl();
  const link = publicPath
    ? publicPath.startsWith("http")
      ? publicPath
      : buildAbsoluteUrl(publicPath, baseUrl)
    : baseUrl;

  const imageUrl = resolveFeaturedImageAbsoluteUrl(
    article.featuredImage ?? null,
    baseUrl,
  );

  

  const topic = toCategoryTopic(categorySlug);
  const sent = await sendFcmToTopic(topic, {
    title: `Ada yang baru buat kamu di ${displayName}`,
    body: `Intip yuk: ${titleStr}`,
    link,
    imageUrl,
  });

  if (!sent) {
    logger.warn(
      { topic, articleTitle: titleStr },
      "notifyCategoryOnArticlePublished: gagal kirim push topic",
    );
  }
}
