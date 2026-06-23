import { ADS_HOMEPAGE_ADMIN_ROLES } from "@/types/ads";

/** Apakah role user boleh memanggil API ads homepage / ads media banner. */
export function canManageAdsHomepage(role: string | null | undefined): boolean {
  if (!role) return false;
  const lower = role.toLowerCase();
  return (ADS_HOMEPAGE_ADMIN_ROLES as readonly string[]).includes(lower);
}
