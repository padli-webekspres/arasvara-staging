import { ObjectId } from "mongodb";
import { getCollection } from "@/lib/db/db";
import { SelectedTopic } from "@/types/selectedTopic";

const COLLECTION = "selected_topics";
const CATEGORY_COLLECTION = "categories";

function toObjectId(id: string | ObjectId) {
  return typeof id === "string" ? new ObjectId(id) : id;
}

export async function getAllSelectedTopics(selectedBy?: string | ObjectId) {
  const col = await getCollection(COLLECTION);
  const matchStage = selectedBy
    ? { $match: { selectedBy: toObjectId(selectedBy) } }
    : null;
  const pipeline = [
    ...(matchStage ? [matchStage] : []),
    {
      $lookup: {
        from: CATEGORY_COLLECTION,
        localField: "categoryId",
        foreignField: "_id",
        as: "category",
      },
    },
    { $unwind: "$category" },
    { $sort: { createdAt: -1 } },
  ];
  return col.aggregate(pipeline).toArray();
}

export async function getSelectedTopicById(id: string | ObjectId) {
  const col = await getCollection(COLLECTION);
  const pipeline = [
    { $match: { _id: toObjectId(id) } },
    {
      $lookup: {
        from: CATEGORY_COLLECTION,
        localField: "categoryId",
        foreignField: "_id",
        as: "category",
      },
    },
    { $unwind: "$category" },
  ];
  return col.aggregate(pipeline).next();
}

export async function createSelectedTopic(
  data: Omit<SelectedTopic, "_id" | "createdAt" | "updatedAt">,
) {
  const col = await getCollection(COLLECTION);
  const now = new Date();
  const doc = {
    ...data,
    categoryId: toObjectId(data.categoryId),
    selectedBy: toObjectId(data.selectedBy),
    createdAt: now,
    updatedAt: now,
  };
  const result = await col.insertOne(doc);
  return getSelectedTopicById(result.insertedId);
}

export async function deleteSelectedTopic(id: string | ObjectId) {
  const col = await getCollection(COLLECTION);
  const topic = await getSelectedTopicById(id);
  if (!topic) return null;
  await col.deleteOne({ _id: toObjectId(id) });
  return topic;
}
