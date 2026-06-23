import { connectToDatabase } from "@/lib/db/db";
import { PushNotifSent, PushNotifOpen } from "@/types/analytics/pushNotif";

const COLLECTION_SENT = "push_sent";
const COLLECTION_OPEN = "push_open";

// Simpan event push sent
export async function createPushSent(
  data: PushNotifSent,
): Promise<PushNotifSent> {
  const db = await connectToDatabase();
  const { _id, ...rest } = data;
  const doc = { ...rest, sentAt: data.sentAt || new Date().toISOString() };
  const result = await db.collection(COLLECTION_SENT).insertOne(doc);
  return { ...doc, _id: result.insertedId.toString() };
}

// Simpan event push open
export async function createPushOpen(
  data: PushNotifOpen,
): Promise<PushNotifOpen> {
  const db = await connectToDatabase();
  const { _id, ...rest } = data;
  const doc = { ...rest, openedAt: data.openedAt || new Date().toISOString() };
  const result = await db.collection(COLLECTION_OPEN).insertOne(doc);
  return { ...doc, _id: result.insertedId.toString() };
}

// Ambil statistik push notification (sent/open rate per notifikasi)
export async function getPushStats(
  params: {
    notificationId?: string;
    articleId?: string;
    userId?: string;
    startDate?: string;
    endDate?: string;
  } = {},
) {
  const db = await connectToDatabase();
  const matchSent: any = {};
  const matchOpen: any = {};
  if (params.notificationId)
    matchSent.notificationId = matchOpen.notificationId = params.notificationId;
  if (params.articleId)
    matchSent.articleId = matchOpen.articleId = params.articleId;
  if (params.userId) matchSent.userId = matchOpen.userId = params.userId;
  if (params.startDate) {
    matchSent.sentAt = { ...(matchSent.sentAt || {}), $gte: params.startDate };
    matchOpen.openedAt = {
      ...(matchOpen.openedAt || {}),
      $gte: params.startDate,
    };
  }
  if (params.endDate) {
    matchSent.sentAt = { ...(matchSent.sentAt || {}), $lte: params.endDate };
    matchOpen.openedAt = {
      ...(matchOpen.openedAt || {}),
      $lte: params.endDate,
    };
  }
  const [sentCount, openCount] = await Promise.all([
    db.collection(COLLECTION_SENT).countDocuments(matchSent),
    db.collection(COLLECTION_OPEN).countDocuments(matchOpen),
  ]);
  return {
    sent: sentCount,
    open: openCount,
    openRate: sentCount > 0 ? openCount / sentCount : 0,
  };
}
