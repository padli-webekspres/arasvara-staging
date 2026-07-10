/**
 * Firebase Client-side Configuration
 * Digunakan untuk mendapatkan FCM token di browser.
 */

import { initializeApp, getApps, getApp } from "firebase/app";
import { getMessaging, type Messaging } from "firebase/messaging";
import {
  getMissingFirebaseClientConfigKeys,
  resolveFirebaseClientConfig,
} from "@/lib/firebase-client-config";

const firebaseConfig = resolveFirebaseClientConfig();

function formatFirebaseInitError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

// Singleton pattern: hindari inisialisasi ulang saat hot reload
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

/** Error terakhir dari getFirebaseMessaging — berguna untuk pesan UI/debug. */
let lastFirebaseMessagingError: string | null = null;

export function getFirebaseMessagingError(): string | null {
  return lastFirebaseMessagingError;
}

/**
 * Lazy-initialize Firebase Messaging (hanya bisa di browser, bukan SSR).
 * Mengembalikan null jika dipanggil di luar browser atau inisialisasi gagal.
 */
export function getFirebaseMessaging(): Messaging | null {
  if (typeof window === "undefined") return null;

  const missingKeys = getMissingFirebaseClientConfigKeys(firebaseConfig);
  if (missingKeys.length > 0) {
    lastFirebaseMessagingError =
      `Konfigurasi Firebase client tidak lengkap: ${missingKeys.join(", ")}.`;
    console.error("[Firebase]", lastFirebaseMessagingError, firebaseConfig);
    return null;
  }

  try {
    const messaging = getMessaging(app);
    lastFirebaseMessagingError = null;
    return messaging;
  } catch (err) {
    lastFirebaseMessagingError = formatFirebaseInitError(err);
    console.error(
      "[Firebase] getMessaging gagal:",
      err,
      { projectId: firebaseConfig.projectId },
    );
    return null;
  }
}

export { app };
