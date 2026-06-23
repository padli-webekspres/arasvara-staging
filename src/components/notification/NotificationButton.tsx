"use client";

import { useEffect, useRef } from "react";
import { Bell, CheckCheck, RotateCcw } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "../ui/button";
import { Separator } from "../ui/separator";
import NotificationItem from "../notification/NotificationItem";
import { useNotifications } from "@/hooks/useNotifications";

const NotificationButton = () => {
  const {
    notifications,
    unreadCount,
    hasMore,
    isLoading,
    loadMore,
    markOneRead,
    markAllRead,
    reload,
    isReloading,
  } = useNotifications();

  // ─── Infinite scroll: sentuh bawah list → load more ──────────────────────
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!bottomRef.current || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { threshold: 0.1 },
    );
    observer.observe(bottomRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-0 right-0 bg-terakota text-white text-[10px] rounded-full h-4 w-4 flex items-center justify-center font-medium">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 md:w-96 p-0 bg-white">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <h4 className="text-sm font-semibold">Notifikasi</h4>
            {unreadCount > 0 && (
              <p className="text-xs font-normal text-muted-foreground">
                ({unreadCount} belum dibaca)
              </p>
            )}
          </div>
          <div className="flex flex-row items-center gap-2 justify-end">
            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-auto py-1 px-2 text-muted-foreground hover:text-foreground"
                onClick={markAllRead}
              >
                <CheckCheck className="w-3.5 h-3.5 mr-1" />
                Tandai semua dibaca
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-auto py-1 px-2 text-muted-foreground hover:text-foreground"
              onClick={reload}
              disabled={isReloading}
              aria-label="Reload notifications"
            >
              <RotateCcw
                className={"w-3.5 h-3.5 " + (isReloading ? "animate-spin" : "")}
              />
            </Button>
          </div>
        </div>

        <Separator />

        {/* List */}
        <div className="max-h-96 overflow-y-auto">
          {isLoading && notifications.length === 0 ? (
            // Skeleton loading
            <div className="flex flex-col gap-1 py-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 px-4 py-3 animate-pulse"
                >
                  <div className="w-9 h-9 rounded-full bg-white-foreground/20 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-white-foreground/20 rounded w-3/4" />
                    <div className="h-3 bg-white-foreground/20 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            // Empty state
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <Bell className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-sm">Tidak ada notifikasi</p>
            </div>
          ) : (
            // List notifikasi
            <div className="flex flex-col divide-y divide-border/50">
              {notifications.map((notif) => (
                <NotificationItem
                  key={String(notif._id)}
                  notification={notif}
                  onRead={markOneRead}
                />
              ))}

              {/* Infinite scroll trigger */}
              <div ref={bottomRef} className="py-1">
                {hasMore && (
                  <p className="text-xs text-center text-muted-foreground py-2 animate-pulse">
                    Memuat lebih banyak...
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationButton;
