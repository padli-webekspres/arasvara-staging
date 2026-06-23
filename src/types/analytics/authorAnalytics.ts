import { UserProfile } from "../user";

export interface ArticlesAuthorSummary {
  _id: string;
  title: string;
  slug: string;
  status: "PUBLISHED" | "DRAFT" | "ARCHIVED";
  viewCount: number;
  publishedAt: Date;
  featuredImage?: string;
  category: {
    _id: string;
    name: string;
  };
}

export interface AuthorArticles {
  user: UserProfile;
  articleCount: number;
  currentMonthCount: number;
  currentMonthPublishedCount: number;
  articles: ArticlesAuthorSummary[];
}

export interface AuthorPerformance {
  user: UserProfile;
  totalArticles: number;
  totalViews: number;
  averageViewsPerArticle: number;
  monthlyViews: {
    month: string; // e.g. "2024-06"
    views: number;
  }[];
  articles: ArticlesAuthorSummary[];
}
