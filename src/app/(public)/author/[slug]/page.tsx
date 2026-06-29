import { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";
import { connectToDatabase } from "@/lib/db/db";
import { getPublicAuthorBySlug } from "@/services/userService";
import { AUTHOR_PAGE_INITIAL_LIMIT } from "@/lib/author-public-path";
import {
  buildAuthorCanonicalUrl,
  buildAuthorJsonLd,
  buildMetadataFromAuthor,
  fetchAuthorArticlesPage,
} from "@/lib/server/author-page";
import AuthorClient from "./AuthorClient";

export const revalidate = 300;

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function getAuthor(slug: string) {
  const db = await connectToDatabase();
  return getPublicAuthorBySlug(db, slug);
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { slug } = await props.params;
  const decodedSlug = decodeURIComponent(slug).trim().toLowerCase();
  const user = await getAuthor(decodedSlug);

  if (!user) {
    return { title: "Penulis tidak ditemukan" };
  }

  const db = await connectToDatabase();
  const articlesResult = await fetchAuthorArticlesPage(
    db,
    user._id,
    1,
    AUTHOR_PAGE_INITIAL_LIMIT,
  );
  const authorSlug = user.slug || decodedSlug;

  return buildMetadataFromAuthor(user, articlesResult.meta, authorSlug);
}

export default async function AuthorPage(props: PageProps) {
  const { slug } = await props.params;
  const decodedSlug = decodeURIComponent(slug).trim().toLowerCase();
  const db = await connectToDatabase();

  const user = await getAuthor(decodedSlug);
  if (!user) {
    notFound();
  }

  const authorSlug = user.slug || decodedSlug;
  const articlesResult = await fetchAuthorArticlesPage(
    db,
    user._id,
    1,
    AUTHOR_PAGE_INITIAL_LIMIT,
  );
  const canonicalUrl = buildAuthorCanonicalUrl(authorSlug);
  const jsonLd = buildAuthorJsonLd(
    user,
    articlesResult.data,
    canonicalUrl,
  );

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 1000 * 60 * 5,
      },
    },
  });

  await queryClient.prefetchInfiniteQuery({
    queryKey: ["author-articles", authorSlug],
    queryFn: () => Promise.resolve(articlesResult),
    initialPageParam: 0,
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd),
        }}
      />
      <HydrationBoundary state={dehydrate(queryClient)}>
        <AuthorClient
          authorId={user._id}
          authorSlug={authorSlug}
          authorAvatar={user.avatar}
          authorName={user.name}
          initialArticleCount={articlesResult.meta.total}
        />
      </HydrationBoundary>
    </>
  );
}
