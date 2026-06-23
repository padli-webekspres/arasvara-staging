"use client";

import { useSortable } from "@dnd-kit/react/sortable";
import { GripVertical, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { NavbarCategorySortItem } from "./navbarOrderPayload";

interface SortableNavbarCategoryCardProps {
  category: NavbarCategorySortItem;
  index: number;
  onRemove: (id: string) => void;
}

export function SortableNavbarCategoryCard({
  category,
  index,
  onRemove,
}: SortableNavbarCategoryCardProps) {
  const { ref, handleRef, isDragging } = useSortable({
    id: category._id,
    index,
  });

  return (
    <div
      ref={ref}
      className={`relative group rounded-lg border border-border bg-card p-3 pr-10 transition-all ${
        isDragging ? "z-50 scale-[1.02] shadow-lg opacity-90" : ""
      }`}
    >
      <div
        ref={handleRef}
        className="absolute top-2 left-2 z-10 rounded-md bg-background/90 p-1.5 shadow-sm backdrop-blur cursor-grab active:cursor-grabbing opacity-0 transition-opacity group-hover:opacity-100"
        aria-label="Seret untuk mengubah urutan"
        title="Seret untuk mengubah urutan"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>

      <Button
        type="button"
        variant="destructive"
        size="icon"
        className="absolute top-2 right-2 z-10 h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
        aria-label={`Hapus ${category.name} dari daftar navbar`}
        onClick={() => onRemove(category._id)}
      >
        <X className="h-4 w-4" />
      </Button>

      <div className="pl-8 min-w-0">
        <p className="font-medium leading-tight truncate">{category.name}</p>
        <p className="mt-0.5 font-mono text-xs text-muted-foreground truncate">
          {category.slug}
        </p>
        {category.nickname?.trim() ? (
          <p className="mt-1 text-xs text-muted-foreground truncate">
            Nama panggilan: {category.nickname.trim()}
          </p>
        ) : null}
      </div>
    </div>
  );
}
