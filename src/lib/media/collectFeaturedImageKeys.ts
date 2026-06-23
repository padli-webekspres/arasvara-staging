import type { Db } from "mongodb";
import { ObjectId } from "mongodb";
import { extractMediaKeyFromInput } from "@/lib/media/public-media-url";
import { ARTICLE_OBJECT_STORAGE_FOLDER } from "@/lib/media/articleUploadScopes";

type FeaturedImageEmbed = {
  filename?: string;
  url?: string;
  mediaId?: string | ObjectId;
  _id?: string | ObjectId;
};

function resolveKeyFromEmbed(
  fi: FeaturedImageEmbed,
  mediaFilenameById: Map<string, string>,
): string {
  if (typeof fi.filename === "string" && fi.filename.trim()) {
    return fi.filename.trim();
  }

  if (typeof fi.url === "string" && fi.url.trim()) {
    const fromUrl = extractMediaKeyFromInput(fi.url.trim());
    if (fromUrl) return fromUrl;
  }

  const mediaIdRaw = fi.mediaId ?? fi._id;
  if (mediaIdRaw != null) {
    const idStr =
      typeof mediaIdRaw === "object" &&
      typeof (mediaIdRaw as { toString?: () => string }).toString === "function"
        ? (mediaIdRaw as { toString: () => string }).toString()
        : String(mediaIdRaw);
    const fromMedia = mediaFilenameById.get(idStr);
    if (fromMedia) return fromMedia;
  }

  return "";
}

/**
 * Kumpulkan storage key featured image dari artikel PUBLISHED.
 * Read-only — tidak mengubah database.
 */
export async function collectPublishedFeaturedImageKeys(
  db: Db,
): Promise<string[]> {
  const articles = await db
    .collection("articles")
    .find({
      status: "PUBLISHED",
      featuredImage: { $exists: true, $ne: null },
    })
    .project({ featuredImage: 1 })
    .toArray();

  const mediaIds: ObjectId[] = [];
  for (const doc of articles) {
    const fi = doc.featuredImage as FeaturedImageEmbed | null;
    if (!fi || typeof fi !== "object") continue;

    const rawId = fi.mediaId ?? fi._id;
    if (rawId == null) continue;
    try {
      mediaIds.push(
        typeof rawId === "string" ? new ObjectId(rawId) : (rawId as ObjectId),
      );
    } catch {
      // mediaId tidak valid — abaikan
    }
  }

  const uniqueMediaIds = [
    ...new Map(mediaIds.map((id) => [id.toString(), id])).values(),
  ];

  const mediaFilenameById = new Map<string, string>();
  if (uniqueMediaIds.length > 0) {
    const mediaDocs = await db
      .collection("media")
      .find({ _id: { $in: uniqueMediaIds } })
      .project({ filename: 1 })
      .toArray();

    for (const m of mediaDocs) {
      const filename = String(m.filename ?? "").trim();
      if (filename) {
        mediaFilenameById.set(m._id.toString(), filename);
      }
    }
  }

  const keys = new Set<string>();
  for (const doc of articles) {
    const fi = doc.featuredImage as FeaturedImageEmbed | null;
    if (!fi || typeof fi !== "object") continue;
    const key = resolveKeyFromEmbed(fi, mediaFilenameById);
    if (key) keys.add(key);
  }

  return [...keys].sort();
}

/** Prefix R2 untuk list objek featured. */
export const FEATURED_R2_PREFIX = `${ARTICLE_OBJECT_STORAGE_FOLDER.FEATURED}/`;
