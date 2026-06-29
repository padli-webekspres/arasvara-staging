import { resolvePublicMediaUrl } from "@/lib/media/public-media-url";
import type { User } from "@/types/user";

const AVATAR_VIEW_PROXY_PREFIX = "/api/media/avatar/view";
const MEDIA_VIEW_PROXY_PREFIX = "/api/media/view";

function resolveAvatarString(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (
    trimmed.startsWith(MEDIA_VIEW_PROXY_PREFIX) ||
    trimmed.startsWith(AVATAR_VIEW_PROXY_PREFIX)
  ) {
    return trimmed;
  }

  const resolved = resolvePublicMediaUrl(trimmed);
  return resolved || undefined;
}

/** Resolve URL gambar avatar user; undefined jika tidak ada sumber valid. */
export function resolveUserAvatarUrl(
  avatar: User["avatar"] | null | undefined,
): string | undefined {
  if (avatar == null) return undefined;
  if (typeof avatar === "string") return resolveAvatarString(avatar);

  const fromUrl = avatar.url ? resolveAvatarString(avatar.url) : undefined;
  if (fromUrl) return fromUrl;

  const filename = avatar.filename?.trim();
  if (!filename) return undefined;

  return resolveAvatarString(
    `${AVATAR_VIEW_PROXY_PREFIX}?key=${encodeURIComponent(filename)}`,
  );
}
