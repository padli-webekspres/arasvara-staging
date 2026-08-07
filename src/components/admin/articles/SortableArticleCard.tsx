import React from "react";
import { useSortable } from "@dnd-kit/react/sortable"; // Import dari path baru
import { GripVertical, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import SecondaryNewsCard from "@/components/news/SecondaryNewsCard";
import {
  sortableDragHandleClass,
  sortableRemoveButtonClass,
} from "@/lib/admin/sortableStyles";
import { SectionArticleItem } from "@/types/articleSection";

interface SortableArticleCardProps {
  editorChoice: SectionArticleItem;
  index: number; // Wajib ada di dnd-kit versi baru
  onRemove: (id: string) => void;
}

export const SortableArticleCard = ({
  editorChoice,
  index,
  onRemove,
}: SortableArticleCardProps) => {
  // Hook baru: cukup masukkan id dan index
  const { ref, handleRef, isDragging } = useSortable({
    id: editorChoice._id,
    index,
  });

  return (
    <div
      ref={ref}
      className={`relative group bg-card rounded-lg border border-border transition-all ${
        isDragging ? "opacity-50 z-50 scale-105 shadow-xl" : "opacity-100"
      }`}
    >
      {/* Area Drag Handle */}
      <div
        ref={handleRef}
        className={sortableDragHandleClass}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>

      {/* Tombol Remove */}
      <Button
        variant="destructive"
        size="icon"
        className={sortableRemoveButtonClass}
        onClick={() => onRemove(editorChoice._id)}
      >
        <X className="h-4 w-4" />
      </Button>

      {/* Card Artikel Asli */}
      <div className="pointer-events-none">
        {editorChoice.article && (
          <SecondaryNewsCard hasPadding={true} article={editorChoice.article} />
        )}
      </div>
    </div>
  );
};
