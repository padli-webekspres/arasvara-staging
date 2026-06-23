"use client";

import React, { useState, useCallback, useEffect } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";
import {
  saveVideoToIndexedDB,
  removeVideoFromIndexedDB,
  getVideoFromIndexedDB,
} from "@/lib/configuration/indexeddb-config";
import {
  extractVideoThumbnail,
  blobToDataUrl,
  getVideoDurationSeconds,
  HERO_VIDEO_MAX_DURATION_SECONDS,
} from "@/lib/configuration/video-thumbnail";
import axios from "axios";
import api from "@/lib/axios";

// ── Types ──────────────────────────────────────────────────────────────────

interface VideoHeroUploaderProps {
  onVideoSelect?: (file: File | null) => void;
  defaultKey?: string;
  defaultThumbnailUrl?: string | null;
  defaultVideoUrl?: string | null;
}

interface VideoState {
  file: File | null;
  thumbnailUrl: string | null;
  isLoading: boolean;
}

// ── Constants ──────────────────────────────────────────────────────────────

const STORAGE_KEY = "hero_video_config";
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ACCEPTED_TYPES = ["video/mp4", "video/webm"];
const ACCEPTED_EXTENSIONS = ["mp4", "webm"];

// ── Component ──────────────────────────────────────────────────────────────

