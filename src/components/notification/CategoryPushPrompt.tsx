"use client";

import { useCallback, useEffect, useState } from "react";
import { BellRing, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getPushEnvironmentIssue } from "@/lib/firebase-host";
import {
  categoryPromptSessionKey,
  isSubscribedToCategory,
  useCategoryPushSubscription,
} from "@/hooks/useCategoryPushSubscription";

interface CategoryPushPromptProps {
  categorySlug: string;
  categoryName: string;
}

export default function CategoryPushPrompt({
  categorySlug,
  categoryName,
}: CategoryPushPromptProps) {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const { subscribeToCategory } = useCategoryPushSubscription();

  const slug = categorySlug?.trim().toLowerCase();
  const displayName = categoryName?.trim() || slug;

  useEffect(() => {
    if (!slug) return;

    const envIssue = getPushEnvironmentIssue();
    if (envIssue) return;

    if (typeof window === "undefined") return;
    if (Notification.permission === "denied") return;
    if (isSubscribedToCategory(slug)) return;

    const sessionKey = categoryPromptSessionKey(slug);
    if (sessionStorage.getItem(sessionKey) === "1") return;

    const timer = setTimeout(() => {
      setVisible(true);
      sessionStorage.setItem(sessionKey, "1");
    }, 2500);

    return () => clearTimeout(timer);
  }, [slug]);

  const handleDismiss = useCallback(() => {
    setVisible(false);
  }, []);

  const handleSubscribe = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    try {
      const result = await subscribeToCategory(slug);
      if (!result.ok) {
        toast.error(result.reason);
        return;
      }
      toast.success(`Notifikasi ${displayName} aktif.`);
      setVisible(false);
    } finally {
      setLoading(false);
    }
  }, [displayName, slug, subscribeToCategory]);

  if (!visible || !slug) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 w-[min(100vw-2rem,22rem)] rounded-lg border border-border bg-background/95 p-4 shadow-lg backdrop-blur"
      role="dialog"
      aria-label={`Subscribe notifikasi kategori ${displayName}`}
    >
      <button
        type="button"
        onClick={handleDismiss}
        className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground hover:bg-muted"
        aria-label="Tutup"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex gap-3 pr-6">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <BellRing className="h-5 w-5" />
        </div>
        <div className="min-w-0 space-y-2">
          <p className="text-sm font-semibold leading-snug">
            Ikuti berita {displayName}?
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Dapatkan notifikasi saat ada artikel baru di kategori ini.
          </p>
          <Button
            type="button"
            size="sm"
            className="w-full"
            disabled={loading}
            onClick={() => void handleSubscribe()}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Aktifkan notifikasi"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
