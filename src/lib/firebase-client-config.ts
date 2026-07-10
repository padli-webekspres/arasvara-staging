/**
 * Config Firebase client (browser) — selaras dengan public/firebase-prod.js &
 * public/firebase-dev.js yang dipakai service worker.
 *
 * Env NEXT_PUBLIC_FIREBASE_* tetap diprioritaskan jika tersedia saat build.
 * Fallback dipakai agar production tidak bergantung pada Docker ARG Railway.
 */

export type FirebaseClientConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
};

/** Project arasvara-14a8c (production). */
export const FIREBASE_PROD_CLIENT_CONFIG: FirebaseClientConfig = {
  apiKey: "AIzaSyByuPn34WlPjaILWqhjB-mSxQxQNMzpDSU",
  authDomain: "arasvara-14a8c.firebaseapp.com",
  projectId: "arasvara-14a8c",
  storageBucket: "arasvara-14a8c.firebasestorage.app",
  messagingSenderId: "36293507576",
  appId: "1:36293507576:web:4c0cf78fef4a5c6fe47e0d",
  measurementId: "G-CMFR835YBF",
};

/** Project arasvara-web (development / staging lokal). */
export const FIREBASE_DEV_CLIENT_CONFIG: FirebaseClientConfig = {
  apiKey: "AIzaSyAS5SZgYI1IhAWamFLgooFz6J8hgpBUBFo",
  authDomain: "arasvara-web.firebaseapp.com",
  projectId: "arasvara-web",
  storageBucket: "arasvara-web.firebasestorage.app",
  messagingSenderId: "1001978540835",
  appId: "1:1001978540835:web:79c20f60c8d53a89999296",
  measurementId: "G-YWQ3WTK5J9",
};

/** Web Push VAPID key publik — project arasvara-14a8c. */
export const FIREBASE_PROD_VAPID_KEY =
  "BN-mjS963SQwpJ2WiWABPYHeSwkU4ZhXW38JjPD-GByeyyDjjt3ePpRj_s0vBLC1A0yhJWENgMicoFZ8pa7Ns_U";

const REQUIRED_CONFIG_KEYS = [
  "apiKey",
  "authDomain",
  "projectId",
  "storageBucket",
  "messagingSenderId",
  "appId",
] as const satisfies ReadonlyArray<keyof FirebaseClientConfig>;

function readEnv(name: string): string | undefined {
  const value = process.env[name];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function configFromEnv(): FirebaseClientConfig {
  return {
    apiKey: readEnv("NEXT_PUBLIC_FIREBASE_API_KEY") ?? "",
    authDomain: readEnv("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN") ?? "",
    projectId: readEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID") ?? "",
    storageBucket: readEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET") ?? "",
    messagingSenderId: readEnv("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID") ?? "",
    appId: readEnv("NEXT_PUBLIC_FIREBASE_APP_ID") ?? "",
    measurementId: readEnv("NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID"),
  };
}

function isCompleteConfig(config: FirebaseClientConfig): boolean {
  return REQUIRED_CONFIG_KEYS.every((key) => {
    const value = config[key];
    return typeof value === "string" && value.trim().length > 0;
  });
}

function defaultFallbackConfig(): FirebaseClientConfig {
  return process.env.NODE_ENV === "production"
    ? FIREBASE_PROD_CLIENT_CONFIG
    : FIREBASE_DEV_CLIENT_CONFIG;
}

/** Gabungkan env (jika lengkap) dengan fallback prod/dev. */
export function resolveFirebaseClientConfig(): FirebaseClientConfig {
  const fromEnv = configFromEnv();
  if (isCompleteConfig(fromEnv)) return fromEnv;
  return defaultFallbackConfig();
}

export function getMissingFirebaseClientConfigKeys(
  config: FirebaseClientConfig,
): string[] {
  return REQUIRED_CONFIG_KEYS.filter((key) => {
    const value = config[key];
    return typeof value !== "string" || value.trim().length === 0;
  });
}

/** VAPID key: env build-time, fallback prod. */
export function resolveFirebaseVapidKey(): string {
  return readEnv("NEXT_PUBLIC_FIREBASE_VAPID_KEY") ?? FIREBASE_PROD_VAPID_KEY;
}
