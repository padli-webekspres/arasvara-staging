import { connectToDatabase } from "@/lib/db/db";
import { getCategories } from "@/services/categoryService";
import ArticleEditorForm from "@/components/admin/articles/ArticleEditorForm";

export default async function NewArticlePage() {
  const db = await connectToDatabase();

  const { categories } = await getCategories(db, { limit: 200 });

  const categoryOptions = categories.map((c) => ({
    _id: String(c._id),
    name: c.name,
  }));

  return (
    <ArticleEditorForm
      format="STANDARD"
      mode="create"
      categories={categoryOptions}
    />
  );
}
