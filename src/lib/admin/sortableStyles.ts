/** Shared Tailwind classes for admin drag-and-drop handles (Safari/iOS-safe). */

/**
 * Opacity: layar kecil selalu 80 agar handle/hapus discoverable tanpa hover.
 * Dari breakpoint `sm` ke atas: pattern hover desktop (25 → 75/100).
 */
const SORTABLE_OPACITY =
  "opacity-80 sm:opacity-25 sm:group-hover:opacity-75 sm:hover:opacity-100";

export const sortableDragHandleClass =
  `absolute top-2 left-2 z-10 p-1.5 bg-background/80 backdrop-blur rounded-md cursor-grab active:cursor-grabbing ${SORTABLE_OPACITY} transition-opacity shadow-sm touch-none`;

export const sortableRemoveButtonClass =
  `absolute top-2 right-2 z-10 h-7 w-7 ${SORTABLE_OPACITY} transition-opacity shadow-sm`;

export const sortableInlineRemoveClass =
  `${SORTABLE_OPACITY} transition-opacity`;

/** Compact handle used on cards with badges (ads, sponsor). */
export const sortableCompactDragHandleClass =
  `absolute left-2 top-2 z-10 cursor-grab rounded-md bg-background/80 p-1 shadow-sm backdrop-blur ${SORTABLE_OPACITY} transition-opacity active:cursor-grabbing touch-none`;

/** Video form card: larger touch target with GallerySorting opacity pattern. */
export const sortableVideoDragHandleClass =
  `absolute z-5 top-2 left-2 flex min-h-9 min-w-9 touch-none items-center justify-center rounded-md bg-background/80 p-1.5 shadow-sm backdrop-blur ${SORTABLE_OPACITY} transition-opacity cursor-grab active:cursor-grabbing`;
