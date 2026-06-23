import { Metadata } from "next";
import { notFound } from "next/navigation";
import { connectToDatabase } from "@/lib/db/db";
import { getUserByIdOrEmail } from "@/services/userService";
import AuthorClient from "./AuthorClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getAuthor(id: string) {
  const db = await connectToDatabase();
  return getUserByIdOrEmail(db, id);
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { id } = await props.params;
  const user = await getAuthor(id);

  if (!user) {
    return { title: "Penulis tidak ditemukan" };
  }

  const title = user.name;
  const description = `Baca semua artikel oleh ${user.name} di Arasvara. Jurnalisme berkualitas untuk generasi digital.`;

  return {
    title,
    description,
    openGraph: {
      title: `${title} | Arasvara`,
      description,
      type: "profile",
    },
  };
}

export default async function AuthorPage(props: PageProps) {
  const { id } = await props.params;
  const user = await getAuthor(id);

  if (!user) {
    notFound();
  }

  return <AuthorClient authorId={id} authorName={user.name} />;
}
