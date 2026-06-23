export const ROLES = {
  // Level 1: Super Admin
  ADMIN: "admin",

  // Level Editorial
  EDITOR_IN_CHIEF: "editor-in-chief",
  EDITOR: "editor",
  WRITER: "writer",

  // Level Bisnis
  ACCOUNT_EXECUTIVE: "account-executive",

  // Legacy/External Roles (Didefinisikan agar tidak merusak kompilasi modul lain)
  MANAGING_EDITOR: "managing-editor",
  HEAD_OF: "head-of",
  REPORTER: "reporter",
  CONTRIBUTOR: "contributor",
  SUBSCRIBER: "subscriber",
};

export const ALL_PERMISSIONS = [
  // Super Admin bypass
  "all",

  // --- Article CRUD ---
  "create_article",
  "edit_own_article",
  "edit_any_article",
  "delete_own_article",
  "delete_any_article",

  // --- Article Workflow ---
  "submit_article", // Submit draft ke review (DRAFT → PENDING_REVIEW)
  "approve_article", // Proses artikel dari antrian review (mis. → PUBLISHED)
  "reject_article", // Reject artikel (PENDING_REVIEW → REJECTED)
  "publish_article", // Publish artikel
  "schedule_article", // Jadwalkan publikasi
  "takedown_article", // Takedown artikel yang sudah publish (PUBLISHED → TAKEN_DOWN)
  "restore_article", // Restore artikel yang di-takedown / rejected

  // --- Taxonomy ---
  "manage_categories",
  "manage_tags",

  // --- Media ---
  "upload_media",
  "delete_own_media",
  "delete_any_media",

  // --- Users & Roles ---
  "view_users",
  "manage_users",
  "manage_roles",

  // --- Editorial Management ---
  "manage_editorial", // Kelola tim redaksi & workflow

  // --- Analytics & KPI ---
  "view_analytics", // Akses penuh ke semua analytics
  "view_team_analytics", // Analytics level tim/rubrik
  "view_own_analytics", // Analytics artikel milik sendiri

  // --- Ads ---
  "manage_ads",
  "view_ad_analytics",

  // --- System ---
  "view_audit_logs",
  "send_push_notifications",
  "manage_settings",

  // --- General ---
  "view_content",
  "comment",
] as const;

// Utility type agar kita mendapat auto-complete di TypeScript
export type Permission = (typeof ALL_PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  // SUPER ADMIN — bypass semua permission lewat "all"
  [ROLES.ADMIN]: ["all"],

  // PEMIMPIN REDAKSI — kendali penuh atas editorial & publikasi
  [ROLES.EDITOR_IN_CHIEF]: [
    "create_article",
    "edit_any_article",
    "delete_any_article",
    "submit_article",
    "approve_article",
    "reject_article",
    "publish_article",
    "schedule_article",
    "takedown_article",
    "restore_article",
    "manage_categories",
    "manage_tags",
    "upload_media",
    "delete_any_media",
    "view_users",
    "manage_users",
    "manage_editorial",
    "view_analytics",
    "view_team_analytics",
    "send_push_notifications",
    "view_audit_logs",
  ],

  // EDITOR — edit & review artikel, submit ke head
  [ROLES.EDITOR]: [
    "create_article",
    "edit_any_article",
    "delete_own_article",
    "submit_article",
    "approve_article",
    "reject_article",
    "upload_media",
    "delete_own_media",
    "view_own_analytics",
  ],

  // CONTENT WRITER — buat & submit artikel
  [ROLES.WRITER]: [
    "create_article",
    "edit_own_article",
    "delete_own_article",
    "submit_article",
    "upload_media",
    "delete_own_media",
    "view_own_analytics",
  ],

  // ACCOUNT EXECUTIVE — khusus iklan, tidak ada akses editorial
  [ROLES.ACCOUNT_EXECUTIVE]: [
    "manage_ads",
    "view_ad_analytics",
    "view_content",
  ],

  // --- Legacy/External Roles Permissions ---
  [ROLES.MANAGING_EDITOR]: [
    "create_article",
    "edit_any_article",
    "delete_any_article",
    "submit_article",
    "approve_article",
    "reject_article",
    "publish_article",
    "schedule_article",
    "takedown_article",
    "restore_article",
    "manage_categories",
    "manage_tags",
    "upload_media",
    "delete_any_media",
    "view_users",
    "view_analytics",
    "view_team_analytics",
    "send_push_notifications",
  ],

  [ROLES.HEAD_OF]: [
    "create_article",
    "edit_any_article",
    "delete_own_article",
    "submit_article",
    "approve_article",
    "reject_article",
    "schedule_article",
    "restore_article",
    "manage_tags",
    "upload_media",
    "delete_own_media",
    "view_team_analytics",
    "view_own_analytics",
  ],

  [ROLES.REPORTER]: [
    "create_article",
    "edit_own_article",
    "delete_own_article",
    "submit_article",
    "upload_media",
    "delete_own_media",
    "view_own_analytics",
  ],

  [ROLES.CONTRIBUTOR]: [
    "create_article",
    "edit_own_article",
    "submit_article",
    "upload_media",
  ],

  [ROLES.SUBSCRIBER]: ["view_content", "comment"],
};

export function hasPermission(userRole: string, permission: Permission) {
  const permissions = ROLE_PERMISSIONS[userRole] || [];
  return permissions.includes("all") || permissions.includes(permission);
}

export function isApproverRole(role: string | null | undefined): boolean {
  if (!role) return false;
  const lower = role.toLowerCase();
  return [
    "editor",
    "head-of",
    "managing-editor",
    "editor-in-chief",
    "admin",
  ].includes(lower);
}
