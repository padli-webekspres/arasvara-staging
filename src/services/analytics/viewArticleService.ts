import { connectToDatabase } from "@/lib/db/db";
import { ArticleView } from "@/types/analytics/viewArticle";
import { ObjectId } from "mongodb";

const COLLECTION_VIEW = "article_views";
const COLLECTION_ARTICLE = "articles";

// Tambah log view (insert ArticleView)
export async function addArticleView(view: ArticleView): Promise<ArticleView> {
  const db = await connectToDatabase();
  const { _id, ...rest } = view;
  // Ensure viewedAt is always a Date object
  const doc = {
    ...rest,
    viewedAt:
      view.viewedAt instanceof Date
        ? view.viewedAt
        : view.viewedAt
          ? new Date(view.viewedAt)
          : new Date(),
  };
  const result = await db.collection(COLLECTION_VIEW).insertOne(doc);
  return { ...doc, _id: result.insertedId.toString() };
}

// Increment viewCount di articles
export async function incrementArticleViewCount(
  articleId: string,
): Promise<void> {
  const db = await connectToDatabase();
  await db
    .collection(COLLECTION_ARTICLE)
    .updateOne({ _id: new ObjectId(articleId) }, { $inc: { viewCount: 1 } });
}
