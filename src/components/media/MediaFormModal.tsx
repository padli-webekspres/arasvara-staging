"use client";

import React from "react";
import { Button } from "../ui/button";
import { X } from "lucide-react";
import MediaUploadForm from "./MediaUploadForm";
import type { Media } from "@/types/media";

interface MediaFormModalProps {
  onClose: () => void;
  onSuccess?: (media: Media) => void;
}

const MediaFormModal = ({ onClose, onSuccess }: MediaFormModalProps) => {
  const handleSuccess = (media: Media) => {
    onSuccess?.(media);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black/25"
        onClick={onClose}
        aria-label="Close modal background"
      />
      <div className="relative bg-card rounded-lg shadow-lg w-full max-w-3xl mx-auto p-6 z-10">
        <div className="flex justify-between items-center mb-4 border-b border-border pb-2">
          <h2 className="text-lg font-semibold">Add Media</h2>
          <Button variant="outline" onClick={onClose} aria-label="Close modal">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <MediaUploadForm onSuccess={handleSuccess} onCancel={onClose} />
      </div>
    </div>
  );
};

export default MediaFormModal;
