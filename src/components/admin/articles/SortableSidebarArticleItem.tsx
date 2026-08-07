"use client";

import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X } from "lucide-react";
import { sortableInlineRemoveClass } from "@/lib/admin/sortableStyles";
import { SectionArticleItem } from "@/types/articleSection";

interface SortableSidebarArticleItemProps {
  id: string; // the array index or unique id for dnd
  item: SectionArticleItem;
  onRemove: (id: string) => void;
}

export function SortableSidebarArticleItem({
  id,
  item,
  onRemove,
}: SortableSidebarArticleItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 1,
    opacity: isDragging ? 0.8 : 1,
  };

  // Safe fallback if article details are somehow missing
  const articleTitle = item.article?.title ?? "Judul tidak tersedia";
  const status = item.article?.status ?? "UNKNOWN";
  
  // Extract thumbnail image if available
  let thumbUrl = "";
  if (item.article?.featuredImage) {
    if (typeof item.article.featuredImage === "string") {
       thumbUrl = item.article.featuredImage;
    } else if (typeof item.article.featuredImage === "object") {
       thumbUrl = (item.article.featuredImage as any).url || "";
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center justify-between p-2 mb-2 bg-background border rounded-md group ${
        isDragging ? "shadow-lg border-primary/50" : "shadow-sm border-border"
      }`}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <button
          type="button"
          className="touch-none p-1 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>

        {/* Thumbnail Mini */}
        {thumbUrl ? (
          <div className="h-8 w-12 flex-shrink-0 bg-muted rounded overflow-hidden">
            <img src={thumbUrl} alt="" className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="h-8 w-12 flex-shrink-0 bg-muted rounded flex items-center justify-center">
            <span className="text-[10px] text-muted-foreground font-medium">No Img</span>
          </div>
        )}

        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate" title={articleTitle}>
            {articleTitle}
          </p>
          <p className="text-[10px] text-muted-foreground truncate">
            {status}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onRemove(id)}
        className={`p-1.5 ml-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md ${sortableInlineRemoveClass}`}
        title="Hapus dari daftar"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
