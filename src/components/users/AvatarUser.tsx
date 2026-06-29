"use client";

import type { User } from "@/types/user";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { resolveUserAvatarUrl } from "@/lib/user-avatar";
import { cn, getInitials } from "@/lib/utils";

export interface UserAvatarProps {
  avatar?: User["avatar"] | null;
  name: string;
  className?: string;
  fallbackClassName?: string;
  imageClassName?: string;
}

export default function UserAvatar({
  avatar,
  name,
  className,
  fallbackClassName,
  imageClassName,
}: UserAvatarProps) {
  const imageUrl = resolveUserAvatarUrl(avatar);
  const initials = getInitials(name) || "?";

  return (
    <Avatar className={cn(className)}>
      {imageUrl ? (
        <AvatarImage
          src={imageUrl}
          alt={name}
          className={imageClassName}
        />
      ) : null}
      <AvatarFallback className={fallbackClassName}>{initials}</AvatarFallback>
    </Avatar>
  );
}
