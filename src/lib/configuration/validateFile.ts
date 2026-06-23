/**
 * Validate configuration files before upload
 * Checks MIME type, file size, and file integrity
 */

// ── Constants ──────────────────────────────────────────────────────────────
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
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
export function validateConfigurationFile(
  file: File,
  configKey: string,
): FileValidationResult {
  // ── Check file existence ───────────────────────────────────────────────
  if (!file) {
    return {
      isValid: false,
      error: "File is required",
    };
  }

  // ── Check file size ────────────────────────────────────────────────────
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

  // ── Check MIME type based on key ───────────────────────────────────────
  // Keys containing "bg" (background) are image files
  const isBackgroundFile = configKey.includes("bg");

  if (isBackgroundFile || configKey.includes("thumbnail")) {
    // Image file validation
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return {
        isValid: false,
        error: `Invalid image type: ${file.type}. Allowed types: JPEG, PNG, WebP`,
      };
    }
  }

  // ── All validations passed ────────────────────────────────────────────
  return {
    isValid: true,
  };
}
