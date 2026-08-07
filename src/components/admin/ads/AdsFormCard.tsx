"use client";

import React from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Edit2, Trash2, GripVertical } from "lucide-react";
import { useSortable } from "@dnd-kit/react/sortable";
import { cn, shouldUnoptimizeNewsCardImage } from "@/lib/utils";
import { sortableCompactDragHandleClass } from "@/lib/admin/sortableStyles";
import {
  AdsPosition,
  adsHomepageBannerCropSpec,
  adsHomepageIsRatioBasedPosition,
  adsHomepageSupportsSpan,
  type HomepageAdsSectionRatio,
  type AdsBannerCropSpec,
} from "@/types/ads";

/** Minimal shape kartu — mendukung AdsDraft dari AdsForm atau AdsHomepageForm */
export interface AdsFormCardItem {
  _id: string;
  name: string;
  linkUrl: string;
  startedAt: string;
  endedAt: string;
  banner: { previewUrl: string };
  /** Default headline jika tidak ada (form headline-only). */
  position?: AdsPosition;
  /** 1 | 2 untuk posisi span-eligible; default 1. */
  span?: 1 | 2;
  /** Rasio untuk posisi ratio-based. */
  ratio?: HomepageAdsSectionRatio;
}

interface AdsFormCardProps {
  item: AdsFormCardItem;
  index: number;
  isSelected?: boolean;
  onEdit: (item: AdsFormCardItem) => void;
  onRemove: (id: string) => void;
  /** Gunakan crop spec kustom (mis. dari single article). Jika tidak diisi, fallback ke adsHomepageBannerCropSpec. */
  cropSpecOverride?: AdsBannerCropSpec;
}

export function AdsFormCard({
  item,
  index,
  isSelected = false,
  onEdit,
  onRemove,
  cropSpecOverride,
}: AdsFormCardProps) {
  const cardPosition = item.position ?? AdsPosition.HEADLINE;
  const cardSpan = item.span ?? 1;
  const cardRatio = item.ratio ?? "21:9";
  const cropSpec =
    cropSpecOverride ?? adsHomepageBannerCropSpec(cardPosition, cardSpan, cardRatio);

  const { ref, handleRef, isDragging } = useSortable({
    id: item._id,
    index,
  });

  const formatDate = (v: string) => {
    if (!v) return "—";
    try {
      return new Date(v).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return v;
    }
  };

  return (
    <div
      ref={ref}
      className={cn(
        "relative rounded-lg border bg-card p-3 transition-all",
        isDragging && "scale-[1.02] opacity-50 shadow-xl",
        isSelected ? "border-primary ring-2 ring-primary/20" : "border-border",
      )}
    >
      <div className="absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
        {index + 1}
      </div>

      <div
        ref={handleRef}
        className={sortableCompactDragHandleClass}
      >
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
      </div>

      <div className="mt-6 space-y-1">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {cropSpec.label}
          {adsHomepageIsRatioBasedPosition(cardPosition) && (
            <span className="normal-case"> · rasio {item.ratio ?? "21:9"}</span>
          )}
          {adsHomepageSupportsSpan(cardPosition) && (
            <span className="normal-case"> · span {item.span ?? 1}</span>
          )}
        </p>
        <div
          className={cn(
            "relative w-full overflow-hidden rounded-md bg-muted",
            cropSpec.previewAspectClass,
          )}
        >
          <Image
            src={item.banner.previewUrl}
            alt={item.name ? `Banner ${item.name}` : "Banner iklan"}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 300px"
            unoptimized={shouldUnoptimizeNewsCardImage(item.banner.previewUrl)}
          />
        </div>
      </div>

      <div className="mt-3 space-y-1 text-xs">
        <p className="truncate font-semibold text-foreground" title={item.name}>
          {item.name || "—"}
        </p>
        <p className="truncate font-medium text-muted-foreground">
          {item.linkUrl || "—"}
        </p>
        <p className="text-muted-foreground">
          {formatDate(item.startedAt)} – {formatDate(item.endedAt)}
        </p>
      </div>

      <div className="mt-3 flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className="flex-1"
          type="button"
          onClick={() => onEdit(item)}
        >
          <Edit2 className="mr-1 h-3 w-3" />
          Edit
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="flex-1 text-destructive hover:text-destructive"
          type="button"
          onClick={() => onRemove(item._id)}
        >
          <Trash2 className="mr-1 h-3 w-3" />
          Hapus
        </Button>
      </div>
    </div>
  );
}

export default AdsFormCard;
