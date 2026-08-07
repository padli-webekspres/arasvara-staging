"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Edit2, Trash2, GripVertical } from "lucide-react";
import Image from "next/image";
import { useSortable } from "@dnd-kit/react/sortable";
import { sortableVideoDragHandleClass } from "@/lib/admin/sortableStyles";
import { SectionVideoItem } from "@/types/articleSection";

// ── Type Definition ───────────────────────────────────────────────────────

interface VideoFormCardProps {
  item: SectionVideoItem;
  index: number;
  onEdit: (item: SectionVideoItem) => void;
  onRemove: (id: string) => void;
  /** Class aspect thumbnail (default 4:5 untuk pemanggil lain). */
  thumbnailAspectClass?: string;
  /** Tampilkan badge platform (mode combined admin). */
  showPlatformBadge?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────
function getPlatformLabel(type: SectionVideoItem["type"]): string | null {
  if (type === "tiktok") return "TikTok";
  if (type === "instagram") return "Instagram";
  return null;
}

export const VideoFormCard = ({
  item,
  index,
  onEdit,
  onRemove,
  thumbnailAspectClass = "aspect-4/5",
  showPlatformBadge = false,
}: VideoFormCardProps) => {
  const platformLabel = showPlatformBadge ? getPlatformLabel(item.type) : null;
  const isPortraitThumbnail =
    thumbnailAspectClass.includes("9/16") ||
    thumbnailAspectClass.includes("9/8");
  const { ref, handleRef, isDragging } = useSortable({
    id: item._id ?? `temp-id-${index}`,
    index,
  });

  return (
    <div
      ref={ref}
      className={`relative min-w-0 overflow-hidden rounded-lg border border-border bg-card p-3 transition-opacity ${
        isDragging ? "opacity-50" : "opacity-100"
      }`}
    >
      {/* Order badge */}
      <div className="absolute right-2 z-5 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
        {index + 1}
      </div>

      {/* Drag handle */}
      <div
        ref={handleRef}
        className={sortableVideoDragHandleClass}
        style={{ touchAction: "none" }}
        aria-label="Geser untuk mengurutkan video"
        title="Geser untuk mengurutkan video"
      >
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
      </div>

      {/* Thumbnail Preview */}
      {item.thumbnail_url && (
        <div
          className={`relative mb-2 overflow-hidden rounded-lg bg-muted ${thumbnailAspectClass}`}
        >
          <Image
            src={item.thumbnail_url}
            alt={item.title}
            fill
            unoptimized
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 300px"
          />
        </div>
      )}

      {/* Content */}
      <div className="space-y-2">
        {platformLabel && (
          <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {platformLabel}
          </span>
        )}

        {/* Title */}
        <h3 className="line-clamp-2 font-semibold text-sm text-foreground">
          {item.title || "Untitled"}
        </h3>

        {/* URL */}
        <p className="line-clamp-1 text-xs text-muted-foreground">
          {item.video_url || "No URL"}
        </p>
      </div>

      {/* Actions — stack vertikal di kartu portrait sempit (MacBook Air) */}
      <div
        className={`mt-3 flex flex-col gap-2 ${isPortraitThumbnail ? "" : "md:flex-row"}`}
      >
        <Button
          size="sm"
          variant="outline"
          className={`w-full ${isPortraitThumbnail ? "" : "md:flex-1"}`}
          onClick={() => onEdit(item)}
        >
          <Edit2 className="h-3 w-3 mr-1" /> Edit
        </Button>
        <Button
          size="sm"
          variant="outline"
          className={`w-full text-destructive hover:text-destructive ${isPortraitThumbnail ? "" : "md:flex-1"}`}
          onClick={() => onRemove(item._id ?? `temp-id-${index}`)}
        >
          <Trash2 className="h-3 w-3 mr-1" /> Remove
        </Button>
      </div>
    </div>
  );
};

export default VideoFormCard;
