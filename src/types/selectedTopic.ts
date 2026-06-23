import { ObjectId } from "mongodb";

export interface SelectedTopic {
  _id: string | ObjectId;
  categoryId: string | ObjectId;
  createdAt: Date | string;
  updatedAt: Date | string;
  selectedBy: string | ObjectId;
}
