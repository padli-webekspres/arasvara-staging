"use client";

/**
 * usePushNotification Hook
 *
 * Menangani alur subscribe/unsubscribe push notification via FCM:
 * 1. Register service worker
 * 2. Meminta izin push notification dari browser
 * 3. Mendapatkan FCM token
 * 4. Menyimpan/menghapus token ke backend
 *
 * Dirancang untuk dipanggil di komponen yang sudah tahu user sudah login.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { getToken, onMessage } from "firebase/messaging";
import { getFirebaseMessaging } from "@/lib/firebase";
import api from "@/lib/axios";

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ?? "";
const TOKEN_STORAGE_KEY = "fcm_token";

export type PushPermission = "default" | "granted" | "denied" | "unsupported";

export interface UsePushNotificationReturn {
  permission: PushPermission;
  isSubscribed: boolean;
  isLoading: boolean;
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
}

export function usePushNotification(): UsePushNotificationReturn {
  const [permission, setPermission] = useState<PushPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSupportedBrowser, setIsSupportedBrowser] = useState<boolean | null>(null);
  const unsubscribeFnRef = useRef<(() => void) | null>(null);

  // ─── Cek status awal saat mount & periksa dukungan browser secara penuh ───
  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1. Cek dukungan dasar notifikasi dan service worker di browser
    if (
      !("Notification" in window) ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window)
    ) {
      setPermission("unsupported");
      setIsSupportedBrowser(false);
      return;
    }

    // 2. Cek dukungan asinkron Firebase Messaging untuk menghindari error console
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

    const messaging = getFirebaseMessaging();
    if (!messaging) return;

    const unsubscribe = onMessage(messaging, (payload) => {
      // Ketika tab aktif, browser tidak otomatis menampilkan notifikasi OS.
      // Tampilkan via Notification API secara manual jika izin sudah granted.
      if (Notification.permission !== "granted") return;

      const title = payload.notification?.title ?? "Notifikasi Arasvara";
      const body = payload.notification?.body ?? "";

      new Notification(title, {
        body,
        icon: "/logo-arasvara/monogram/contained-monogram-hitam-gema.png",
      });
    });

    unsubscribeFnRef.current = unsubscribe;
    return () => unsubscribe();
  }, [isSupportedBrowser]);

  // ─── Subscribe ────────────────────────────────────────────────────────────

  const subscribe = useCallback(async () => {
    if (typeof window === "undefined" || !isSupportedBrowser) return;

    setIsLoading(true);
    try {
      // 1. Minta izin dari browser
      const result = await Notification.requestPermission();
      setPermission(result as PushPermission);
      if (result !== "granted") return;

      // 2. Register service worker (WAJIB sebelum getToken)
      const registration = await navigator.serviceWorker.register(
        "/firebase-messaging-sw.js",
      );

      // 3. Dapatkan FCM token
      const messaging = getFirebaseMessaging();
      if (!messaging) throw new Error("Firebase Messaging tidak tersedia");

      const token = await getToken(messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: registration,
      });

      if (!token) throw new Error("Gagal mendapatkan FCM token");

      // 4. Simpan token ke backend
      await api.post("/push-token", { token });

      // 5. Simpan token di localStorage sebagai referensi untuk unsubscribe
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
      setIsSubscribed(true);
    } catch (err) {
      // Tambahkan log error lebih detail jika gagal register SW
      if (err instanceof Error && err.message.includes("register")) {
        console.error(
          "[usePushNotification] Gagal register service worker:",
          err,
        );
      } else {
        console.error("[usePushNotification] Subscribe gagal:", err);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ─── Unsubscribe ──────────────────────────────────────────────────────────

  const unsubscribe = useCallback(async () => {
    setIsLoading(true);
    try {
      const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (storedToken) {
        // Hapus token dari backend
        await api.delete("/push-token", { data: { token: storedToken } });
        localStorage.removeItem(TOKEN_STORAGE_KEY);
      }
      setIsSubscribed(false);
    } catch (err) {
      console.error("[usePushNotification] Unsubscribe gagal:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { permission, isSubscribed, isLoading, subscribe, unsubscribe };
}
