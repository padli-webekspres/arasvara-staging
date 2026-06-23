import { Metadata } from "next";
import { notFound } from "next/navigation";
import { connectToDatabase } from "@/lib/db/db";
import { buildAuthorPublicPath } from "@/lib/author-public-path";
import { getPublicAuthorBySlug } from "@/services/userService";
import AuthorClient from "./AuthorClient";

export const dynamic = "force-dynamic";

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

  const authorSlug = user.slug || decodedSlug;
  const title = user.name;
  const description = `Baca semua artikel oleh ${user.name} di Arasvara. Jurnalisme berkualitas untuk generasi digital.`;

  return {
    title,
    description,
    openGraph: {
      title: `${title} | Arasvara`,
      description,
      type: "profile",
      url: buildAuthorPublicPath(authorSlug),
    },
  };
}

export default async function AuthorPage(props: PageProps) {
  const { slug } = await props.params;
  const decodedSlug = decodeURIComponent(slug).trim().toLowerCase();
  const user = await getAuthor(decodedSlug);

  if (!user) {
    notFound();
  }

  const authorSlug = user.slug || decodedSlug;

  return (
    <AuthorClient
      authorId={user._id}
      authorSlug={authorSlug}
      authorAvatar={user.avatar}
      authorName={user.name}
    />
  );
}
