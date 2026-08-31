"use client";

/**
 * usePushNotification Hook
 *
 * Menangani alur subscribe/unsubscribe push notification via FCM:
 * 1. Register service worker
 * 2. Meminta izin push notification dari browser
 * 3. Mendapatkan FCM token
 * 4. (Opsional) Menyimpan token ke backend jika user login
 *
 * Guest dapat subscribe tanpa login; penyimpanan ke `/api/push-token` opsional.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { AxiosError } from "axios";
import { resolveFirebaseVapidKey } from "@/lib/firebase-client-config";
import { getPushEnvironmentIssue } from "@/lib/firebase-host";
import api from "@/lib/axios";

const VAPID_KEY = resolveFirebaseVapidKey();
const TOKEN_STORAGE_KEY = "fcm_token";
const SUBSCRIBE_TIMEOUT_MS = 20_000;

/** Cegah beberapa komponen memanggil getToken FCM bersamaan (bisa hang). */
let subscribeInFlight: Promise<SubscribeResult> | null = null;

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message: string,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    }),
  ]);
}

async function waitForServiceWorkerActivation(
  registration: ServiceWorkerRegistration,
): Promise<ServiceWorkerRegistration> {
  if (registration.active?.state === "activated") {
    return registration;
  }

  const worker =
    registration.installing ?? registration.waiting ?? registration.active;
  if (!worker) return registration;

  if (worker.state === "activated") return registration;

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new Error(
          "Service worker Firebase tidak aktif. Buka DevTools → Application → Service Workers → Unregister, lalu refresh.",
        ),
      );
    }, SUBSCRIBE_TIMEOUT_MS);

    const onStateChange = () => {
      if (worker.state === "activated") {
        clearTimeout(timer);
        worker.removeEventListener("statechange", onStateChange);
        resolve();
      }
    };

    worker.addEventListener("statechange", onStateChange);
  });

  return registration;
}

function formatFcmError(err: unknown): string {
  const code =
    typeof err === "object" && err !== null && "code" in err
      ? String((err as { code?: string }).code)
      : "";

  if (code === "messaging/permission-blocked") {
    return "Izin notifikasi diblokir browser.";
  }
  if (code === "messaging/token-subscribe-failed") {
    return "Gagal memuat FCM token: periksa VAPID key di Firebase Console (arasvara-web → Cloud Messaging → Web Push certificates).";
  }
  if (code === "messaging/failed-service-worker-registration") {
    return "Service worker Firebase gagal didaftarkan. Pastikan /firebase-messaging-sw.js dapat diakses.";
  }

  const message = err instanceof Error ? err.message : String(err);
  const axiosStatus =
    typeof err === "object" &&
    err !== null &&
    "response" in err &&
    typeof (err as AxiosError).response?.status === "number"
      ? (err as AxiosError).response?.status
      : undefined;

  if (axiosStatus === 401) {
    return "Unauthorized";
  }
  if (/service worker|pushmanager|subscribe/i.test(message)) {
    return `Gagal memuat FCM token: ${message}. Coba unregister service worker lama di DevTools lalu refresh.`;
  }
  if (/token/i.test(message)) {
    return `Gagal memuat FCM token: ${message}`;
  }
  return message;
}

async function requestFcmToken(
  registration: ServiceWorkerRegistration,
): Promise<string> {
  const { getFirebaseMessaging, getFirebaseMessagingError } = await import(
    "@/lib/firebase"
  );
  const { getToken } = await import("firebase/messaging");

  const messaging = getFirebaseMessaging();
  if (!messaging) {
    throw new Error(
      getFirebaseMessagingError() ?? "Firebase Messaging tidak tersedia.",
    );
  }

  const tokenOptions = {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: registration,
  };

  try {
    const token = await withTimeout(
      getToken(messaging, tokenOptions),
      SUBSCRIBE_TIMEOUT_MS,
      "Gagal memuat FCM token (timeout). Coba refresh halaman.",
    );
    if (token) return token;
  } catch (firstErr) {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    try {
      const retryToken = await withTimeout(
        getToken(messaging, tokenOptions),
        SUBSCRIBE_TIMEOUT_MS,
        "Gagal memuat FCM token (timeout). Coba refresh halaman.",
      );
      if (retryToken) return retryToken;
    } catch {
      throw firstErr;
    }
    throw firstErr;
  }

  throw new Error("Gagal memuat FCM token dari Firebase.");
}

export type PushPermission = "default" | "granted" | "denied" | "unsupported";

export type SubscribeResult =
  | { ok: true; token: string }
  | { ok: false; reason: string };

export type SubscribeOptions = {
  /** Simpan token ke POST /api/push-token (hanya untuk user login). Default false. */
  persistToBackend?: boolean;
};

export type UnsubscribeOptions = {
  /** Hapus token dari DELETE /api/push-token (hanya untuk user login). Default false. */
  removeFromBackend?: boolean;
};

export interface UsePushNotificationReturn {
  permission: PushPermission;
  isSubscribed: boolean;
  isLoading: boolean;
  isSupportedBrowser: boolean | null;
  environmentIssue: string | null;
  subscribe: (options?: SubscribeOptions) => Promise<SubscribeResult>;
  unsubscribe: (options?: UnsubscribeOptions) => Promise<void>;
}

async function persistPushTokenToBackend(token: string): Promise<void> {
  await api.post("/push-token", { token });
}

async function removePushTokenFromBackend(token: string): Promise<void> {
  await api.delete("/push-token", { data: { token } });
}

async function checkMessagingSupported(): Promise<boolean> {
  try {
    const { isSupported } = await import("firebase/messaging");
    return isSupported();
  } catch {
    return false;
  }
}

