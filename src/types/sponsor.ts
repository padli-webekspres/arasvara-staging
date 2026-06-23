export interface SponsorItem {
  _id?: string;
  name: string;
  image_url: string;
  order?: number;
  createdAt?: string | Date;
  createdBy?: string;
}
