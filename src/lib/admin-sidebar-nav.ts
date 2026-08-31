import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  PenTool,
  Images,
  Newspaper,
  ClipboardCheck,
  FolderOpen,
  Image,
  TrendingUp,
  Sparkles,
  Megaphone,
  LayoutGrid,
  Instagram,
  Youtube,
  Handshake,
  LineChart,
  BarChart3,
  UsersRound,
  Target,
  PieChart,
  MonitorSmartphone,
  FileImage,
  Users,
  UserCog,
  Info,
  Settings,
  History,
} from "lucide-react";
import { adminPanelHref, adminPanelBasePath } from "@/lib/admin-panel-path";
import {
  hasPermission,
  ROLES as AUTH_ROLES,
  type Permission,
} from "@/lib/auth-client";

// ─── Role sets (selaras constants.ts + legacy DB) ───────────────────────────

/** Semua peran yang mengelola konten editorial */
export const SIDEBAR_ROLE_EDITORIAL = [
  AUTH_ROLES.ADMIN,
  AUTH_ROLES.EDITOR_IN_CHIEF,
  AUTH_ROLES.EDITOR,
  AUTH_ROLES.WRITER,
  AUTH_ROLES.MANAGING_EDITOR,
  AUTH_ROLES.HEAD_OF,
  AUTH_ROLES.REPORTER,
  AUTH_ROLES.CONTRIBUTOR,
] as const;

/** Pemimpin redaksi & editor (kurasi section, sosial) */
export const SIDEBAR_ROLE_EDITORIAL_LEADS = [
  AUTH_ROLES.ADMIN,
  AUTH_ROLES.EDITOR_IN_CHIEF,
  AUTH_ROLES.EDITOR,
  AUTH_ROLES.MANAGING_EDITOR,
  AUTH_ROLES.HEAD_OF,
] as const;

/** Analitik org-wide: KPI, Audience, Target, Workflow */
export const SIDEBAR_ROLE_ANALYTICS = [
  AUTH_ROLES.ADMIN,
  AUTH_ROLES.EDITOR_IN_CHIEF,
  AUTH_ROLES.MANAGING_EDITOR,
] as const;

/** Self-scoped analytics: Editor may see Writing + own activity */
export const SIDEBAR_ROLE_SELF_ANALYTICS = [
  AUTH_ROLES.ADMIN,
  AUTH_ROLES.EDITOR_IN_CHIEF,
  AUTH_ROLES.MANAGING_EDITOR,
  AUTH_ROLES.EDITOR,
] as const;

/** Tim iklan (+ pemred/admin mengawasi) */
export const SIDEBAR_ROLE_ADS = [
  AUTH_ROLES.ADMIN,
  AUTH_ROLES.EDITOR_IN_CHIEF,
  AUTH_ROLES.ACCOUNT_EXECUTIVE,
  AUTH_ROLES.MANAGING_EDITOR,
] as const;

/** Manajemen tim & laporan tingkat atas */
export const SIDEBAR_ROLE_SYSTEM = [
  AUTH_ROLES.ADMIN,
  AUTH_ROLES.EDITOR_IN_CHIEF,
  AUTH_ROLES.MANAGING_EDITOR,
] as const;

/** Pengguna, konfigurasi sensitif */
export const SIDEBAR_ROLE_SUPER = [
  AUTH_ROLES.ADMIN,
  AUTH_ROLES.EDITOR_IN_CHIEF,
] as const;

// ─── Nav types ───────────────────────────────────────────────────────────────

export type NavGroup = { type: "group"; name: string; id: string };

export type NavLink = {
  type: "items";
  name: string;
  href: string;
  icon: LucideIcon;
  /** Minimal satu permission ini (prioritas utama) */
  permissions?: Permission[];
  /** Fallback: salah satu role (untuk item yang belum punya permission khusus) */
  roles?: readonly string[];
};

export type NavEntry = NavGroup | NavLink;

const ADMIN_BASE = adminPanelBasePath;

/** Izin minimal untuk masuk dashboard admin */
const DASHBOARD_PERMISSIONS: Permission[] = [
  "all",
  "create_article",
  "manage_ads",
  "view_analytics",
  "view_own_analytics",
  "manage_users",
  "manage_editorial",
];

