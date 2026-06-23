import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/db";
import { getUserFromRequest } from "@/lib/auth";
import {
  getAllConfiguration,
  createOrUpdateConfiguration,
} from "@/services/configurationService";
import { Configuration } from "@/types/configuration";
import { validateConfigurationFile } from "@/lib/configuration/validateFile";
import logger from "@/lib/logger";

// ── Allowed roles untuk update configuration ────────────────────────────────
const ALLOWED_ROLES = ["admin", "editor"];

// ── POST /api/configuration - Create/Update Configuration ───────────────────

/**
 * POST endpoint untuk update configuration
 * Hanya admin dan editor yang dapat mengakses
 * Handle both string values dan file uploads
 */
export async function POST(req: NextRequest) {
  try {
    // ── Check Content-Type ─────────────────────────────────────────────
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "Content-Type must be multipart/form-data" },
        { status: 400 },
      );
    }

    // ── Verify Authentication & Authorization ──────────────────────────
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized: Authentication required." },
        { status: 401 },
      );
    }

    // Check user role
    if (!ALLOWED_ROLES.includes(user.role)) {
      return NextResponse.json(
        { error: "Forbidden: Only admin and editor can update configuration" },
        { status: 403 },
      );
    }

    // ── Parse FormData ─────────────────────────────────────────────────
    const formData = await req.formData();
    const configurationsJson = formData.get("configurations")?.toString();

    if (!configurationsJson) {
      return NextResponse.json(
        { error: "Missing required field: configurations" },
        { status: 400 },
      );
    }

    // Parse configurations array
    let configurations: Configuration[];
    try {
      configurations = JSON.parse(configurationsJson);
      if (!Array.isArray(configurations)) {
        throw new Error("configurations must be an array");
      }
    } catch (parseError) {
      return NextResponse.json(
        {
          error: `Invalid configurations JSON: ${parseError instanceof Error ? parseError.message : "Unknown error"}`,
        },
        { status: 400 },
      );
    }

    // Validate configurations
    if (configurations.length === 0) {
      return NextResponse.json(
        { error: "configurations array cannot be empty" },
        { status: 400 },
      );
    }

    // ── Build file map for file-type configurations ──────────────────
    const fileMap = new Map<string, File>();

    for (const config of configurations) {
      if (config.type === "file") {
        // Extract file from FormData using config key as field name
        const file = formData.get(config.key);

        if (file && typeof file === "object" && "arrayBuffer" in file) {
          const fileObject = file as File;

          // ── Validate file before adding to map ──────────────────────
          const validation = validateConfigurationFile(fileObject, config.key);
          if (!validation.isValid) {
            logger.warn(
              { key: config.key, error: validation.error },
              "File validation failed",
            );
            return NextResponse.json(
              {
                error: `File validation failed for ${config.key}: ${validation.error}`,
              },
              { status: 400 },
            );
          }

          fileMap.set(config.key, fileObject);
          logger.info(
            {
              key: config.key,
              filename: fileObject.name,
              size: fileObject.size,
            },
            "File added to map after validation",
          );
        } else {
          logger.warn(
            { key: config.key },
            "No file provided for file-type configuration",
          );
          return NextResponse.json(
            { error: `File required for configuration key: ${config.key}` },
            { status: 400 },
          );
        }
      }
    }

    // ── Extract and validate thumbnail file if sent separately ────────
    const thumbnailFile = formData.get("hero_video_config_thumbnail");
    if (
      thumbnailFile &&
      typeof thumbnailFile === "object" &&
      "arrayBuffer" in thumbnailFile
    ) {
      const thumbnailFileObject = thumbnailFile as File;

      // Validate thumbnail file
      const thumbValidation = validateConfigurationFile(
        thumbnailFileObject,
        "hero_video_config_thumbnail",
      );
      if (!thumbValidation.isValid) {
        logger.warn(
          { error: thumbValidation.error },
          "Thumbnail validation failed",
        );
        return NextResponse.json(
          { error: `Thumbnail validation failed: ${thumbValidation.error}` },
          { status: 400 },
        );
      }

      fileMap.set("hero_video_config_thumbnail", thumbnailFileObject);
      logger.info("Thumbnail file extracted and validated");
    }

    // ── Connect to database and update configurations ────────────────
    const db = await connectToDatabase();

    logger.info(
      { count: configurations.length, role: user.role },
      "Updating configurations",
    );

    const updatedConfigurations = await createOrUpdateConfiguration(
      db,
      configurations,
      fileMap,
      {
        _id: user._id,
        name: user.name,
        email: user.email,
      },
    );

    logger.info(
      { count: updatedConfigurations.length },
      "Configurations updated successfully",
    );

    return NextResponse.json(
      {
        success: true,
        message: "Configuration updated successfully",
        updatedConfigurations,
      },
      { status: 200 },
    );
  } catch (error) {
    logger.error({ error }, "POST /api/configuration failed");
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}

// ── GET /api/configuration - Get Configuration ────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const db = await connectToDatabase();
    const { searchParams } = new URL(req.url);

    // keyParam: string | null. Ubah null jadi undefined agar sesuai tipe getAllConfiguration
    const keyRaw = searchParams.get("key");
    const keyParam: string | undefined = keyRaw === null ? undefined : keyRaw;

    const result = await getAllConfiguration(db, keyParam);

    // Tidak ada key: kembalikan semua (array)
    if (!keyParam) {
      return NextResponse.json(result);
    }

    // Ada key, cek apakah banyak atau satu
    if (keyParam.includes(",")) {
      // Banyak key: array (bisa kosong)
      return NextResponse.json(result);
    } else {
      // Satu key: kembalikan objek atau 404
      if (!result) {
        return NextResponse.json(
          { error: "Configuration not found" },
          { status: 404 },
        );
      }
      return NextResponse.json(result);
    }
  } catch (error) {
    logger.error({ error }, "GET /api/configuration failed");
    return NextResponse.json(
      { error: (error as Error).message || "Internal server error" },
      { status: 500 },
    );
  }
}
