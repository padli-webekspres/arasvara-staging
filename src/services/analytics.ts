import { Db, ObjectId } from "mongodb";

export async function trackPageView(
  db: Db,
  {
    articleId,
    userAgent,
    referrer,
  }: { articleId: string; userAgent?: string | null; referrer?: string | null },
) {
  if (!articleId) throw new Error("Article ID is required");
  const pageView = {
    articleId,
    timestamp: new Date(),
    userAgent,
    referrer,
  };
  await db.collection("page_views").insertOne(pageView);
  await db
    .collection("articles")
    .updateOne({ _id: new ObjectId(articleId) }, { $inc: { viewCount: 1 } });
  return { success: true };
}
