"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/axios";
import { User } from "@/types/user";
import { ROLES } from "@/lib/constants";
import { formatDateReadable } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle,
  XCircle,
  Mail,
  Calendar,
  Shield,
  FileText,
} from "lucide-react";
import { Button } from "../ui/button";
import Link from "next/link";
import { adminPanelHref } from "@/lib/admin-panel-path";

interface UserDetailDialogProps {
  userId: string | null;
  onOpenChange: (open: boolean) => void;
}

function getAvatarUrl(avatar: User["avatar"]): string | undefined {
  if (!avatar) return undefined;
  if (typeof avatar === "string") return avatar;
  return avatar.url || undefined;
}

function getRoleInfo(roleValue: string) {
  return (
    ROLES.find((r) => r.value === roleValue) ?? {
      label: roleValue,
      color: "bg-gray-400",
    }
  );
}

function DetailRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border last:border-0">
      <span className="mt-0.5 text-muted-foreground shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
        <div className="text-sm font-medium overflow-wrap-anywhere">
          {children}
        </div>
      </div>
    </div>
  );
}

function SkeletonLine({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-md bg-muted ${className ?? ""}`} />
  );
}

function UserDetailSkeleton() {
  return (
    <div className="space-y-6 py-2">
      <div className="flex items-center gap-4">
        <SkeletonLine className="h-16 w-16 rounded-full" />
        <div className="space-y-2">
          <SkeletonLine className="h-5 w-40" />
          <SkeletonLine className="h-4 w-28" />
        </div>
      </div>
      {[1, 2, 3, 4].map((i) => (
        <SkeletonLine key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

export default function UserDetailDialog({
  userId,
  onOpenChange,
}: UserDetailDialogProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["user-detail", userId],
    queryFn: async () => {
      const { data } = await api.get(`/users/${userId}`);
      return data.user as User;
    },
    enabled: !!userId,
    staleTime: 30_000,
  });

  return (
    <Dialog open={!!userId} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>User Detail</DialogTitle>
        </DialogHeader>

        {isLoading && <UserDetailSkeleton />}

        {isError && (
          <p className="text-sm text-destructive py-4 text-center">
            Failed to load user data.
          </p>
        )}

        {data && (
          <div className="space-y-6 py-2">
            {/* Identity header */}
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16 shrink-0">
                  <AvatarImage src={getAvatarUrl(data.avatar)} />
                  <AvatarFallback className="text-xl">
                    {data.name?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h2 className="text-lg font-semibold">{data.name}</h2>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs text-white font-medium ${getRoleInfo(data.role).color}`}
                  >
                    {getRoleInfo(data.role).label}
                  </span>
                </div>
              </div>
              <Button variant="outline">
                <Link href={adminPanelHref(`profile/${data._id}`)}>
                  Lihat Profile
                </Link>
              </Button>
            </div>

            {/* Detail rows */}
            <div className="rounded-lg border border-border px-4">
              <DetailRow icon={<Mail className="h-4 w-4" />} label="Email">
                {data.email}
              </DetailRow>

              <DetailRow
                icon={<Shield className="h-4 w-4" />}
                label="Status Akun"
              >
                {data.isActive !== false ? (
                  <Badge variant="default" className="gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Active
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="gap-1">
                    <XCircle className="h-3 w-3" />
                    Inactive
                  </Badge>
                )}
              </DetailRow>

              <DetailRow icon={<FileText className="h-4 w-4" />} label="Bio">
                {data.bio ? (
                  <span className="text-foreground">{data.bio}</span>
                ) : (
                  <span className="text-muted-foreground italic">No bio</span>
                )}
              </DetailRow>

              <DetailRow icon={<FileText className="h-4 w-4" />} label="Bio">
                {data.team ? (
                  <span className="text-foreground">{data.team?.name}</span>
                ) : (
                  <span className="text-muted-foreground italic">No Team</span>
                )}
              </DetailRow>

              <DetailRow
                icon={<Calendar className="h-4 w-4" />}
                label="Bergabung Pada"
              >
                {data.createdAt
                  ? formatDateReadable(
                      typeof data.createdAt === "string"
                        ? data.createdAt
                        : data.createdAt.toISOString(),
                    )
                  : "-"}
              </DetailRow>

              {data.updatedAt && (
                <DetailRow
                  icon={<Calendar className="h-4 w-4" />}
                  label="Terakhir Diperbarui"
                >
                  {formatDateReadable(
                    typeof data.updatedAt === "string"
                      ? data.updatedAt
                      : data.updatedAt.toISOString(),
                  )}
                </DetailRow>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
