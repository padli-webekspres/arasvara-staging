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

/** Hanya role `writer` (bukan reporter/contributor). */
export function isWriterRole(role: string | undefined): boolean {
  return (role ?? "").toLowerCase() === ROLES.WRITER.toLowerCase();
}

/** Hanya role `editor` (bukan EIC/admin). */
export function isEditorRole(role: string | undefined): boolean {
  return (role ?? "").toLowerCase() === ROLES.EDITOR.toLowerCase();
}

export type WriterArticleActions = {
  showSaveDraft: boolean;
  showSecondarySave: boolean;
  /** Label tombol sekunder: Submit | Save | Save changes */
  secondaryLabel: "Submit" | "Save" | "Save changes";
  /** Status yang dikirim saat tombol sekunder diklik */
  secondaryStatus: ArticleStatus;
  showTakeDown: boolean;
  isViewOnly: boolean;
};

/**
 * Matriks tombol/aksi form artikel khusus role writer.
 * Create / DRAFT / REJECTED: Save Draft + Submit.
 * PENDING_REVIEW: Save Draft + Save (tetap pending).
 * PUBLISHED / SCHEDULED: Save changes → pending + Take down (milik sendiri).
 * TAKEN_DOWN: view-only.
 */
export function getWriterArticleActions(
  status: ArticleStatus | undefined,
  options: { isEditing: boolean; isOwnArticle: boolean },
): WriterArticleActions {
  const { isEditing, isOwnArticle } = options;

  if (!isEditing) {
    return {
      showSaveDraft: true,
      showSecondarySave: true,
      secondaryLabel: "Submit",
      secondaryStatus: ArticleStatus.PENDING_REVIEW,
      showTakeDown: false,
      isViewOnly: false,
    };
  }

  const current = status ?? ArticleStatus.DRAFT;

  if (current === ArticleStatus.TAKEN_DOWN) {
    return {
      showSaveDraft: false,
      showSecondarySave: false,
      secondaryLabel: "Save",
      secondaryStatus: ArticleStatus.TAKEN_DOWN,
      showTakeDown: false,
      isViewOnly: true,
    };
  }

  if (
    current === ArticleStatus.PUBLISHED ||
    current === ArticleStatus.SCHEDULED
  ) {
    return {
      showSaveDraft: false,
      showSecondarySave: true,
      secondaryLabel: "Save changes",
      secondaryStatus: ArticleStatus.PENDING_REVIEW,
      showTakeDown: isOwnArticle,
      isViewOnly: false,
    };
  }

  if (current === ArticleStatus.PENDING_REVIEW) {
    return {
      showSaveDraft: true,
      showSecondarySave: true,
      secondaryLabel: "Save",
      secondaryStatus: ArticleStatus.PENDING_REVIEW,
      showTakeDown: false,
      isViewOnly: false,
    };
  }

  // DRAFT, REJECTED, dan status lain yang diperlakukan seperti Waiting
  return {
    showSaveDraft: true,
    showSecondarySave: true,
    secondaryLabel: "Submit",
    secondaryStatus: ArticleStatus.PENDING_REVIEW,
    showTakeDown: false,
    isViewOnly: false,
  };
}

/** Writer boleh take down artikel milik sendiri yang Published/Scheduled. */
export function canWriterTakeDownArticle(
  role: string | undefined,
  status: ArticleStatus | string | undefined,
  isOwnArticle: boolean,
): boolean {
  if (!isWriterRole(role) || !isOwnArticle) return false;
  const normalized = (status ?? "").toString().toUpperCase();
  return (
    normalized === ArticleStatus.PUBLISHED ||
    normalized === ArticleStatus.SCHEDULED
  );
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

/** Admin / EIC: edit tanpa PENDING_REVIEW (kecuali status saat ini sudah pending). */
const EDIT_EDITOR_FLOW: ArticleStatus[] = [
  ArticleStatus.DRAFT,
  ArticleStatus.PUBLISHED,
  ArticleStatus.SCHEDULED,
  ArticleStatus.REJECTED,
  ArticleStatus.TAKEN_DOWN,
];

/** Role editor: dropdown edit menyertakan PENDING_REVIEW. */
const EDIT_EDITOR_ROLE_FLOW: ArticleStatus[] = [
  ArticleStatus.DRAFT,
  ArticleStatus.PENDING_REVIEW,
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
 * Dropdown status untuk mode **edit**.
 * Role `editor`: termasuk PENDING_REVIEW.
 * Admin / EIC: tanpa PENDING_REVIEW (kecuali status saat ini sudah pending).
 */
export function articleEditorEditStatusChoices(
  current?: ArticleStatus,
  role?: string,
): ArticleEditorStatusChoice[] {
  const baseFlow = isEditorRole(role)
    ? EDIT_EDITOR_ROLE_FLOW
    : EDIT_EDITOR_FLOW;
  const statuses = [...baseFlow];
  if (current && !statuses.includes(current)) {
    statuses.unshift(current);
  }
  return statuses.map((status) => ({
    status,
    label: articleStatusDropdownLabel(status),
  }));
}
