/** Shared Tailwind classes for admin drag-and-drop handles (Safari/iOS-safe). */

export const sortableDragHandleClass =
  "absolute top-2 left-2 z-10 p-1.5 bg-background/80 backdrop-blur rounded-md cursor-grab active:cursor-grabbing opacity-25 group-hover:opacity-75 hover:opacity-100 transition-opacity shadow-sm touch-none";

export const sortableRemoveButtonClass =
  "absolute top-2 right-2 z-10 h-7 w-7 opacity-25 group-hover:opacity-75 hover:opacity-100 transition-opacity shadow-sm";

export const sortableInlineRemoveClass =
  "opacity-25 group-hover:opacity-75 hover:opacity-100 transition-opacity";

/** Compact handle used on cards with badges (ads, sponsor). */
export const sortableCompactDragHandleClass =
  "absolute left-2 top-2 z-10 cursor-grab rounded-md bg-background/80 p-1 opacity-25 shadow-sm backdrop-blur transition-opacity hover:opacity-100 group-hover:opacity-75 active:cursor-grabbing touch-none";

/** Video form card: larger touch target with GallerySorting opacity pattern. */
export const sortableVideoDragHandleClass =
  "absolute z-5 top-2 left-2 flex min-h-9 min-w-9 touch-none items-center justify-center rounded-md bg-background/80 p-1.5 opacity-25 shadow-sm backdrop-blur transition-opacity cursor-grab active:cursor-grabbing hover:opacity-100 group-hover:opacity-75";
