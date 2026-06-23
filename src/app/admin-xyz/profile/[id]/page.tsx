import { notFound } from "next/navigation";
import ProfileUi from "@/components/profile/ProfileUi";
import { connectToDatabase } from "@/lib/db/db";
import { getAllArticles } from "@/services/article/coreGetArticleService";
import { getUserByIdOrEmail } from "@/services/userService";

const LIMIT = 12;

interface ProfilePageProps {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ page?: string }>;
}

export default async function AdminProfilePage({
    params,
    searchParams,
}: ProfilePageProps) {
    const { id } = await params;
    const { page: rawPage } = await searchParams;
    const page = Number.isFinite(Number(rawPage))
        ? Math.max(1, Number(rawPage))
        : 1;

    const db = await connectToDatabase();
    const user = await getUserByIdOrEmail(db, id);

    if (!user) {
        notFound();
    }

    const { articles, total } = await getAllArticles(db, {
        authorId: user._id,
        status: "PUBLISHED",
        limit: LIMIT,
        page,
    });

    // Convert all data to plain objects to avoid Next.js serialization error
    const plainUser = JSON.parse(JSON.stringify(user));
    const plainArticles = JSON.parse(JSON.stringify(articles));
    return (
        <main className="min-w-0 max-w-full">
            <ProfileUi
                user={plainUser}
                articles={plainArticles}
                totalArticles={total ?? articles.length}
            />
        </main>
    );
}
