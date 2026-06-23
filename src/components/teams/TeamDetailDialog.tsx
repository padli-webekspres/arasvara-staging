"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import api from "@/lib/axios";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";
import type { User } from "@/types/user";

// ── Types ────────────────────────────────────────────────────────────────────
export interface TeamDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string | null;
  teamName: string;
}

interface UserItemData {
  _id: string;
  name: string;
  avatar?: string | { url: string };
  role: string;
}

// ── Helper Functions ─────────────────────────────────────────────────────────
function getAvatarUrl(avatar: UserItemData["avatar"]): string | undefined {
  if (!avatar) return undefined;
  if (typeof avatar === "string") return avatar;
  return avatar.url || undefined;
}

function UserItemSkeleton() {
  return (
    <div className="flex items-center gap-3 py-3 px-4 border-b border-border animate-pulse">
      <div className="h-10 w-10 rounded-full bg-muted shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-32 bg-muted rounded" />
        <div className="h-3 w-20 bg-muted rounded" />
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function TeamDetailDialog({
  open,
  onOpenChange,
  teamId,
  teamName,
}: TeamDetailDialogProps) {
  const [users, setUsers] = useState<UserItemData[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null | undefined>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const observerTarget = useRef<HTMLDivElement>(null);

  // ── Load initial users ────────────────────────────────────────────────────
  const loadInitialUsers = useCallback(async () => {
    if (!teamId) return;

    setIsInitialLoading(true);
    setErrorMessage(null);
    try {
      const response = await api.get(`/teams/${teamId}/users?limit=10`, {
        validateStatus: (status: number) => status < 500,
      });

      if (response.status >= 400) {
        const msg = response.data?.error || "Gagal memuat anggota tim";
        setErrorMessage(msg);
        toast.error(msg);
        return;
      }

      const { users: fetchedUsers, nextCursor: cursor } = response.data;
      setUsers(fetchedUsers || []);
      setNextCursor(cursor || null);
      setHasMore(!!cursor);
    } catch (err: unknown) {
      let msg = "Gagal memuat anggota tim";
      if (err && typeof err === "object") {
        // @ts-expect-error: dynamic error shape
        msg = err?.response?.data?.error || err?.message || msg;
      }
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsInitialLoading(false);
    }
  }, [teamId]);

  // ── Load more users (infinite scroll) ─────────────────────────────────────
  const loadMoreUsers = useCallback(async () => {
    if (!teamId || !hasMore || loadingMore || !nextCursor) return;

    setLoadingMore(true);
    try {
      const response = await api.get(
        `/teams/${teamId}/users?limit=10&cursor=${nextCursor}`,
        {
          validateStatus: (status: number) => status < 500,
        }
      );

      if (response.status >= 400) {
        const msg = response.data?.error || "Gagal memuat lebih banyak anggota";
        toast.error(msg);
        return;
      }

      const { users: fetchedUsers, nextCursor: cursor } = response.data;
      setUsers((prev) => [...prev, ...(fetchedUsers || [])]);
      setNextCursor(cursor || null);
      setHasMore(!!cursor);
    } catch (err: unknown) {
      let msg = "Gagal memuat lebih banyak anggota";
      if (err && typeof err === "object") {
        // @ts-expect-error: dynamic error shape
        msg = err?.response?.data?.error || err?.message || msg;
      }
      toast.error(msg);
    } finally {
      setLoadingMore(false);
    }
  }, [teamId, hasMore, loadingMore, nextCursor]);

  // ── Setup IntersectionObserver for infinite scroll ────────────────────────
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingMore && hasMore) {
          loadMoreUsers();
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [loadMoreUsers, loadingMore, hasMore]);

  // ── Load initial data when dialog opens ───────────────────────────────────
  useEffect(() => {
    if (open && teamId) {
      loadInitialUsers();
    }
  }, [open, teamId, loadInitialUsers]);

  // ── Reset state when dialog closes ───────────────────────────────────────
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setUsers([]);
      setNextCursor(null);
      setHasMore(true);
      setLoadingMore(false);
      setIsInitialLoading(false);
      setErrorMessage(null);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Anggota Tim: {teamName}
          </DialogTitle>
        </DialogHeader>

        {/* Content Container */}
        <div className="flex-1 overflow-y-auto">
          {/* Initial Loading */}
          {isInitialLoading && (
            <div className="space-y-0">
              {[1, 2, 3].map((i) => (
                <UserItemSkeleton key={i} />
              ))}
            </div>
          )}

          {/* Error State */}
          {errorMessage && !isInitialLoading && (
            <div className="py-8 text-center">
              <p className="text-sm text-destructive">{errorMessage}</p>
            </div>
          )}

          {/* Empty State */}
          {!isInitialLoading && users.length === 0 && !errorMessage && (
            <div className="py-12 text-center">
              <p className="text-sm text-muted-foreground">
                Tidak ada anggota di tim ini
              </p>
            </div>
          )}

          {/* Users List */}
          {users.length > 0 && (
            <div className="border border-border rounded-lg divide-y divide-border">
              {users.map((user) => (
                <div
                  key={user._id}
                  className="flex items-center gap-3 py-3 px-4 hover:bg-accent/50 transition-colors"
                >
                  {/* Avatar */}
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarImage src={getAvatarUrl(user.avatar)} />
                    <AvatarFallback>
                      {user.name?.charAt(0).toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>

                  {/* User Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{user.name}</p>
                    <Badge variant="outline" className="text-xs mt-1">
                      {user.role}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Infinite Scroll Trigger */}
          <div ref={observerTarget} className="py-4">
            {loadingMore && (
              <div className="flex justify-center">
                <div className="space-y-2">
                  <UserItemSkeleton />
                  <UserItemSkeleton />
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
