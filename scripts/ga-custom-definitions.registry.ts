/**
 * Registry Custom Dimensions & Metrics GA4 — selaras dengan
 * memory/analysis/refactor-data-ganalytics.md §3.3
 */

export type GaDefinitionBatch = "1" | "2" | "3" | "all";

export type GaCustomDimensionDef = {
  displayName: string;
  parameterName: string;
  batch: Exclude<GaDefinitionBatch, "all">;
};

export type GaCustomMetricDef = {
  displayName: string;
  parameterName: string;
  batch: Exclude<GaDefinitionBatch, "all">;
};

/** Event-scoped custom dimensions */
export const GA_CUSTOM_DIMENSIONS: GaCustomDimensionDef[] = [
  { displayName: "Article ID", parameterName: "article_id", batch: "1" },
  { displayName: "Article Slug", parameterName: "article_slug", batch: "1" },
  { displayName: "Article Title", parameterName: "article_title", batch: "1" },
  { displayName: "Article Format", parameterName: "article_format", batch: "1" },
  { displayName: "Author ID", parameterName: "author_id", batch: "1" },
  { displayName: "Author Name", parameterName: "author_name", batch: "1" },
  { displayName: "Editor ID", parameterName: "editor_id", batch: "1" },
  { displayName: "Editor Name", parameterName: "editor_name", batch: "1" },
  { displayName: "Editor Slug", parameterName: "editor_slug", batch: "1" },
  { displayName: "Category ID", parameterName: "category_id", batch: "1" },
  { displayName: "Category Name", parameterName: "category_name", batch: "1" },
  { displayName: "Category Slug", parameterName: "category_slug", batch: "1" },
  { displayName: "Tag 1", parameterName: "tag_1", batch: "1" },
  { displayName: "Tag 2", parameterName: "tag_2", batch: "1" },
  { displayName: "Tag 3", parameterName: "tag_3", batch: "1" },
  { displayName: "Is Breaking", parameterName: "is_breaking", batch: "1" },
  { displayName: "Is Headline", parameterName: "is_headline", batch: "1" },
  { displayName: "Content Page", parameterName: "content_page", batch: "1" },
  { displayName: "Has Video", parameterName: "has_video", batch: "1" },
  { displayName: "Has Gallery", parameterName: "has_gallery", batch: "1" },
  {
    displayName: "Publish Day of Week",
    parameterName: "publish_day_of_week",
    batch: "1",
  },
  { displayName: "User Type", parameterName: "user_type", batch: "1" },
  { displayName: "Referrer Type", parameterName: "referrer_type", batch: "1" },
  { displayName: "Session Source", parameterName: "session_source", batch: "1" },
  { displayName: "Author Slug", parameterName: "author_slug", batch: "2" },
  { displayName: "Scroll Depth", parameterName: "scroll_depth", batch: "2" },
  { displayName: "Share Method", parameterName: "share_method", batch: "2" },
  { displayName: "Content Type", parameterName: "content_type", batch: "2" },
  { displayName: "Click Location", parameterName: "click_location", batch: "2" },
  { displayName: "Search Term", parameterName: "search_term", batch: "2" },
  { displayName: "Ad ID", parameterName: "ad_id", batch: "3" },
  { displayName: "Ad Position", parameterName: "ad_position", batch: "3" },
  { displayName: "Ad Size", parameterName: "ad_size", batch: "3" },
  { displayName: "Ad Sponsor", parameterName: "ad_sponsor", batch: "3" },
  {
    displayName: "Ad Destination URL",
    parameterName: "ad_destination_url",
    batch: "3",
  },
  { displayName: "Notification ID", parameterName: "notification_id", batch: "3" },
  {
    displayName: "Notification Title",
    parameterName: "notification_title",
    batch: "3",
  },
];

/** Event-scoped custom metrics (parameter numerik) */
export const GA_CUSTOM_METRICS: GaCustomMetricDef[] = [
  { displayName: "Article Age Days", parameterName: "article_age_days", batch: "1" },
  { displayName: "Word Count", parameterName: "word_count", batch: "1" },
  { displayName: "Publish Hour", parameterName: "publish_hour", batch: "1" },
  {
    displayName: "Time on Page (seconds)",
    parameterName: "time_on_page_seconds",
    batch: "2",
  },
  { displayName: "Click Position", parameterName: "position", batch: "2" },
  {
    displayName: "Search Results Count",
    parameterName: "results_count",
    batch: "2",
  },
];

export function filterByBatch<T extends { batch: "1" | "2" | "3" }>(
  items: T[],
  batch: GaDefinitionBatch,
): T[] {
  if (batch === "all") return items;
  return items.filter((item) => item.batch === batch);
}
