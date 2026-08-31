/**
 * Validate configuration files before upload
 * Checks MIME type, file size, and file integrity
 */

import { assertDecodableImage } from "@/lib/image/detectImageFormat";

// ── Constants ──────────────────────────────────────────────────────────────
const MAX_FILE_SIZE_MB = 10; // Frontend max file size before backend compression
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

// ── Types ──────────────────────────────────────────────────────────────────
export interface FileValidationError {
  isValid: false;
  error: string;
}

export interface FileValidationSuccess {
  isValid: true;
}

export type FileValidationResult = FileValidationSuccess | FileValidationError;

// ── Configuration File Validation ──────────────────────────────────────────

/**
 * Validate configuration file for upload
 * @param file File object to validate
 * @param configKey Configuration key (used to determine file type validation)
 * @returns Validation result with error message if invalid
 */
export async function validateConfigurationFile(
  file: File,
  configKey: string,
): Promise<FileValidationResult> {
  if (!file) {
    return {
      isValid: false,
      error: "File is required",
    };
  }

  if (file.size === 0) {
    return {
      isValid: false,
      error: "File is empty",
    };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    const sizeInMB = (file.size / (1024 * 1024)).toFixed(2);
    return {
      isValid: false,
      error: `File size (${sizeInMB}MB) exceeds maximum allowed size of ${MAX_FILE_SIZE_MB}MB`,
    };
  }

  const isBackgroundFile = configKey.includes("bg");

  if (isBackgroundFile || configKey.includes("thumbnail")) {
    if (file.type === "image/svg+xml" || file.type === "image/svg") {
      return {
        isValid: false,
        error: "SVG tidak diizinkan. Gunakan JPEG, PNG, atau WebP.",
      };
    }
    const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    try {
      assertDecodableImage(
        file.type,
        head,
        "File harus berupa gambar (JPEG, PNG, atau WebP)",
      );
    } catch (err) {
      return {
        isValid: false,
        error: err instanceof Error ? err.message : "File harus berupa gambar",
      };
    }
  }

  return {
    isValid: true,
  };
}
