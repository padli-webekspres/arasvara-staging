import { extractMediaKeyFromInput } from "@/lib/media/public-media-url";
import { ObjectId } from "mongodb";

export type FeaturedImageEmbed = {
  mediaId?: unknown;
  url?: unknown;
  filename?: unknown;
  caption?: unknown;
  credit?: unknown;
};

export type MigrationResolveResult =
  | { ok: true; filename: string; source: "media_lookup" | "url_parse" | "existing_filename" }
  | { ok: false; reason: string };

function toMediaObjectId(value: unknown): ObjectId | null {
  if (!value) return null;
  if (value instanceof ObjectId) return value;
  try {
    const str = String(value).trim();
    if (!/^[a-f\d]{24}$/i.test(str)) return null;
    return new ObjectId(str);
  } catch {
    return null;
  }
}

/**
 * Resolve storage filename untuk migrasi featuredImage.url → featuredImage.filename.
 */
export function resolveFilenameForMigration(
  featuredImage: FeaturedImageEmbed,
  mediaFilenameById?: Map<string, string>,
): MigrationResolveResult {
  if (
    typeof featuredImage.filename === "string" &&
    featuredImage.filename.trim()
  ) {
    return {
      ok: true,
      filename: featuredImage.filename.trim(),
      source: "existing_filename",
    };
  }

  const mediaId = toMediaObjectId(featuredImage.mediaId);
  if (mediaId && mediaFilenameById) {
    const fromMedia = mediaFilenameById.get(mediaId.toString());
    if (fromMedia?.trim()) {
      return {
        ok: true,
        filename: fromMedia.trim(),
        source: "media_lookup",
      };
    }
  }

  if (typeof featuredImage.url === "string" && featuredImage.url.trim()) {
    const fromUrl = extractMediaKeyFromInput(featuredImage.url.trim());
    if (fromUrl?.trim()) {
      return {
        ok: true,
        filename: fromUrl.trim(),
        source: "url_parse",
      };
    }
  }

  return {
    ok: false,
    reason: mediaId
      ? "mediaId tidak ditemukan di koleksi media dan url tidak bisa di-parse"
      : "tidak ada mediaId atau url yang valid",
  };
}

/** Artikel yang masih punya featuredImage.url proxy dan perlu migrasi. */
export function isFeaturedImageMigrationCandidate(
  featuredImage: unknown,
): featuredImage is FeaturedImageEmbed {
  if (!featuredImage || typeof featuredImage !== "object") return false;
  const fi = featuredImage as FeaturedImageEmbed;
  const hasUrl = typeof fi.url === "string" && fi.url.trim().length > 0;
  const hasFilename =
    typeof fi.filename === "string" && fi.filename.trim().length > 0;
  return hasUrl && !hasFilename;
}
