/**
 * Firebase Messaging Service Worker
 *
 * File ini HARUS berada di root public/ agar dapat diakses dari /firebase-messaging-sw.js.
 * Bertanggung jawab menampilkan push notification di background (saat tab tidak aktif).
 *
 * CATATAN: Service worker tidak bisa mengakses process.env.
 * Config dev/prod diambil dari firebase-dev.js / firebase-prod.js berdasarkan hostname.
 */

importScripts(
  "https://www.gstatic.com/firebasejs/12.15.0/firebase-app-compat.js",
);
importScripts(
  "https://www.gstatic.com/firebasejs/12.15.0/firebase-messaging-compat.js",
);

function isLocalDevHost(hostname) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)
  );
}

importScripts(
  isLocalDevHost(self.location.hostname)
    ? "/firebase-dev.js"
    : "/firebase-prod.js",
);

firebase.initializeApp(self.__FIREBASE_MESSAGING_CONFIG__);

const messaging = firebase.messaging();

// Paksa SW baru aktif segera — hindari race condition saat getToken().
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// ─── Background Message Handler ───────────────────────────────────────────────
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title ?? "Notifikasi Arasvara";
  const body = payload.notification?.body ?? "";
  const link =
    payload.fcmOptions?.link ??
    payload.data?.link ??
    "/";
  const image =
    payload.notification?.image ??
    payload.webpush?.notification?.image ??
    payload.data?.image ??
    null;

  self.registration.showNotification(title, {
    body,
    icon: "/logo-arasvara/monogram/contained-monogram-hitam-gema.png",
    badge: "/logo-arasvara/monogram/contained-monogram-putih-naskah.png",
    ...(image ? { image } : {}),
    data: { link },
  });
});

// ─── Notification Click Handler ────────────────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const link = event.notification.data?.link ?? "/";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.focus();
            client.navigate(link);
            return;
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(link);
        }
      }),
  );
});
