import { ObjectId } from "mongodb";
export enum NotificationType {
  // 📝 Article Workflow (Terkait: writeArticleService.ts, coreWriteArticleService.ts)
  ARTICLE_SUBMITTED = "article-submitted", // Writer mengirim draf ke Editor
  ARTICLE_PUBLISHED = "article-published", // Editor menerbitkan artikel Writer
  ARTICLE_REVISION_REQUIRED = "article-revision", // Editor meminta revisi ke Writer
  ARTICLE_REJECTED = "article-rejected", // Artikel ditolak
  ARTICLE_TAKEN_DOWN = "article-taken-down", // Artikel di-takedown
  ARTICLE_DELETED = "article-deleted", // Artikel dihapus

  // 🎯 Curation & Sections (Terkait: carouselSectionService.ts, sectionArticlesService.ts)
  ARTICLE_RAISING = "article-raising", // Artikel Writer dinaikkan ke konten

  // 💰 Ads & Sponsorship (Terkait: AdsHomepageService.ts, sponsorService.ts)
  ADS_RAISED = "ads-raised", // Iklan dinaikkan ke konten
  ADS_TAKEN_DOWN = "ads-taken-down", // Iklan di-takedown

  // 🛡️ System & Auth
  SYSTEM_ANNOUNCEMENT = "system-announcement",
  /** Terbit otomatis dari jadwal (scheduler) */
  SCHEDULE_PUBLISHED = "schedule-published",
  /** Ringkasan perubahan status artikel untuk penerima */
  ARTICLE_APPROVAL = "article-approval",

  /** Alias UI / legacy */
  SYSTEM = "system",
}

export interface NotificationActor {
  _id: string | ObjectId;
  name: string;
  email: string;
  avatarUrl?: string;
}

export interface NotificationPayload {
  receiver: NotificationActor;
  actor: NotificationActor;
  type: NotificationType;

  // ─── Konten Utama (Digunakan untuk In-App & Payload FCM) ───
  title: string;
  message: string;

  // ─── Routing & Navigasi ───
  targetId?: string; // ID spesifik dokumen (Contoh: ID Artikel, ID Iklan)
  link?: string; // URL tujuan jika notif di-klik (Contoh: "/dashboard-cms/articles/123")

  // ─── Visual UI & Push ───
  icon?: string; // Nama icon bawaan UI (misal: "lucide-check-circle")
  imageUrl?: string; // URL gambar untuk In-App thumbnail ATAU FCM BigPicture Push Notif

  // ─── State & Metadata ───
  isPushSent: boolean; // Flag untuk memastikan apakah FCM sudah berhasil terkirim atau gagal
  readAt?: Date | null; // Null berarti "Unread" di In-App
  createdAt: Date;

  // Data tambahan yang dinamis untuk kebutuhan di masa depan
  meta?: Record<string, any>;
}

export interface Notification extends NotificationPayload {
  _id: string | ObjectId;
}

// ─── Public types ─────────────────────────────────────────────────────────────

export type CreateNotificationInput = Omit<
  NotificationPayload,
  "createdAt" | "readAt" | "isPushSent"
> & {
  readAt?: Date | null;
  isPushSent?: boolean;
  createdAt?: Date;
};

export type ReadAtFilterMode = "all" | "unread" | "read";

export interface GetNotificationsQuery {
  receiverId?: string | ObjectId;
  actorId?: string | ObjectId;
  type?: NotificationType | string;
  readAt?: ReadAtFilterMode;
  search?: string;
  limit?: number;
  page?: number;
  cursor?: string | null;
  /** Default true jika receiverId diisi */
  includeUnreadCount?: boolean;

  /** @deprecated gunakan receiverId */
  userId?: string | ObjectId;
  /** @deprecated gunakan page + limit */
  skip?: number;
}

export interface GetNotificationsResult {
  notifications: Notification[];
  total?: number;
  page?: number;
  limit: number;
  hasMore: boolean;
  nextCursor?: string | null;
  unreadCount?: number;
}

/** Payload lama (API admin & writeArticleService) — satu `userId` penerima */
export interface LegacyCreateNotificationInput {
  userId: string;
  type: NotificationType | string;
  title: string;
  message?: string;
  link?: string;
  targetId?: string;
  actor?: {
    _id: string | ObjectId;
    name: string;
    email?: string;
    avatarUrl?: string;
  };
  icon?: string;
  imageUrl?: string;
  meta?: Record<string, unknown>;
  isPushSent?: boolean;
}