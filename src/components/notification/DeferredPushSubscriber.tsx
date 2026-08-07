"use client";

import dynamic from "next/dynamic";

/**
 * Wrapper client-only: next/dynamic + ssr:false tidak boleh di Server Component layout.
 * Firebase/FCM tetap di luar critical path SSR.
 */
const PushSubscriber = dynamic(
  () => import("@/components/notification/PushSubscriber"),
  { ssr: false },
);

export default function DeferredPushSubscriber() {
  return <PushSubscriber />;
}
