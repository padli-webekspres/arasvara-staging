"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Edit2, Trash2, GripVertical } from "lucide-react";
import Image from "next/image";
import { useSortable } from "@dnd-kit/react/sortable";
import { SponsorItem } from "@/types/sponsor";
import { shouldUnoptimizeNewsCardImage } from "@/lib/utils";
import { sortableCompactDragHandleClass } from "@/lib/admin/sortableStyles";

interface SponsorFormCardProps {
  item: SponsorItem;
  index: number;
  onEdit: (item: SponsorItem) => void;
  onRemove: (id: string) => void;
}

export const SponsorFormCard = ({
  item,
  index,
  onEdit,
  onRemove,
}: SponsorFormCardProps) => {
  const { ref, handleRef, isDragging } = useSortable({
    id: item._id ?? `temp-id-${index}`,
    index,
  });

  return (
    <div
      ref={ref}
      className={`relative rounded-lg border border-border bg-card p-3 transition-opacity ${
        isDragging ? "opacity-50" : "opacity-100"
      }`}
    >
      {/* Order badge */}
      <div className="absolute right-2 z-10 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
        {index + 1}
      </div>

      {/* Drag handle */}
      <div
        ref={handleRef}
        className={sortableCompactDragHandleClass}
      >
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
      </div>

      {/* Image Preview */}
      {item.image_url && (
        <div className="relative mb-2 aspect-video overflow-hidden rounded-lg bg-muted flex items-center justify-center p-2">
          <Image
            src={item.image_url}
            alt={item.name}
            fill
            unoptimized={shouldUnoptimizeNewsCardImage(item.image_url)}
            className="object-contain"
            sizes="(max-width: 768px) 100vw, 300px"
          />
        </div>
      )}

      {/* Content */}
      <div className="space-y-2">
        <h3 className="line-clamp-2 font-semibold text-sm text-foreground">
          {item.name || "Untitled"}
        </h3>
      </div>

      {/* Actions */}
      <div className="mt-3 flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className="flex-1"
          onClick={() => onEdit(item)}
        >
          <Edit2 className="h-3 w-3 mr-1" /> Edit
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="flex-1 text-destructive hover:text-destructive"
          onClick={() => onRemove(item._id ?? `temp-id-${index}`)}
        >
          <Trash2 className="h-3 w-3 mr-1" /> Remove
        </Button>
      </div>
    </div>
  );
};

export default SponsorFormCard;
