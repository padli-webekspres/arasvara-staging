/**
 * Preferensi aktual path: SELALU `process.env.NEXT_PUBLIC_ADMIN_PANEL_PATH` di `.env`
 */
export const ADMIN_APP_ROUTE_SEGMENT = "dashboard-cms"; // Ini hanya fallback jika .env kosong

function normalizeSegment(value: string): string {
  return value.replace(/^\/+/, "").replace(/\/+$/, "");
}

const segment =
  normalizeSegment(process.env.NEXT_PUBLIC_ADMIN_PANEL_PATH ?? "") ||
  ADMIN_APP_ROUTE_SEGMENT;

/** Path dasar `/…` untuk link & redirect. */
export const adminPanelBasePath = `/${segment}`;

/** Path lengkap admin; `subPath` tanpa leading slash (contoh `"articles/new"`). */
export function adminPanelHref(subPath = ""): string {
  const rest = normalizeSegment(subPath);
  return rest ? `${adminPanelBasePath}/${rest}` : adminPanelBasePath;
}
