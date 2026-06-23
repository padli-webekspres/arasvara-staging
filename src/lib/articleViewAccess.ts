import { ROLES } from "@/lib/auth-client";
import { ArticleStatus } from "@/types/article";

/**
 * Status yang boleh di-preview staf CMS di `/news/[slug]` (perilaku sama untuk semuanya).
 * DRAFT (Waiting) dan PENDING_REVIEW mengikuti aturan akses role yang identik.
 */
export const CMS_PREVIEW_STATUSES = new Set<ArticleStatus>([
  ArticleStatus.DRAFT,
  ArticleStatus.PENDING_REVIEW,
  ArticleStatus.REJECTED,
  ArticleStatus.SCHEDULED,
]);

/** Staf CMS yang boleh melihat artikel preview (DRAFT, PENDING_REVIEW, dll.). */
const CMS_STAFF_PREVIEW_ROLES = new Set(
  [
    ROLES.ADMIN,
    ROLES.EDITOR_IN_CHIEF,
    ROLES.EDITOR,
    ROLES.WRITER,
    ROLES.ACCOUNT_EXECUTIVE,
    ROLES.REPORTER,
    ROLES.CONTRIBUTOR,
    ROLES.HEAD_OF,
    ROLES.MANAGING_EDITOR,
  ].map((role) => role.toLowerCase()),
);

/** Staf editorial senior — boleh melihat artikel TAKEN_DOWN. */
const CMS_STAFF_TAKEN_DOWN_ROLES = new Set(
  [ROLES.ADMIN, ROLES.EDITOR_IN_CHIEF, ROLES.EDITOR].map((role) =>
    role.toLowerCase(),
  ),
);

export function normalizeArticleStatus(
  status: ArticleStatus | string | undefined | null,
): string {
  return String(status ?? "")
    .trim()
    .toUpperCase();
}

export function isCmsPreviewStatus(status: ArticleStatus | string): boolean {
  return CMS_PREVIEW_STATUSES.has(
    normalizeArticleStatus(status) as ArticleStatus,
  );
}

/**
 * Apakah role CMS boleh melihat artikel non-published berdasarkan status?
 * - PUBLISHED: selalu boleh (pengunjung umum).
 * - TAKEN_DOWN: admin, editor-in-chief, editor saja.
 * - DRAFT / PENDING_REVIEW / REJECTED / SCHEDULED: staf CMS preview (perilaku sama).
 */
export function canViewArticleAsCmsStaff(
  role: string | undefined,
  status: ArticleStatus | string,
): boolean {
  const normalizedStatus = normalizeArticleStatus(status);

  if (normalizedStatus === ArticleStatus.PUBLISHED) {
    return true;
  }

  const normalizedRole = (role ?? "").toLowerCase();
  if (!normalizedRole) {
    return false;
  }

  if (normalizedStatus === ArticleStatus.TAKEN_DOWN) {
    return CMS_STAFF_TAKEN_DOWN_ROLES.has(normalizedRole);
  }

  if (isCmsPreviewStatus(normalizedStatus)) {
    return CMS_STAFF_PREVIEW_ROLES.has(normalizedRole);
  }

  return false;
}

type ArticleViewSubject = {
  status: ArticleStatus | string;
  authorId?: string | null;
};

type ArticleViewer = {
  _id?: string;
  role?: string;
};

/**
 * Otorisasi detail artikel untuk halaman `/news/[slug]` dan API GET.
 * DRAFT (Waiting) dan PENDING_REVIEW tidak dibatasi authorId — semua staf yang berhak
 * boleh membuka artikel rekan sesama tim (selaras antrian review).
 */
export function canViewArticleDetail(
  user: ArticleViewer | null | undefined,
  article: ArticleViewSubject,
): boolean {
  if (!user) {
    return false;
  }

  return canViewArticleAsCmsStaff(user.role, article.status);
}
