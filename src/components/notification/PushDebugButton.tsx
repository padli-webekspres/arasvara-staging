"use client";

import { useCallback, useState } from "react";
import { BellRing, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { usePushNotification } from "@/hooks/usePushNotification";
import api from "@/lib/axios";

const IS_DEV = process.env.NODE_ENV === "development";

export default function PushDebugButton() {
  const {
    subscribe,
    permission,
    environmentIssue,
    isSupportedBrowser,
  } = usePushNotification();
  const [sending, setSending] = useState(false);

  const handleTestPush = useCallback(async () => {
    if (environmentIssue) {
      toast.error(environmentIssue);
      return;
    }

    if (permission === "denied") {
      toast.error(
        "Izin notifikasi diblokir browser. Buka pengaturan situs lalu izinkan notifikasi.",
      );
      return;
    }

    if (isSupportedBrowser === false) {
      toast.error("Browser ini tidak mendukung push notification.");
      return;
    }

    setSending(true);
    try {
      const subscribeResult = await subscribe();
      if (!subscribeResult.ok) {
        toast.error(subscribeResult.reason);
        return;
      }

      const { data } = await api.post("/push-token/test");
      toast.success(data.message ?? "Push notification debug terkirim.");
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { data?: { error?: string; message?: string } };
      };
      const serverMessage =
        axiosErr.response?.data?.error ??
        axiosErr.response?.data?.message ??
        "Gagal mengirim push notification debug.";
      toast.error(serverMessage);
    } finally {
      setSending(false);
    }
  }, [
    environmentIssue,
    isSupportedBrowser,
    permission,
    subscribe,
  ]);

  if (!IS_DEV) return null;

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="gap-2 shrink-0 border-dashed text-muted-foreground"
      onClick={() => void handleTestPush()}
      disabled={sending}
      title="Kirim push notification test ke device ini (development only)"
    >
      {sending ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
      ) : (
        <BellRing className="h-4 w-4 shrink-0" />
      )}
      <span className="hidden sm:inline">Test Push</span>
    </Button>
  );
}
