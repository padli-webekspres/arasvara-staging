/**
 * Extract image dimensions (width, height) from image file
 * Uses Image API to determine dimensions
 */

export interface ImageDimensions {
  width: number;
  height: number;
}

/**
 * Get image dimensions from File object
 * @param file Image file to analyze
 * @returns Promise with width and height in pixels
 * @throws Error if file is not a valid image or cannot be loaded
 */
export async function getImageDimensions(file: File): Promise<ImageDimensions> {
  return new Promise((resolve, reject) => {
    // Create object URL from file
    const url = URL.createObjectURL(file);

    // Create image element
    const img = new Image();

    // Set up timeout for image load
    const timeoutId = setTimeout(() => {
      URL.revokeObjectURL(url);
      reject(new Error("Image load timeout"));
    }, 5000);

    // Handle successful image load
    img.onload = () => {
      clearTimeout(timeoutId);
      URL.revokeObjectURL(url);
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    };

    // Handle image load error
    img.onerror = () => {
      clearTimeout(timeoutId);
      URL.revokeObjectURL(url);
      reject(
        new Error("Failed to load image. Make sure the file is a valid image."),
      );
    };

    // Set image source to object URL
    img.src = url;
  });
}

/**
 * Get image dimensions from File (Node.js compatible)
 * Used on backend to extract dimensions from uploaded files
 * @param buffer Image file buffer
 * @param mimeType MIME type of the image
 * @returns Promise with width and height in pixels
 * @throws Error if dimensions cannot be determined
 */
export async function getImageDimensionsFromBuffer(
  buffer: Buffer,
  mimeType: string,
): Promise<ImageDimensions> {
  try {
    // For now, we'll use a simple approach with sharp if available
    // If sharp is not available, dimensions will need to be extracted client-side
    const sharp = await import("sharp");

    const metadata = await sharp.default(buffer).metadata();

    if (!metadata.width || !metadata.height) {
      throw new Error("Could not determine image dimensions");
    }

    return {
      width: metadata.width,
      height: metadata.height,
    };
  } catch (error) {
    // If sharp is not available or fails, throw error
    if (error instanceof Error) {
      throw new Error(`Failed to extract image dimensions: ${error.message}`);
    }
    throw new Error("Failed to extract image dimensions");
  }
}