export const ADMIN_NAV_TREE: NavEntry[] = [
  {
    type: "items",
    name: "Dashboard Utama",
    href: ADMIN_BASE,
    icon: LayoutDashboard,
    permissions: DASHBOARD_PERMISSIONS,
  },

  { type: "group", id: "create", name: "Tulis & Produksi" },
  {
    type: "items",
    name: "Tulis Naskah",
    href: adminPanelHref("articles/new"),
    icon: PenTool,
    permissions: ["create_article"],
  },
  {
    type: "items",
    name: "Artikel Galeri",
    href: adminPanelHref("articles/new/gallery"),
    icon: Images,
    permissions: ["create_article"],
  },

  { type: "group", id: "konten", name: "Manajemen Konten" },
  {
    type: "items",
    name: "Semua Artikel",
    href: adminPanelHref("articles"),
    icon: Newspaper,
    permissions: ["create_article", "edit_own_article", "edit_any_article"],
  },
  {
    type: "items",
    name: "Moderasi & Rilis",
    href: adminPanelHref("articles/approval"),
    icon: ClipboardCheck,
    permissions: ["approve_article"],
  },
  {
    type: "items",
    name: "Kategori & Kanal",
    href: adminPanelHref("categories"),
    icon: FolderOpen,
    permissions: ["manage_categories"],
  },
  {
    type: "items",
    name: "Pustaka Media",
    href: adminPanelHref("media"),
    icon: Image,
    permissions: ["upload_media"],
  },

  { type: "group", id: "section", name: "Tata Letak Beranda" },
  {
    type: "items",
    name: "Headline Utama",
    href: adminPanelHref("articles/headline"),
    icon: Megaphone,
    roles: SIDEBAR_ROLE_EDITORIAL_LEADS,
  },
  {
    type: "items",
    name: "Pilihan Editor",
    href: adminPanelHref("articles/editor-choice"),
    icon: Sparkles,
    roles: SIDEBAR_ROLE_EDITORIAL_LEADS,
  },
  {
    type: "items",
    name: "Artikel Populer",
    href: adminPanelHref("articles/popular"),
    icon: TrendingUp,
    roles: SIDEBAR_ROLE_EDITORIAL_LEADS,
  },
  {
    type: "items",
    name: "Grid Unggulan",
    href: adminPanelHref("articles/featured"),
    icon: LayoutGrid,
    roles: SIDEBAR_ROLE_EDITORIAL_LEADS,
  },
  {
    type: "items",
    name: "Kemitraan Sponsor",
    href: adminPanelHref("sponsor"),
    icon: Handshake,
    roles: [AUTH_ROLES.ADMIN, AUTH_ROLES.EDITOR_IN_CHIEF],
  },
  {
    type: "items",
    name: "Feed Socmed",
    href: adminPanelHref("articles/socmed"),
    icon: Instagram,
    roles: SIDEBAR_ROLE_EDITORIAL_LEADS,
  },
  {
    type: "items",
    name: "Feed YouTube",
    href: adminPanelHref("articles/youtube-section"),
    icon: Youtube,
    roles: SIDEBAR_ROLE_EDITORIAL_LEADS,
  },

  { type: "group", id: "analitik", name: "Laporan & Kinerja" },
  {
    type: "items",
    name: "Statistik Audiens",
    href: adminPanelHref("analytics/audience"),
    icon: BarChart3,
    permissions: ["view_analytics"],
    roles: SIDEBAR_ROLE_ANALYTICS,
  },
  {
    type: "items",
    name: "Alur Kerja (Workflow)",
    href: adminPanelHref("analytics/workflow"),
    icon: LineChart,
    permissions: ["view_analytics"],
    roles: SIDEBAR_ROLE_ANALYTICS,
  },
  {
    type: "items",
    name: "Kinerja Penulis",
    href: adminPanelHref("analytics/writing"),
    icon: PenTool,
    permissions: ["view_analytics"],
    roles: SIDEBAR_ROLE_SELF_ANALYTICS,
  },
  {
    type: "items",
    name: "Aktivitas Editor",
    href: adminPanelHref("analytics/editor-activity"),
    icon: UsersRound,
    permissions: ["view_analytics"],
    roles: SIDEBAR_ROLE_SELF_ANALYTICS,
  },
  {
    type: "items",
    name: "Target Bulanan",
    href: adminPanelHref("monthly-target"),
    icon: Target,
    roles: SIDEBAR_ROLE_ANALYTICS,
  },
  {
    type: "items",
    name: "KPI & Kontribusi",
    href: adminPanelHref("reports/kpi"),
    icon: PieChart,
    roles: SIDEBAR_ROLE_SELF_ANALYTICS,
  },

  { type: "group", id: "iklan", name: "Monetisasi & Iklan" },
  {
    type: "items",
    name: "Iklan Spanduk Beranda",
    href: adminPanelHref("ads/homepage"),
    icon: MonitorSmartphone,
    permissions: ["manage_ads"],
  },
  {
    type: "items",
    name: "Iklan Sisipan Artikel",
    href: adminPanelHref("ads/single-article"),
    icon: FileImage,
    permissions: ["manage_ads"],
  },
  {
    type: "items",
    name: "Riwayat & Laporan",
    href: adminPanelHref("ads/history"),
    icon: History,
    permissions: ["manage_ads", "view_ad_analytics"],
  },

  { type: "group", id: "sistem", name: "Administrasi Sistem" },
  {
    type: "items",
    name: "Akses & Pengguna",
    href: adminPanelHref("users"),
    icon: UserCog,
    permissions: ["manage_users"],
    roles: SIDEBAR_ROLE_SUPER,
  },
  {
    type: "items",
    name: "Tentang Kami",
    href: adminPanelHref("configuration/about-us"),
    icon: Info,
    roles: SIDEBAR_ROLE_SUPER,
  },
  {
    type: "items",
    name: "Konfigurasi Umum",
    href: adminPanelHref("configuration"),
    icon: Settings,
    roles: SIDEBAR_ROLE_SUPER,
  },
];

