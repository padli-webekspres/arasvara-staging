import { ObjectId } from "mongodb";
import { ArticleListResponse } from "./article";
import { Media } from "./media";

export interface SectionArticleItem {
  _id: string;
  article_id: string | ObjectId;
  article?: ArticleListResponse; // always a single object, not array
  order: number;
  type?: "featured" | "editor choices" | "popular" | "headline";
  createdAt: Date;
  createdBy: string | ObjectId;
}

export interface SectionVideoItem {
  _id?: string;
  video_url: string;
  title: string;
  thumbnail_url: string;
  thumbnail?: Media;
  order: number;
  type: "tiktok" | "instagram" | "youtube";
  createdAt: Date;
  createdBy: string | ObjectId;
}
