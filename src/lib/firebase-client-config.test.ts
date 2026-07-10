import { describe, expect, it, afterEach } from "vitest";
import {
  FIREBASE_DEV_CLIENT_CONFIG,
  FIREBASE_PROD_CLIENT_CONFIG,
  resolveFirebaseClientConfig,
  resolveFirebaseVapidKey,
} from "@/lib/firebase-client-config";

const ENV_KEYS = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
  "NEXT_PUBLIC_FIREBASE_VAPID_KEY",
  "NODE_ENV",
] as const;

const originalEnv = Object.fromEntries(
  ENV_KEYS.map((key) => [key, process.env[key]]),
) as Record<(typeof ENV_KEYS)[number], string | undefined>;

function restoreEnv() {
  for (const key of ENV_KEYS) {
    const value = originalEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

describe("resolveFirebaseClientConfig", () => {
  afterEach(() => {
    restoreEnv();
  });

  it("menggunakan env lengkap jika tersedia", () => {
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY = "env-api-key";
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = "env.firebaseapp.com";
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "env-project";
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = "env.firebasestorage.app";
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = "123";
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID = "1:123:web:abc";

    const config = resolveFirebaseClientConfig();
    expect(config.projectId).toBe("env-project");
    expect(config.apiKey).toBe("env-api-key");
  });

  it("fallback ke prod saat env kosong dan NODE_ENV production", () => {
    process.env.NODE_ENV = "production";
    delete process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

    const config = resolveFirebaseClientConfig();
    expect(config).toEqual(FIREBASE_PROD_CLIENT_CONFIG);
  });

  it("fallback ke dev saat env kosong dan NODE_ENV development", () => {
    process.env.NODE_ENV = "development";
    delete process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

    const config = resolveFirebaseClientConfig();
    expect(config).toEqual(FIREBASE_DEV_CLIENT_CONFIG);
  });
});

describe("resolveFirebaseVapidKey", () => {
  afterEach(() => {
    restoreEnv();
  });

  it("menggunakan env jika ada", () => {
    process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY = "env-vapid";
    expect(resolveFirebaseVapidKey()).toBe("env-vapid");
  });

  it("fallback ke prod vapid jika env kosong", () => {
    delete process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
    expect(resolveFirebaseVapidKey()).toMatch(/^B/);
  });
});
