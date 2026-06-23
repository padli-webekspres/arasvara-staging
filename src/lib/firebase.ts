/**
 * Firebase Client-side Configuration
 * Digunakan untuk mendapatkan FCM token di browser.
 * Variabel NEXT_PUBLIC_* aman di-expose ke client.
 */

import { initializeApp, getApps, getApp } from "firebase/app";
import { getMessaging, type Messaging } from "firebase/messaging";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Singleton pattern: hindari inisialisasi ulang saat hot reload
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

/**
 * Lazy-initialize Firebase Messaging (hanya bisa di browser, bukan SSR).
 * Mengembalikan null jika dipanggil di luar browser.
 */
export function getFirebaseMessaging(): Messaging | null {
  if (typeof window === "undefined") return null;
  try {
    return getMessaging(app);
  } catch {
    return null;
  }
}

export { app };
