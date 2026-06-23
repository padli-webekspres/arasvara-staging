import { ObjectId } from "mongodb";

export interface SocialLink {
  _id: string | ObjectId;
  name: string;
  slug: string;
  url: string;
  icon?: string;
}
