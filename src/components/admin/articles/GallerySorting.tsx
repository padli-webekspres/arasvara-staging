"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GripVertical, X } from "lucide-react";
import Image from "next/image";
import React from "react";
import { DragDropProvider } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";

// ─── Gallery Item Interface ────────────────────────────────────────────────
interface GalleryItemData {
  id: string;
  mediaId: string;
  imageUrl: string;
  caption: string;
  credit: string;
  order: number;
}

interface GallerySortingProps {
  // Gallery items array maintained by parent component
  items?: GalleryItemData[];
  // Handlers untuk update gallery items
  onItemCaption?: (id: string, caption: string) => void;
  onItemCredit?: (id: string, credit: string) => void;
  onItemRemove?: (id: string) => void;
  onAddImage?: () => void;
  onReorder?: (items: GalleryItemData[]) => void;
}

// ─── Sortable Gallery Item Component ────────────────────────────────────
interface SortableGalleryItemProps {
  item: GalleryItemData;
  index: number;
  onCaption?: (id: string, caption: string) => void;
  onCredit?: (id: string, credit: string) => void;
  onRemove?: (id: string) => void;
}

function SortableGalleryItem({
  item,
  index,
  onCaption,
  onCredit,
  onRemove,
}: SortableGalleryItemProps) {
  const { ref, handleRef, isDragging } = useSortable({
    id: item.id,
    index,
  });

  return (
    <div
      ref={ref}
      className={`bg-card border rounded-lg flex flex-col md:flex-row gap-3 md:gap-4 relative group transition-all min-w-0 overflow-hidden ${
        isDragging ? "opacity-50 z-50 scale-105 shadow-xl" : "opacity-100"
      }`}
    >
      {/* Image — atas (mobile) / kiri (md+) */}
      <div className="relative w-full md:w-44 lg:w-52 shrink-0">
        <Image
          alt={item.caption || "Gallery item"}
          src={item.imageUrl}
          width={480}
          height={480}
          unoptimized
          className="rounded-t-lg md:rounded-lg w-full aspect-video md:aspect-square object-cover"
        />

        {/* Area Drag Handle */}
        <div
          ref={handleRef}
          className="absolute top-2 left-2 z-10 p-1.5 bg-background/80 backdrop-blur rounded-md cursor-grab active:cursor-grabbing opacity-25 group-hover:opacity-75 !hover:opacity-100 transition-opacity shadow-sm touch-none"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>

        {/* Tombol Remove */}
        <Button
          variant="destructive"
          size="icon"
          className="absolute top-2 right-2 z-10 h-7 w-7 opacity-25 group-hover:opacity-75 !hover:opacity-100 transition-opacity shadow-sm"
          onClick={() => onRemove?.(item.id)}
        >
          <X className="h-4 w-4" />
        </Button>

        {/* Order Badge */}
        <div className="absolute bottom-2 right-2 z-10 px-2 py-1 bg-background/80 backdrop-blur rounded-md text-xs font-semibold text-foreground shadow-sm">
          #{item.order + 1}
        </div>
      </div>

      {/* Input caption dan credit — bawah (mobile) / kanan (md+) */}
      <div className="p-3 md:p-4 space-y-3 md:space-y-4 w-full min-w-0 flex-1">
        <div className="space-y-2">
          <Label>Caption</Label>
          <Input
            placeholder="Enter caption..."
            value={item.caption ?? ""}
            onChange={(e) => onCaption?.(item.id, e.target.value)}
            className="w-full min-w-0"
          />
        </div>
        <div className="space-y-2">
          <Label>Credit</Label>
          <Input
            placeholder="Enter credit..."
            value={item.credit ?? ""}
            onChange={(e) => onCredit?.(item.id, e.target.value)}
            className="w-full min-w-0"
          />
        </div>
      </div>
    </div>
  );
}

// ─── Main GallerySorting Component ────────────────────────────────────────
const GallerySorting = ({
  items = [],
  onItemCaption,
  onItemCredit,
  onItemRemove,
  onAddImage,
  onReorder,
}: GallerySortingProps) => {
  const handleDragEnd = (event: any) => {
    const { operation } = event;
    if (!operation) return;

    const { from, to } = operation;

    if (from !== to && items) {
      const newItems = [...items];
      const [movedItem] = newItems.splice(from, 1);
      newItems.splice(to, 0, movedItem);

      // Recalculate order values
      const reorderedItems = newItems.map((item, index) => ({
        ...item,
        order: index,
      }));

      onReorder?.(reorderedItems);
    }
  };

  // Empty state jika tidak ada gallery items
  if (!items || items.length === 0) {
    return (
      <div className="bg-card border rounded-lg p-6 ">
        {/* heading */}
        <div className="flex justify-between items-center mb-4 w-full">
          <h3 className="text-lg font-semibold">Gallery Items</h3>
          <Button size={"sm"} variant={"outline"} onClick={onAddImage}>
            Tambah Gambar
          </Button>
        </div>

        {/* Empty state */}
        <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Belum ada gambar dalam galeri. Klik "Tambah Gambar" untuk memulai.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border rounded-lg p-4 space-y-4">
      {/* heading */}
      <div className="flex justify-between items-center mb-4 w-full">
        <h3 className="text-lg font-semibold">
          Gallery Items ({items.length})
        </h3>
        <Button size={"sm"} variant={"outline"} onClick={onAddImage}>
          Tambah Gambar
        </Button>
      </div>

      {/* DnD Provider */}
      <DragDropProvider onDragEnd={handleDragEnd}>
        <div className="space-y-3">
          {items.map((item, index) => (
            <SortableGalleryItem
              key={item.id}
              item={item}
              index={index}
              onCaption={onItemCaption}
              onCredit={onItemCredit}
              onRemove={onItemRemove}
            />
          ))}
        </div>
      </DragDropProvider>
    </div>
  );
};

export default GallerySorting;