export function usePushNotification(): UsePushNotificationReturn {
  const [permission, setPermission] = useState<PushPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSupportedBrowser, setIsSupportedBrowser] = useState<boolean | null>(
    null,
  );
  const [environmentIssue, setEnvironmentIssue] = useState<string | null>(null);
  const unsubscribeFnRef = useRef<(() => void) | null>(null);

  // ─── Cek status awal saat mount & periksa dukungan browser secara penuh ───
  useEffect(() => {
    if (typeof window === "undefined") return;

    const envIssue = getPushEnvironmentIssue();
    setEnvironmentIssue(envIssue);
    if (envIssue) {
      setPermission("unsupported");
      setIsSupportedBrowser(false);
      return;
    }
    import("firebase/messaging")
      .then(({ isSupported }) => {
        isSupported().then((supported) => {
          setIsSupportedBrowser(supported);
          if (!supported) {
            setPermission("unsupported");
          }
        });
      })
      .catch(() => {
        setIsSupportedBrowser(false);
        setPermission("unsupported");
      });

    const currentPermission = Notification.permission as PushPermission;
    setPermission(currentPermission);

    const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (currentPermission === "granted" && storedToken) {
      setIsSubscribed(true);
    }
  }, []);

  // ─── Listen foreground message (notifikasi ketika tab aktif) ─────────────
  useEffect(() => {
    // Hanya lakukan inisialisasi jika browser terbukti mendukung Firebase Messaging
    if (typeof window === "undefined" || !isSupportedBrowser) return;

    let cancelled = false;
    let unsubscribeForeground: (() => void) | undefined;

    void (async () => {
      try {
        const { getFirebaseMessaging } = await import("@/lib/firebase");
        const { onMessage } = await import("firebase/messaging");
        if (cancelled) return;

        const messaging = getFirebaseMessaging();
        if (!messaging) return;

        unsubscribeForeground = onMessage(messaging, (payload) => {
          if (Notification.permission !== "granted") return;

          const title = payload.notification?.title ?? "Notifikasi Arasvara";
          const body = payload.notification?.body ?? "";

          new Notification(title, {
            body,
            icon: "/logo-arasvara/monogram/contained-monogram-hitam-gema.png",
          });
        });
        unsubscribeFnRef.current = unsubscribeForeground;
      } catch {
        // ponytail: FCM foreground opsional; gagal import = tidak listen.
      }
    })();

    return () => {
      cancelled = true;
      unsubscribeForeground?.();
    };
  }, [isSupportedBrowser]);

  // ─── Subscribe ────────────────────────────────────────────────────────────

  const subscribe = useCallback(async (options?: SubscribeOptions): Promise<SubscribeResult> => {
    const persistToBackend = options?.persistToBackend ?? false;

    if (subscribeInFlight) return subscribeInFlight;

    subscribeInFlight = (async (): Promise<SubscribeResult> => {
      if (typeof window === "undefined") {
        return { ok: false, reason: "Hanya tersedia di browser." };
      }

      const envIssue = getPushEnvironmentIssue();
      if (envIssue) {
        console.warn("[usePushNotification]", envIssue);
        setEnvironmentIssue(envIssue);
        return { ok: false, reason: envIssue };
      }

      const supported =
        isSupportedBrowser === null
          ? await checkMessagingSupported()
          : isSupportedBrowser;

      if (!supported) {
        return {
          ok: false,
          reason: "Browser ini tidak mendukung push notification.",
        };
      }

      if (!VAPID_KEY.trim()) {
        const reason = "NEXT_PUBLIC_FIREBASE_VAPID_KEY belum diset di .env";
        console.error(`[usePushNotification] ${reason}`);
        return { ok: false, reason };
      }

      setIsLoading(true);
      try {
        const result = await Notification.requestPermission();
        setPermission(result as PushPermission);
        if (result !== "granted") {
          return {
            ok: false,
            reason:
              "Izin notifikasi belum diberikan. Aktifkan di pengaturan browser.",
          };
        }

        // Selalu ambil token dari Firebase (bukan hanya localStorage) agar token valid.
        const registration = await withTimeout(
          navigator.serviceWorker.register("/firebase-messaging-sw.js"),
          SUBSCRIBE_TIMEOUT_MS,
          "Gagal mendaftarkan service worker Firebase.",
        );
        await waitForServiceWorkerActivation(registration);

        const token = await requestFcmToken(registration);

        if (persistToBackend) {
          await persistPushTokenToBackend(token);
        }

        localStorage.setItem(TOKEN_STORAGE_KEY, token);
        setIsSubscribed(true);
        return { ok: true, token };
      } catch (err) {
        const reason = formatFcmError(err);
        console.error("[usePushNotification] Subscribe gagal:", err);
        return { ok: false, reason };
      } finally {
        setIsLoading(false);
      }
    })();

    try {
      return await subscribeInFlight;
    } finally {
      subscribeInFlight = null;
    }
  }, [isSupportedBrowser]);

  // ─── Unsubscribe ──────────────────────────────────────────────────────────

  const unsubscribe = useCallback(async (options?: UnsubscribeOptions) => {
    const removeFromBackend = options?.removeFromBackend ?? false;

    setIsLoading(true);
    try {
      const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (storedToken && removeFromBackend) {
        await removePushTokenFromBackend(storedToken);
      }
      if (storedToken) {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
      }
      setIsSubscribed(false);
    } catch (err) {
      console.error("[usePushNotification] Unsubscribe gagal:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    permission,
    isSubscribed,
    isLoading,
    isSupportedBrowser,
    environmentIssue,
    subscribe,
    unsubscribe,
  };
}