const VideoHeroUploader: React.FC<VideoHeroUploaderProps> = ({
  onVideoSelect,
  defaultKey = STORAGE_KEY,
  defaultThumbnailUrl = null,
  defaultVideoUrl = null,
}) => {
  const [video, setVideo] = useState<VideoState>({
    file: null,
    thumbnailUrl: null,
    isLoading: false,
  });
  const [isDragActive, setIsDragActive] = useState(false);

  // ── Load existing video from IndexedDB on mount ──────────────────────────

  useEffect(() => {
    const loadStoredVideo = async () => {
      try {
        const stored = await getVideoFromIndexedDB(defaultKey);
        if (stored) {
          const file = new File([stored.file], "hero-video", {
            type: stored.mimeType,
          });
          let thumbnailUrl: string | null = null;
          try {
            const thumbnail = await extractVideoThumbnail(stored.file);
            thumbnailUrl = await blobToDataUrl(thumbnail);
          } catch {
            thumbnailUrl = null;
          }
          setVideo({ file, thumbnailUrl, isLoading: false });
        } else if (defaultVideoUrl) {
          // Fetch video file from backend and set as if user selected it
          try {
            const res = await axios.get<Blob>(defaultVideoUrl, { responseType: "blob" });
            const blob = res.data;

            // Try to guess mime type from headers
            const mimeType = res.headers["content-type"] || "video/mp4";
            const file = new File([blob], "hero-video", { type: mimeType });
            let thumbnailUrl: string | null = null;
            try {
              const thumbnail = await extractVideoThumbnail(blob);
              thumbnailUrl = await blobToDataUrl(thumbnail);
            } catch {
              thumbnailUrl = defaultThumbnailUrl || null;
            }
            setVideo({ file, thumbnailUrl, isLoading: false });
            onVideoSelect?.(file);
          } catch {
            if (defaultThumbnailUrl) {
              setVideo({ file: null, thumbnailUrl: defaultThumbnailUrl, isLoading: false });
            }
          }
        } else if (defaultThumbnailUrl) {
          setVideo({ file: null, thumbnailUrl: defaultThumbnailUrl, isLoading: false });
        }
      } catch {
        if (defaultThumbnailUrl) {
          setVideo({ file: null, thumbnailUrl: defaultThumbnailUrl, isLoading: false });
        }
      }
    };
    loadStoredVideo();
  }, [defaultKey, defaultThumbnailUrl, defaultVideoUrl, onVideoSelect]);

  // ── Validate file ──────────────────────────────────────────────────────

  const validateFile = (file: File): { valid: boolean; error?: string } => {
    // Check file type
    if (!ACCEPTED_TYPES.includes(file.type)) {
      const extensions = ACCEPTED_EXTENSIONS.join(", ");
      return {
        valid: false,
        error: `File type not supported. Only ${extensions} are allowed.`,
      };
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      const maxMB = MAX_FILE_SIZE / (1024 * 1024);
      return {
        valid: false,
        error: `File is too large. Maximum size is ${maxMB} MB.`,
      };
    }

    return { valid: true };
  };

  // ── Handle file selection ──────────────────────────────────────────────

  const handleFileSelect = useCallback(
    async (selectedFile: File) => {
      // Validate file
      const validation = validateFile(selectedFile);
      if (!validation.valid) {
        toast.error(validation.error);
        return;
      }

      setVideo((prev) => ({ ...prev, isLoading: true }));

      try {
        console.log(
          "[VideoHeroUploader] Starting file selection process for:",
          selectedFile.name,
        );
        
        // Cek durasi setelah UI menampilkan loading
        const durationSec = await getVideoDurationSeconds(selectedFile);
        if (durationSec > HERO_VIDEO_MAX_DURATION_SECONDS) {
          const rounded = Math.ceil(durationSec);
          toast.error(
            `Video hero maksimal ${HERO_VIDEO_MAX_DURATION_SECONDS} detik. Durasi file: ${rounded} detik.`,
          );
          setVideo((prev) => ({ ...prev, isLoading: false }));
          return;
        }
      } catch {
        toast.error(
          "Gagal memeriksa durasi video. Pastikan file video valid.",
        );
        setVideo((prev) => ({ ...prev, isLoading: false }));
        return;
      }

      try {
        // Save to IndexedDB
        console.log("[VideoHeroUploader] Saving video to IndexedDB...");
        await saveVideoToIndexedDB(defaultKey, selectedFile, selectedFile.type);

        // Extract and generate thumbnail
        console.log("[VideoHeroUploader] Extracting thumbnail...");
        let thumbnailUrl: string | null = null;
        try {
          const thumbnail = await extractVideoThumbnail(selectedFile);
          thumbnailUrl = await blobToDataUrl(thumbnail);
          console.log(
            "[VideoHeroUploader] Thumbnail generated:",
            thumbnailUrl ? "SUCCESS" : "NULL",
          );
          console.log("thumbnail url:", thumbnailUrl);
          if (!thumbnailUrl) {
            console.warn(
              "[VideoHeroUploader] Thumbnail URL is empty after blobToDataUrl",
            );
          }
        } catch (err) {
          console.error(
            "[VideoHeroUploader] Failed to extract/generate thumbnail:",
            err,
          );
          thumbnailUrl = null;
        }

        // Update state
        setVideo({
          file: selectedFile,
          thumbnailUrl,
          isLoading: false,
        });

        // Notify parent component
        onVideoSelect?.(selectedFile);

        console.log(
          "[VideoHeroUploader] File selection completed successfully",
        );
        toast.success("Video uploaded successfully!");
      } catch (error) {
        console.error("[VideoHeroUploader] Error processing video:", error);
        toast.error(
          `Failed to process video: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
        setVideo((prev) => ({ ...prev, isLoading: false }));
      }
    },
    [defaultKey, onVideoSelect],
  );

  // ── Handle drag and drop ────────────────────────────────────────────

  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragActive(false);

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        const file = files[0];
        handleFileSelect(file);
      }
    },
    [handleFileSelect],
  );

  // ── Handle file input change ───────────────────────────────────────────

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.currentTarget.files;
      if (files && files.length > 0) {
        const file = files[0];
        handleFileSelect(file);
      }
      e.currentTarget.value = "";
    },
    [handleFileSelect],
  );

  // ── Remove video ────────────────────────────────────────────────────

  const handleRemoveVideo = useCallback(async () => {
    try {
      console.log(
        "[VideoHeroUploader] Attempting to remove video from IndexedDB",
      );
      await removeVideoFromIndexedDB(defaultKey);

      setVideo({
        file: null,
        thumbnailUrl: null,
        isLoading: false,
      });
      onVideoSelect?.(null);

      console.log("[VideoHeroUploader] Video removed successfully");
      toast.success("Video removed successfully");
    } catch (error) {
      // This should rarely happen now due to silent fallback in removeVideoFromIndexedDB
      console.error("[VideoHeroUploader] Error removing video:", error);
      toast.error("Failed to remove video");
    }
  }, [defaultKey, onVideoSelect]);

  // ── Render ────────────────────────────────────────────────────────

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium">
        Hero Section Video <span className="text-destructive">*</span>
      </label>

      {video.thumbnailUrl && video.file ? (
        // Video preview with thumbnail
        <div className="relative w-full">
          <div className="relative w-full overflow-hidden rounded-lg border border-border bg-muted">
            <Image
              src={video.thumbnailUrl}
              alt="Video thumbnail"
              width={320}
              height={240}
              className="h-auto w-full object-cover"
              unoptimized
            />

            {/* Remove button */}
            <button
              type="button"
              onClick={handleRemoveVideo}
              className="absolute right-2 top-2 rounded-full bg-background/80 p-1 hover:bg-background"
              aria-label="Remove video"
            >
              <X className="h-4 w-4 text-foreground" />
            </button>
          </div>

          {/* Video info */}
          <div className="mt-2 text-xs text-muted-foreground">
            <p>
              <strong>File:</strong> {video.file.name}
            </p>
            <p>
              <strong>Size:</strong>{" "}
              {(video.file.size / (1024 * 1024)).toFixed(2)} MB
            </p>
            <p>
              <strong>Type:</strong> {video.file.type}
            </p>
          </div>
        </div>
      ) : (
        // Drag and drop area
        <div
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-12 transition-colors ${isDragActive
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-muted/30"
            } ${video.isLoading ? "cursor-wait opacity-50" : "cursor-pointer"}`}
        >
          {video.isLoading ? (
            <div className="text-center">
              <div className="mb-2 inline-flex h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="text-sm text-muted-foreground">
                Processing video...
              </p>
            </div>
          ) : (
            <>
              <svg
                className="mb-3 h-10 w-10 text-muted-foreground"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-center text-sm font-medium">
                Drag and drop your video here or click to browse
              </p>
              <p className="mt-1 text-center text-xs text-muted-foreground">
                MP4, WebM — maks. 10 MB dan {HERO_VIDEO_MAX_DURATION_SECONDS}{" "}
                detik
              </p>
              <input
                type="file"
                accept={ACCEPTED_EXTENSIONS.map((ext) => `.${ext}`).join(",")}
                className="hidden"
                onChange={handleInputChange}
                disabled={video.isLoading}
                aria-label="Upload video"
              />
              <label
                htmlFor="video-file-input"
                className="mt-4 cursor-pointer rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 inline-block"
              >
                Browse Files
              </label>
              <input
                id="video-file-input"
                type="file"
                accept={ACCEPTED_EXTENSIONS.map((ext) => `.${ext}`).join(",")}
                onChange={handleInputChange}
                className="hidden"
                disabled={video.isLoading}
                aria-label="Select video file"
              />
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default VideoHeroUploader;
