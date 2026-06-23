import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import React from "react";
import { useDropzone } from "react-dropzone";

interface ImageDropZoneProps {
  onFileAccepted: (file: File) => void;
  previewUrl: string | null;
  label: string;
  disabled?: boolean;
  onRemove: () => void;
  className?: string;
}

const ImageDropZone: React.FC<ImageDropZoneProps> = ({
  onFileAccepted,
  previewUrl,
  label,
  disabled = false,
  onRemove,
  className = "",
}) => {
  const onDrop = React.useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles && acceptedFiles[0]) {
        onFileAccepted(acceptedFiles[0]);
      }
    },
    [onFileAccepted],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [] },
    multiple: false,
    disabled,
  });

  return (
    <div className={cn("w-full", className)}>
      <label className="block text-sm font-medium mb-2">{label}</label>
      {previewUrl ? (
        <div className="relative aspect-video rounded-lg overflow-hidden border border-border">
          <img
            src={previewUrl}
            alt={label + " Preview"}
            className="object-cover w-full h-full"
          />
          {/* Remove button */}
          <button
            type="button"
            onClick={onRemove}
            className="absolute right-2 top-2 rounded-full bg-background/80 p-1 hover:bg-background"
            aria-label="Remove video"
          >
            <X className="h-4 w-4 text-foreground" />
          </button>
        </div>
      ) : (
        <div
          {...getRootProps({
            className:
              "flex flex-col items-center justify-center aspect-video border-2 border-dashed border-border rounded-lg cursor-pointer transition-colors bg-muted/30 hover:border-primary/50 focus:border-primary/50 p-4 " +
              (isDragActive ? "border-primary bg-primary/5" : "") +
              (disabled ? " opacity-50 cursor-not-allowed" : ""),
          })}
        >
          <input {...getInputProps()} />
          <span className="text-sm text-muted-foreground">
            Drag & drop or click to select image
          </span>
          <span className="text-xs text-muted-foreground mt-1">
            Supported: JPG, PNG, WebP, SVG, etc.
          </span>
        </div>
      )}
    </div>
  );
};

export default ImageDropZone;
