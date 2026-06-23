import { ObjectId } from "mongodb";

/**
 * Single configuration item stored in database
 */
export interface Configuration {
  _id?: string | ObjectId;
  key: string;
  value: string | boolean | ConfigurationValue;
  type?: "string" | "number" | "boolean" | "file";
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Configuration value for file type (video, images, etc.)
 */
export interface ConfigurationValue {
  storageKey: string;
  bucket: string;
  mimeType: string;
  width?: number; // Image width in pixels (optional, for image files)
  height?: number; // Image height in pixels (optional, for image files)
  url?: string; // optional, hanya untuk get response
}

/**
 * Payload for creating/updating configurations
 * Array of configuration items to be sent to API
 */
export interface CreateConfigurationPayload {
  configurations: Configuration[];
}
