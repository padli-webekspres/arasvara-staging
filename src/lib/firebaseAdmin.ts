/**
 * Firebase Admin SDK - Server-side only.
 * Digunakan untuk mengirim push notification dari backend ke FCM.
 *
 * Setup:
 *  1. Firebase Console → Project Settings → Service Accounts
 *  2. "Generate new private key" → Download JSON
 *  3. Encode ke base64: Buffer.from(JSON.stringify(json)).toString("base64")
 *  4. Simpan hasil encode ke FIREBASE_SERVICE_ACCOUNT di .env
 */

import admin from "firebase-admin";

let initialized = false;

/**
 * Inisialisasi Firebase Admin SDK sekali saja (singleton).
 * Mengembalikan false jika credential tidak tersedia.
 */
export function initFirebaseAdmin(): boolean {
  if (initialized || admin.apps.length > 0) {
    initialized = true;
    return true;
  }

  const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!serviceAccountBase64) {
    // Belum dikonfigurasi — push notification akan dilewati secara silent
    return false;
  }

  try {
    const serviceAccount = JSON.parse(
      Buffer.from(serviceAccountBase64, "base64").toString("utf-8"),
    );
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    initialized = true;
    return true;
  } catch (err) {
    console.error("[FirebaseAdmin] Gagal inisialisasi:", err);
    return false;
  }
}

/**
 * Kirim push notification ke satu FCM token.
 * Mengembalikan true jika berhasil, false jika gagal.
 */
export async function sendFcmMessage(
  token: string,
  payload: { title: string; body: string; link?: string },
): Promise<boolean> {
  if (!initFirebaseAdmin()) return false;

  try {
    await admin.messaging().send({
      token,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      webpush: payload.link
        ? {
            fcmOptions: { link: payload.link },
          }
        : undefined,
    });
    return true;
  } catch (err: any) {
    // Token tidak valid/expired — bisa langsung dihapus dari DB
    const isInvalidToken =
      err?.code === "messaging/invalid-registration-token" ||
      err?.code === "messaging/registration-token-not-registered";

    if (!isInvalidToken) {
      console.error("[FCM] Gagal kirim pesan:", err?.message ?? err);
    }

    return false;
  }
}

/**
 * Kirim push notification ke banyak FCM token sekaligus.
 * Mengembalikan daftar token yang sudah expired/invalid untuk dihapus.
 */
export async function sendFcmMulticast(
  tokens: string[],
  payload: { title: string; body: string; link?: string },
): Promise<{ expiredTokens: string[] }> {
  if (!initFirebaseAdmin() || tokens.length === 0) {
    return { expiredTokens: [] };
  }

  const expiredTokens: string[] = [];

  // FCM v1 API tidak support multicast langsung, kirim secara parallel
  await Promise.all(
    tokens.map(async (token) => {
      const success = await sendFcmMessage(token, payload);
      if (!success) expiredTokens.push(token);
    }),
  );

  return { expiredTokens };
}
