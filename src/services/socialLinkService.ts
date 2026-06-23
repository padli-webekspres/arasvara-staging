import { Db } from "mongodb";
import { SocialLink } from "@/types/socialLink";

/**
 * Get all social links
 */
export async function getAllSocialLinks(db: Db): Promise<SocialLink[]> {
  const docs = await db.collection("social_links").find({}).toArray();
  return docs.map((doc) => ({
    _id: doc._id,
    name: doc.name,
    slug: doc.slug,
    url: doc.url,
    icon: doc.icon,
  }));
}

/**
 * Get a social link by id or slug
 */
export async function getSocialLinkByIdOrSlug(
  db: Db,
  idOrSlug: string,
): Promise<SocialLink | null> {
  const { ObjectId } = await import("mongodb");
  let query: any = {};
  if (ObjectId.isValid(idOrSlug)) {
    query = { $or: [{ _id: new ObjectId(idOrSlug) }, { slug: idOrSlug }] };
  } else {
    query = { slug: idOrSlug };
  }
  const doc = await db.collection("social_links").findOne(query);
  if (!doc) return null;
  return {
    _id: doc._id,
    name: doc.name,
    slug: doc.slug,
    url: doc.url,
    icon: doc.icon,
  };
}
