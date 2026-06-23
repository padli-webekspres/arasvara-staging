/** Durasi maksimal video hero (detik). */
export const HERO_VIDEO_MAX_DURATION_SECONDS = 15;

/**
 * Membaca durasi video dari file (detik). Hanya di browser.
 */
export function getVideoDurationSeconds(file: Blob): Promise<number> {
  return new Promise((resolve, reject) => {
    const videoUrl = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";

    const cleanup = () => {
      URL.revokeObjectURL(videoUrl);
    };

    video.addEventListener(
      "loadedmetadata",
      () => {
        const duration = video.duration;
        cleanup();
        if (!Number.isFinite(duration) || duration <= 0) {
          reject(new Error("Durasi video tidak valid"));
          return;
        }
        resolve(duration);
      },
      { once: true },
    );

    video.addEventListener(
      "error",
      () => {
        cleanup();
        reject(new Error("Gagal membaca metadata video"));
      },
      { once: true },
    );

    video.src = videoUrl;
    video.load(); // Paksa browser untuk memuat video agar event loadedmetadata terpanggil

    setTimeout(() => {
      if (!Number.isFinite(video.duration) || video.duration <= 0) {
        cleanup();
        reject(new Error("Timeout membaca durasi video"));
      }
    }, 10000);
  });
}

/**
 * Video thumbnail extractor
 * Extract the first frame from a video file as a thumbnail
 */

/**
 * Extract thumbnail (first frame) from video file
 * @param file Video file (mp4, webm, etc.)
 * @returns Promise<Blob> PNG blob of the first frame
 */
export async function extractVideoThumbnail(file: Blob): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      // Create a URL for the video file
      const videoUrl = URL.createObjectURL(file);

      // Create video element
      const video = document.createElement("video");
      video.src = videoUrl;

      // Handler for when video is ready to draw first frame
      const handleLoadedData = () => {
        try {
          // Seek to the first frame (0)
          video.currentTime = 0;

          // Wait for seeked event to ensure frame is ready
          video.addEventListener(
            "seeked",
            () => {
              try {
                const canvas = document.createElement("canvas");
                canvas.width = video.videoWidth || 320;
                canvas.height = video.videoHeight || 240;
                const context = canvas.getContext("2d");
                if (!context) {
                  throw new Error("Failed to get canvas context");
                }
                context.drawImage(video, 0, 0, canvas.width, canvas.height);
                canvas.toBlob(
                  (blob) => {
                    URL.revokeObjectURL(videoUrl);
                    video.pause();
                    if (blob) {
                      resolve(blob);
                    } else {
                      reject(new Error("Failed to convert canvas to blob"));
                    }
                  },
                  "image/png",
                  0.8,
                );
              } catch (error) {
                URL.revokeObjectURL(videoUrl);
                reject(error);
              }
            },
            { once: true },
          );
        } catch (error) {
          URL.revokeObjectURL(videoUrl);
          reject(error);
        }
      };

      const handleError = () => {
        URL.revokeObjectURL(videoUrl);
        reject(new Error("Failed to load video data"));
      };

      video.addEventListener("loadeddata", handleLoadedData, { once: true });
      video.addEventListener("error", handleError, { once: true });

      // Load video data
      video.load();

      // Set timeout in case video never loads
      setTimeout(() => {
        if (video.readyState < 2) {
          video.removeEventListener("loadeddata", handleLoadedData);
          video.removeEventListener("error", handleError);
          URL.revokeObjectURL(videoUrl);
          reject(new Error("Video data loading timeout"));
        }
      }, 10000);
    } catch (error) {
      reject(
        new Error(
          `Error extracting thumbnail: ${error instanceof Error ? error.message : "Unknown error"}`,
        ),
      );
    }
  });
}

/**
 * Convert blob to data URL for preview
 * @param blob Blob or File
 * @returns Promise<string> Data URL
 */
export async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result as string);
    };
    reader.onerror = () => {
      reject(new Error("Failed to convert blob to data URL"));
    };
    reader.readAsDataURL(blob);
  });
}