/**
 * Item tampil jika user punya salah satu permission ATAU salah satu role terdaftar.
 */
export function canAccessNavItem(
  userRole: string | null | undefined,
  item: NavLink,
): boolean {
  if (!userRole) return false;
  const role = userRole.toLowerCase();

  if (item.permissions?.length) {
    if (item.permissions.some((p) => hasPermission(role, p))) return true;
  }

  if (item.roles?.length) {
    if (item.roles.some((r) => r.toLowerCase() === role)) return true;
  }

  return false;
}

/** Hilangkan grup kosong setelah filter peran */
export function pruneEmptyNavGroups(items: NavEntry[]): NavEntry[] {
  const out: NavEntry[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.type !== "group") {
      out.push(item);
      continue;
    }
    let hasEntry = false;
    for (let j = i + 1; j < items.length; j++) {
      if (items[j].type === "group") break;
      if (items[j].type === "items") {
        hasEntry = true;
        break;
      }
    }
    if (hasEntry) out.push(item);
  }
  return out;
}

export function filterNavForRole(
  userRole: string | null | undefined,
): NavEntry[] {
  const roleFiltered = ADMIN_NAV_TREE.filter((item) => {
    if (item.type === "group") return true;
    return canAccessNavItem(userRole, item);
  });
  return pruneEmptyNavGroups(roleFiltered);
}

export function normalizeAdminPath(path: string): string {
  if (!path) return "/";
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function isAdminNavActive(pathname: string, href: string): boolean {
  if (!href) return false;
  const path = normalizeAdminPath(pathname);
  const target = normalizeAdminPath(href);
  if (path === target) return true;

  // Moderasi & Rilis: list + /articles/:idOrSlug/approval
  const approvalList = normalizeAdminPath(adminPanelHref("articles/approval"));
  if (target !== approvalList) return false;
  const articlesBase = normalizeAdminPath(adminPanelHref("articles"));
  return new RegExp(`^${escapeRegExp(articlesBase)}/[^/]+/approval$`).test(
    path,
  );
}
