"use client";

import Link from "next/link";
import {
  AlertCircle,
  Bell,
  Calendar,
  ClipboardList,
  Flag,
  Info,
  Megaphone,
  Newspaper,
  Send,
  Settings,
  ShieldAlert,
  Trash2,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Notification, NotificationType } from "@/types/notification";
import { cn } from "@/lib/utils";

// ─── Relative time ────────────────────────────────────────────────────────────

function getRelativeTime(date: Date | string): string {
  const now = Date.now();
  const diff = now - new Date(date).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "baru saja";
  if (minutes < 60) return `${minutes} mnt`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} hr`;
  return new Date(date).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
  });
}

// ─── Icon fallback berdasarkan tipe / field `icon` ─────────────────────────────

function NotificationIcon({ notification }: { notification: Notification }) {
  // Jika ada actor, tampilkan avatar actor
  if (notification.actor) {
    return (
      <Avatar className="w-9 h-9 shrink-0">
        <AvatarImage
          src={notification.actor.avatarUrl}
          alt={notification.actor.name}
        />
        <AvatarFallback className="text-xs">
          {notification.actor.name?.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
    );
  }

  const iconKey = notification.icon ?? notification.type;
  const iconClass = "w-5 h-5 text-primary";

  /** Selaras dengan `NotificationType` di `@/types/notification` */
  const iconMap: Record<string, React.ReactNode> = {
    calendar: <Calendar className={iconClass} />,
    info: <Info className={iconClass} />,

    [NotificationType.ARTICLE_SUBMITTED]: <Send className={iconClass} />,
    [NotificationType.ARTICLE_PUBLISHED]: <Newspaper className={iconClass} />,
    [NotificationType.ARTICLE_REVISION_REQUIRED]: (
      <AlertCircle className={iconClass} />
    ),
    [NotificationType.ARTICLE_REJECTED]: <XCircle className={iconClass} />,
    [NotificationType.ARTICLE_TAKEN_DOWN]: <Flag className={iconClass} />,
    [NotificationType.ARTICLE_DELETED]: <Trash2 className={iconClass} />,
    [NotificationType.ARTICLE_RAISING]: <TrendingUp className={iconClass} />,

    [NotificationType.ADS_RAISED]: <Megaphone className={iconClass} />,
    [NotificationType.ADS_TAKEN_DOWN]: <ShieldAlert className={iconClass} />,

    [NotificationType.SYSTEM_ANNOUNCEMENT]: <Info className={iconClass} />,
    [NotificationType.SCHEDULE_PUBLISHED]: <Calendar className={iconClass} />,
    [NotificationType.ARTICLE_APPROVAL]: (
      <ClipboardList className={iconClass} />
    ),

    [NotificationType.SYSTEM]: <Settings className={iconClass} />,
  };

  return (
    <div className="w-9 h-9 shrink-0 rounded-full bg-muted flex items-center justify-center text-accent">
      {iconMap[iconKey] ?? <Bell className={iconClass} />}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface NotificationItemProps {
  notification: Notification;
  onRead?: (id: string) => void;
}

const NotificationItem = ({ notification, onRead }: NotificationItemProps) => {
  const isUnread = !notification.readAt;
  const idStr = String(notification._id);

  const handleClick = () => {
    if (isUnread) onRead?.(idStr);
  };

  const content = (
    <div
      onClick={handleClick}
      className={cn(
        "flex flex-row items-start gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-background/60",
        isUnread && "bg-background/40",
      )}
    >
      {/* Avatar atau icon */}
      <NotificationIcon notification={notification} />

      {/* Teks */}
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-sm leading-snug line-clamp-2",
            isUnread ? "font-semibold" : "font-normal text-muted-foreground",
          )}
        >
          {notification.title}
        </p>
        {notification.message && (
          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
            {notification.message}
          </p>
        )}
        <p className="text-[11px] text-muted-foreground mt-1">
          {getRelativeTime(notification.createdAt)}
        </p>
      </div>

      {/* Dot unread */}
      {isUnread && (
        <span className="mt-1.5 w-2 h-2 rounded-full bg-terakota shrink-0" />
      )}
    </div>
  );

  if (notification.link) {
    return (
      <Link href={notification.link} className="block">
        {content}
      </Link>
    );
  }

  return content;
};

export default NotificationItem;
