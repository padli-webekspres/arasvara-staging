export interface PushNotifSentMeta {
  title?: string;
  type?: string;
  [key: string]: any;
}

export interface PushNotifSent {
  _id?: string;
  notificationId: string;
  articleId?: string;
  userId: string;
  sentAt: string; // ISO date string
  platform?: "web" | "android" | "ios" | "other";
  meta?: PushNotifSentMeta;
}

export interface PushNotifOpenMeta {
  fromPush?: boolean;
  [key: string]: any;
}

export interface PushNotifOpen {
  _id?: string;
  notificationId: string;
  articleId?: string;
  userId: string;
  openedAt: string; // ISO date string
  platform?: "web" | "android" | "ios" | "other";
  meta?: PushNotifOpenMeta;
}
