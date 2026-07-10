/** Gap responsif konsisten untuk grid card di panel admin. */
const ADMIN_CARD_GRID_GAP = "gap-2 md:gap-2.5 lg:gap-3";

/** Video portrait (TikTok/Instagram/combined) — mulai 2 kolom. */
export function getAdminPortraitCardGridClass(): string {
  return `grid grid-cols-2 ${ADMIN_CARD_GRID_GAP} md:grid-cols-3 2xl:grid-cols-4`;
}

/** Artikel, sponsor, ads, SelectAndSort — mulai 1 kolom. */
export function getAdminStandardCardGridClass(): string {
  return `grid grid-cols-1 ${ADMIN_CARD_GRID_GAP} md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4`;
}

/** Video landscape (YouTube) — kartu lebar, maksimal 2 kolom. */
export function getAdminLandscapeVideoCardGridClass(): string {
  return `grid grid-cols-1 ${ADMIN_CARD_GRID_GAP} md:grid-cols-2`;
}
