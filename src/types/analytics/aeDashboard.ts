/** Satu titik tren klik harian (dashboard AE). */
export interface AEClicksTrendDay {
  date: string;
  dateKey: string;
  clicks: number;
  homepageClicks: number;
  articleClicks: number;
  topAds: Array<{ name: string; clicks: number }>;
}

export interface AEAdClickContributor {
  name: string;
  clicks: number;
}

export interface AEArticleCategoryClicks {
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  clicks: number;
  activeAdsCount: number;
  topAds: AEAdClickContributor[];
}

export interface AEPlatformClicks {
  homepageClicks: number;
  articleClicks: number;
  topHomepageAds: AEAdClickContributor[];
  topArticleAds: AEAdClickContributor[];
}

export interface AEExpiringAdItem {
  id: string;
  name: string;
  type: "homepage" | "article";
  remaining: string;
  endsAt: string;
  bannerUrl: string;
}

export interface AERunningAdItem {
  id: string;
  name: string;
  clicks: number;
  remaining: string;
  bannerUrl: string;
  positionOrPlacement?: string;
}

export interface AEDashboardStats {
  totalClicks: number;
  adsAddedLast30Days: number;
  activeAdsCount: number;
  activeSponsorsCount: number;
}

export interface AEDashboardData {
  stats: AEDashboardStats;
  clicksTrend: AEClicksTrendDay[];
  articleClicksByCategory: AEArticleCategoryClicks[];
  platformClicks: AEPlatformClicks;
  expiringSoon: AEExpiringAdItem[];
  runningHomepage: AERunningAdItem[];
  runningArticle: AERunningAdItem[];
  /** Rentang agregasi tren & pie (hari). */
  trendDays: number;
}

export interface AEDashboardApiResponse {
  success: boolean;
  data: AEDashboardData;
}
