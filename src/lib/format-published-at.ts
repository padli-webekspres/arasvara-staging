import { formatDateReadable } from "@/lib/utils";

const MS_PER_MINUTE = 60 * 1000;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;
/** Lebih dari ini → tampilkan tanggal publish penuh. */
const MS_PER_WEEK = 7 * MS_PER_DAY;

/**
 * Label tanggal publish untuk kartu/list artikel (client-safe, tanpa mongodb).
 * Relatif: menit/jam/hari lalu; jika > 1 minggu → tanggal lengkap (locale id-ID).
 */
export function formatPublishedAtForUi(
  publishedAt: string | Date | null | undefined,
  options?: { now?: Date; locale?: string },
): string {
  if (publishedAt == null || publishedAt === "") return "-";

  const date =
    publishedAt instanceof Date ? publishedAt : new Date(publishedAt);
  if (Number.isNaN(date.getTime())) return "-";

  const now = options?.now ?? new Date();
  const diffMs = now.getTime() - date.getTime();
  const locale = options?.locale ?? "id-ID";

  if (diffMs < 0) {
    return formatDateReadable(date, locale) || "-";
  }

  if (diffMs > MS_PER_WEEK) {
    return formatDateReadable(date, locale) || "-";
  }

  const days = Math.floor(diffMs / MS_PER_DAY);
  if (days >= 1) {
    return `${days} hari lalu`;
  }

  const hours = Math.floor(diffMs / MS_PER_HOUR);
  if (hours >= 1) {
    return `${hours} jam lalu`;
  }

  const minutes = Math.floor(diffMs / MS_PER_MINUTE);
  if (minutes >= 1) {
    return `${minutes} menit lalu`;
  }

  return "baru saja";
}
