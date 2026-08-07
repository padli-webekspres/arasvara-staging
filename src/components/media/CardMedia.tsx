"use client";

import { useState } from "react";
import { Badge } from "../ui/badge";
import { Eye } from "lucide-react";
import Image from "next/image";
import MediaShowModal from "./MediaShowModal";
import type { Media } from "@/types/media";

interface CardMediaProps {
  media: Media;
  onDeleted?: (mediaId: string) => void;
}

const CardMedia = ({ media, onDeleted }: CardMediaProps) => {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <div className="group rounded-lg border border-border overflow-hidden relative">
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="relative w-full p-0 m-0 border-none outline-none bg-transparent cursor-pointer"
          style={{ display: "block" }}
        >
          <Image
            unoptimized
            src={media.url}
            alt={media.caption || "Media"}
            width={240}
            height={160}
            className="w-full pointer-events-none select-none"
          />
          {/* Overlay and Eye Button on Hover */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <span className="flex items-center justify-center w-12 h-12 rounded-full bg-white/80 shadow-lg">
              <Eye className="w-6 h-6 text-primary" />
            </span>
          </div>
        </button>
        <div className="p-3">
          <Badge variant="default" className="mb-2">
            {media.mimetype?.startsWith("image/")
              ? "Image"
              : media.mimetype?.startsWith("video/")
                ? "Video"
                : "File"}
          </Badge>
          {media.credit && (
            <p className="text-sm text-primary">Credit: {media.credit}</p>
          )}
          {media.caption && (
            <p className="text-sm text-primary">{media.caption}</p>
          )}
        </div>
      </div>

      {/* Media Show Modal - hanya render saat open untuk performa */}
      {showModal && (
        <MediaShowModal
          open={showModal}
          media={media}
          onClose={() => setShowModal(false)}
          onDeleted={(id) => {
            onDeleted?.(id);
            setShowModal(false);
          }}
        />
      )}
    </>
  );
};

export default CardMedia;
