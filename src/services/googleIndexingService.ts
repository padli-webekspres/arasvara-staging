import { google } from "googleapis";
import { readFile } from "fs/promises";
import { ObjectId } from "mongodb";
import { getCollection } from "@/lib/db/db";
import { IndexingApiLog } from "@/types/googleIndexing";
import logger from "@/lib/logger";
const INDEXING_API_SCOPE = "https://www.googleapis.com/auth/indexing";
const DAILY_QUOTA_LIMIT = 200; // Default quota, akan diupdate setelah approval

type NotifyType = "URL_UPDATED" | "URL_DELETED";

interface NotifyResult {
  success: boolean;
  error?: string;
  quotaRemaining?: number;
  responseData?: unknown;
}

/**
 * Get authenticated client for Google Indexing API
 */
async function getAuthClient() {
  // Try Firebase service account first (base64 encoded JSON)
  const firebaseAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT;
  const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

  let credentials;

  if (firebaseAccountBase64) {
    try {
      const decoded = Buffer.from(firebaseAccountBase64, "base64").toString("utf-8");
      credentials = JSON.parse(decoded);
    } catch (e) {
      throw new Error("Invalid FIREBASE_SERVICE_ACCOUNT base64 JSON");
    }
  } else if (keyJson) {
    try {
      credentials = JSON.parse(keyJson);
    } catch (e) {
      throw new Error("Invalid GOOGLE_SERVICE_ACCOUNT_KEY JSON");
    }
  } else if (keyPath) {
    const keyContent = await readFile(keyPath, "utf-8");
    credentials = JSON.parse(keyContent);
  } else {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT, GOOGLE_SERVICE_ACCOUNT_KEY, or GOOGLE_SERVICE_ACCOUNT_KEY_PATH required"
    );
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: [INDEXING_API_SCOPE],
  });

  return auth.getClient();
}

/**
 * Check daily quota usage
 */
async function getQuotaUsage(date: string): Promise<number> {
  const logsCollection = await getCollection("indexing_api_logs");
  
  const startOfDay = new Date(date);
  startOfDay.setUTCHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setUTCHours(23, 59, 59, 999);

  const count = await logsCollection.countDocuments({
    requestedAt: {
      $gte: startOfDay,
      $lte: endOfDay,
    },
    success: true,
    dryRun: false, // Only count real API calls
  });

  return count;
}

/**
 * Get remaining quota for today
 */
async function getRemainingQuota(): Promise<number> {
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const used = await getQuotaUsage(today);
  return Math.max(0, DAILY_QUOTA_LIMIT - used);
}

/**
 * Notify Google Indexing API about URL change
 * 
 * @param articleId - MongoDB ObjectId of article
 * @param url - Full public URL to notify
 * @param type - URL_UPDATED or URL_DELETED
 * @param userId - User who triggered the notification
 * @param dryRun - If true, skip actual API call (test mode)
 */
export async function notifyGoogleIndexing(
  articleId: string | ObjectId,
  url: string,
  type: NotifyType,
  userId: string | ObjectId,
  dryRun = false
): Promise<NotifyResult> {
  const logsCollection = await getCollection("indexing_api_logs");
  const requestedAt = new Date();

  // Feature flag check
  if (process.env.ENABLE_GOOGLE_INDEXING_API !== "true") {
    logger.info("Google Indexing API disabled via feature flag");
    return { success: false, error: "Feature disabled" };
  }

  // Check quota before API call
  const remaining = await getRemainingQuota();
  if (remaining <= 0 && !dryRun) {
    logger.warn({ url, articleId }, "Google Indexing API quota exhausted");
    
    await logsCollection.insertOne({
      _id: new ObjectId(),
      articleId: new ObjectId(articleId),
      url,
      type,
      requestedAt,
      requestedBy: new ObjectId(userId),
      success: false,
      errorMessage: "Daily quota exhausted",
      dryRun: false,
    } as IndexingApiLog);

    return {
      success: false,
      error: "Daily quota exhausted",
      quotaRemaining: 0,
    };
  }

  // Dry run mode: log only, no API call
  if (dryRun) {
    logger.info({ url, articleId, type }, "Google Indexing API dry-run mode");
    
    await logsCollection.insertOne({
      _id: new ObjectId(),
      articleId: new ObjectId(articleId),
      url,
      type,
      requestedAt,
      requestedBy: new ObjectId(userId),
      success: true,
      dryRun: true,
      quotaRemaining: remaining,
    } as IndexingApiLog);

    return {
      success: true,
      quotaRemaining: remaining,
      responseData: { dryRun: true },
    };
  }

  // Real API call
  try {
    const authClient = await getAuthClient();
    const indexing = google.indexing({ version: "v3", auth: authClient as any });

    logger.info({ url, type }, "Google Indexing API: sending notification");

    const response = await indexing.urlNotifications.publish({
      requestBody: {
        url,
        type,
      },
    });

    logger.info(
      { url, responseData: response.data },
      "Google Indexing API: success"
    );

    // Log success
    await logsCollection.insertOne({
      _id: new ObjectId(),
      articleId: new ObjectId(articleId),
      url,
      type,
      requestedAt,
      requestedBy: new ObjectId(userId),
      success: true,
      responseData: response.data,
      dryRun: false,
      quotaRemaining: remaining - 1,
    } as IndexingApiLog);

    return {
      success: true,
      quotaRemaining: remaining - 1,
      responseData: response.data,
    };
  } catch (error: any) {
    const errorMessage = error?.message || "Unknown error";
    const statusCode = error?.response?.status;

    logger.error(
      { url, articleId, error: errorMessage, statusCode },
      "Google Indexing API failed"
    );

    // Log failure
    await logsCollection.insertOne({
      _id: new ObjectId(),
      articleId: new ObjectId(articleId),
      url,
      type,
      requestedAt,
      requestedBy: new ObjectId(userId),
      success: false,
      errorMessage: `${statusCode || "ERROR"}: ${errorMessage}`,
      dryRun: false,
      quotaRemaining: remaining,
    } as IndexingApiLog);

    return {
      success: false,
      error: errorMessage,
      quotaRemaining: remaining,
    };
  }
}

/**
 * Get recent boosted articles (for dashboard widget)
 */
export async function getRecentBoostedArticles(limit = 10) {
  const logsCollection = await getCollection("indexing_api_logs");
  const articlesCollection = await getCollection("articles");

  const recentLogs = await logsCollection
    .find({
      success: true,
      dryRun: false,
      type: "URL_UPDATED",
    })
    .sort({ requestedAt: -1 })
    .limit(limit)
    .toArray();

  // Fetch article details
  const articleIds = recentLogs.map((log: any) => log.articleId);
  const articles = await articlesCollection
    .find({ _id: { $in: articleIds } })
    .toArray();

  // Map logs to articles
  return recentLogs.map((log: any) => {
    const article = articles.find((a) => a._id.equals(log.articleId));
    return {
      id: log._id.toString(),
      articleId: log.articleId.toString(),
      title: article?.title || "Unknown",
      author: article?.author?.name || "Unknown",
      boostedAt: log.requestedAt,
      url: log.url,
      status: log.success ? "success" : "failed",
    };
  });
}

/**
 * Get today's quota usage summary
 */
export async function getTodayQuotaUsage() {
  const today = new Date().toISOString().split("T")[0];
  const used = await getQuotaUsage(today);
  const remaining = Math.max(0, DAILY_QUOTA_LIMIT - used);

  return {
    date: today,
    used,
    limit: DAILY_QUOTA_LIMIT,
    remaining,
    percentage: (used / DAILY_QUOTA_LIMIT) * 100,
  };
}
