"use client";

/**
 * PushSubscriber
 *
 * Komponen invisible yang dipasang di public layout.
 * - Jika user sudah grant permission & belum punya token → silent auto-subscribe.
 * - Jika belum pernah grant → tidak memunculkan popup (UX best practice).
 *   Subscription pertama dipicu oleh aksi user (misalnya di NotificationButton).
 * - Jika API mengembalikan 401 (belum login) → diabaikan dengan diam.
 */

import { useEffect } from "react";
import { usePushNotification } from "@/hooks/usePushNotification";

export default function PushSubscriber() {
  const { permission, isSubscribed, isLoading, subscribe } =
    usePushNotification();

  useEffect(() => {
    // Hanya lakukan silent subscribe jika:
    // 1. Permission sudah "granted" oleh user sebelumnya
    // 2. Belum tersimpan token di session ini
    // 3. Tidak sedang loading
    if (permission === "granted" && !isSubscribed && !isLoading) {
      subscribe();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permission, isSubscribed, isLoading]);

  // Komponen ini tidak me-render apapun
  return null;
}
