/**
 * Firebase Messaging Service Worker
 *
 * File ini HARUS berada di root public/ agar dapat diakses dari /firebase-messaging-sw.js.
 * Bertanggung jawab menampilkan push notification di background (saat tab tidak aktif).
 *
 * CATATAN: Service worker tidak bisa mengakses process.env.
 * Firebase config di-hardcode di sini karena ini adalah file statis.
 * Nilai ini aman di-expose (sama dengan yang ada di NEXT_PUBLIC_*).
 */

importScripts(
  "https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js",
);
importScripts(
  "https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js",
);

// ─── Firebase Config (hardcode karena service worker tidak punya akses env) ──
firebase.initializeApp({
  apiKey: "AIzaSyByuPn34WlPjaILWqhjB-mSxQxQNMzpDSU",
  authDomain: "arasvara-14a8c.firebaseapp.com",
  projectId: "arasvara-14a8c",
  storageBucket: "arasvara-14a8c.firebasestorage.app",
  messagingSenderId: "36293507576",
  appId: "1:36293507576:web:4c0cf78fef4a5c6fe47e0d",
});

const messaging = firebase.messaging();

// ─── Background Message Handler ───────────────────────────────────────────────
// Dipanggil ketika push diterima saat tab/browser tidak aktif
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title ?? "Notifikasi Arasvara";
  const body = payload.notification?.body ?? "";
  const link = payload.fcmOptions?.link ?? "/";

  self.registration.showNotification(title, {
    body,
    icon: "/logo-arasvara/monogram/contained-monogram-hitam-gema.png",
    badge: "/logo-arasvara/monogram/contained-monogram-putih-naskah.png",
    data: { link },
  });
});

// ─── Notification Click Handler ────────────────────────────────────────────────
// Saat user klik notifikasi, buka halaman terkait
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const link = event.notification.data?.link ?? "/";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Jika sudah ada tab yang terbuka, fokus ke tab itu
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.focus();
            client.navigate(link);
            return;
          }
        }
        // Jika tidak ada tab terbuka, buka tab baru
        if (clients.openWindow) {
          return clients.openWindow(link);
        }
      }),
  );
});
