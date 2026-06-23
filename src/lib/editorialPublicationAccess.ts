import { ROLES } from "@/lib/auth-client";
import { ArticleStatus } from "@/types/article";
import { ARTICLE_STATUS } from "@/lib/constants";

/** Pemimpin redaksi sampai Editor — kurasi slot & opsi workflow artikel utama. */
const EDITORIAL_SPOTLIGHT = new Set(
  [
    ROLES.ADMIN,
    ROLES.EDITOR_IN_CHIEF,
    ROLES.MANAGING_EDITOR,
    ROLES.HEAD_OF,
    ROLES.EDITOR,
  ].map((r) => r.toLowerCase()),
);

export function hasEditorialSpotlightAccess(role: string | undefined): boolean {
  return EDITORIAL_SPOTLIGHT.has((role ?? "").toLowerCase());
}

/**
 * Boleh memilih penulis, editor, dan kontributor secara manual di form artikel.
 * Editor, managing editor, editor-in-chief, admin (bukan head-of).
 */
const ARTICLE_ATTRIBUTION_PICK_ROLES = new Set(
  [
    ROLES.EDITOR,
    ROLES.MANAGING_EDITOR,
    ROLES.EDITOR_IN_CHIEF,
    ROLES.ADMIN,
  ].map((r) => r.toLowerCase()),
);

export function canPickArticleAttribution(
  role: string | undefined,
): boolean {
  return ARTICLE_ATTRIBUTION_PICK_ROLES.has((role ?? "").toLowerCase());
}

/** Editor, pemimpin redaksi & admin mempilih status di form artikel (create/edit). */
const FORM_STATUS_ROLES = new Set(
  [ROLES.ADMIN, ROLES.EDITOR_IN_CHIEF, ROLES.EDITOR].map((r) =>
    r.toLowerCase(),
  ),
);

/** Role dengan dropdown status pada form editorial (lainnya: tombol Draft / Ajukan seperti penulis). */
export function hasArticleFormStatusPickerAccess(
  role: string | undefined,
): boolean {
  return FORM_STATUS_ROLES.has((role ?? "").toLowerCase());
}

/** Penulis cs: tombol Draft → DRAFT, Publish → PENDING_REVIEW tanpa dropdown. */
export function usesWriterArticleFormSubmit(role: string | undefined): boolean {
  return !hasArticleFormStatusPickerAccess(role);
}

/** Label konsisten untuk dropdown (sinkron `/lib/constants` ARTICLE_STATUS). */
export function articleStatusDropdownLabel(status: ArticleStatus): string {
  const row = ARTICLE_STATUS.find((r) => r.status === status);
  return row?.label ?? status;
}

const CREATE_EDITOR_FLOW: ArticleStatus[] = [
  ArticleStatus.DRAFT,
  ArticleStatus.PENDING_REVIEW,
  ArticleStatus.PUBLISHED,
  ArticleStatus.SCHEDULED,
];

const EDIT_EDITOR_FLOW: ArticleStatus[] = [
  ArticleStatus.DRAFT,
  ArticleStatus.PUBLISHED,
  ArticleStatus.SCHEDULED,
  ArticleStatus.REJECTED,
  ArticleStatus.TAKEN_DOWN,
];

export type ArticleEditorStatusChoice = {
  status: ArticleStatus;
  label: string;
};

/** Dropdown status untuk mode **create** oleh editor+. */
export function articleEditorCreateStatusChoices(): ArticleEditorStatusChoice[] {
  return CREATE_EDITOR_FLOW.map((status) => ({
    status,
    label: articleStatusDropdownLabel(status),
  }));
}

/**
 * Dropdown status untuk mode **edit** oleh editor+: published / scheduled /
 * rejected, plus status saat ini jika lain (mis. artikel legacy masih DRAFT).
 */
export function articleEditorEditStatusChoices(
  current?: ArticleStatus,
): ArticleEditorStatusChoice[] {
  const statuses = [...EDIT_EDITOR_FLOW];
  if (
    current &&
    !EDIT_EDITOR_FLOW.includes(current) &&
    statuses.indexOf(current) === -1
  ) {
    statuses.unshift(current);
  }
  return statuses.map((status) => ({
    status,
    label: articleStatusDropdownLabel(status),
  }));
}
