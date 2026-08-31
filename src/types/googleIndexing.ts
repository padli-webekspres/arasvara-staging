import { ObjectId } from "mongodb";

/**
 * Google Indexing API notification log
 * Collection: indexing_api_logs
 */
export type IndexingApiLog = {
  _id: ObjectId;
  articleId: ObjectId;
  url: string;
  type: "URL_UPDATED" | "URL_DELETED";
  requestedAt: Date;
  requestedBy: ObjectId; // user who triggered
  success: boolean;
  errorMessage?: string;
  responseData?: unknown; // raw API response
  quotaRemaining?: number;
  dryRun: boolean; // true for test mode
};

/**
 * Daily quota usage summary
 */
export type IndexingQuotaUsage = {
  date: string; // YYYY-MM-DD
  used: number;
  limit: number;
};
