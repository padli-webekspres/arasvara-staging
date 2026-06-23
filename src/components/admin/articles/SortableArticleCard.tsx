import React from "react";
import { useSortable } from "@dnd-kit/react/sortable"; // Import dari path baru
import { GripVertical, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import SecondaryNewsCard from "@/components/news/SecondaryNewsCard";
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

  console.log(
    "Rendering SortableArticleCard for article:",
    editorChoice.article,
  );

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
        className="absolute top-2 left-2 z-10 p-1.5 bg-background/80 backdrop-blur rounded-md cursor-grab active:cursor-grabbing opacity-25 group-hover:opacity-75 !hover:opacity-100 transition-opacity shadow-sm"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>

      {/* Tombol Remove */}
      <Button
        variant="destructive"
        size="icon"
        className="absolute top-2 right-2 z-10 h-7 w-7 opacity-25 group-hover:opacity-75 !hover:opacity-100 transition-opacity shadow-sm"
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
