import { Db } from "mongodb";
import { Configuration, ConfigurationValue } from "@/types/configuration";
import {
	uploadConfigurationFile,
	deleteConfigurationFile,
} from "@/lib/configuration/s3-configuration";
import { getImageDimensionsFromBuffer } from "@/lib/image/getImageDimensions";
import logger from "@/lib/logger";
import type { AuditLogActor } from "@/types/auditLog";
import { AuditLogAction } from "@/types/auditLog";
import { createAuditLog, requireAuditActor } from "@/services/auditLogService";

const CONFIGURATION_BUCKET =
	process.env.S3_BUCKET_CONFIGURATION || "arasvara-configuration";

// ── Get/Fetch Configuration ────────────────────────────────────────────────

/**
 * Get all configuration or single configuration by key
 * @param db MongoDB database instance
 * @param key Optional configuration key
 * @returns Array of Configuration or single Configuration | null
 */
export async function getAllConfiguration(
	db: Db,
	key?: string | string[],
): Promise<Configuration[] | Configuration | null> {
	const col = db.collection("configuration");
	const storageBaseUrl = process.env.NEXT_PUBLIC_STORAGE_CONFIGURATION || "";

	// Helper untuk generate url file
	function buildFileUrl(value: ConfigurationValue): string {
		if (!value || !value.storageKey) return "";
		return `${storageBaseUrl.replace(/\/$/, "")}/${value.storageKey}`;
	}

	// Tidak ada key: kembalikan semua
	if (!key) {
		const configs = await col.find({}).toArray();
		return configs.map((c) => {
			if (c.type === "file" && c.value && typeof c.value === "object") {
				(c.value as ConfigurationValue).url = buildFileUrl(
					c.value as ConfigurationValue,
				);
			}
			return {
				...c,
				_id: c._id?.toString(),
			};
		}) as Configuration[];
	}

	// Key bisa string (single) atau array (multiple)
	let keyArr: string[] = [];
	if (typeof key === "string") {
		// Cek apakah ada koma (multiple)
		if (key.includes(",")) {
			keyArr = key
				.split(",")
				.map((k) => k.trim())
				.filter(Boolean);
		} else {
			keyArr = [key];
		}
	} else if (Array.isArray(key)) {
		keyArr = key;
	}

	// Jika tidak ada key valid, kembalikan semua
	if (keyArr.length === 0) {
		const configs = await col.find({}).toArray();
		return configs.map((c) => {
			if (c.type === "file" && c.value && typeof c.value === "object") {
				(c.value as ConfigurationValue).url = buildFileUrl(
					c.value as ConfigurationValue,
				);
			}
			return {
				...c,
				_id: c._id?.toString(),
			};
		}) as Configuration[];
	}

	// Satu key: findOne
	if (keyArr.length === 1) {
		const config = await col.findOne({ key: keyArr[0] });
		if (!config) return null;
		if (
			config.type === "file" &&
			config.value &&
			typeof config.value === "object"
		) {
			(config.value as ConfigurationValue).url = buildFileUrl(
				config.value as ConfigurationValue,
			);
		}
		return { ...config, _id: config._id?.toString() } as Configuration;
	}

	// Banyak key: find $in
	const configs = await col.find({ key: { $in: keyArr } }).toArray();
	return configs.map((c) => {
		if (c.type === "file" && c.value && typeof c.value === "object") {
			(c.value as ConfigurationValue).url = buildFileUrl(
				c.value as ConfigurationValue,
			);
		}
		return {
			...c,
			_id: c._id?.toString(),
		};
	}) as Configuration[];
}

// ── Create/Update Configuration ────────────────────────────────────────────

/**
 * Create or update configuration items
 * Handles both string values (direct update) and file uploads
 * @param db MongoDB database instance
 * @param configurations Array of configurations to update
 * @param fileMap Map of key -> File object for file type configurations
 * @param actor Pengguna yang melakukan perubahan (audit trail)
 * @returns Array of updated configurations
 */
export async function createOrUpdateConfiguration(
	db: Db,
	configurations: Configuration[],
	fileMap: Map<string, File> = new Map(),
	actor: AuditLogActor,
): Promise<Configuration[]> {
	const auditActor = requireAuditActor(actor);
	const col = db.collection("configuration");
	const now = new Date().toISOString();
	const updatedConfigurations: Configuration[] = [];

	try {
		logger.info(
			{
				configCount: configurations.length,
				fileMapKeys: fileMap.size,
			},
			"createOrUpdateConfiguration batch dimulai",
		);
		for (const config of configurations) {
			logger.info(
				{ key: config.key, type: config.type },
				"Processing configuration",
			);

			if (
				config.type === "string" ||
				config.type === "boolean" ||
				config.type === "number"
			) {
				// ── Handle Primitive Types (Direct Update) ────────────────────────────
				const result = await col.findOneAndUpdate(
					{ key: config.key },
					{
						$set: {
							key: config.key,
							value: config.value,
							type: config.type,
							updatedAt: now,
						},
					},
					{ upsert: true, returnDocument: "after" },
				);

				if (result) {
					updatedConfigurations.push({
						...result,
						_id: result._id?.toString(),
					} as Configuration);
					logger.info({ key: config.key }, "String configuration updated");
				}
			} else if (config.type === "file") {
				// ── Handle File Type (Upload + Update) ────────────────────────────
				try {
					// Get old configuration
					const oldConfig = await col.findOne({ key: config.key });
					let oldStorageKey: string | null = null;

					if (
						oldConfig &&
						oldConfig.value &&
						typeof oldConfig.value === "object" &&
						"storageKey" in oldConfig.value
					) {
						oldStorageKey = oldConfig.value.storageKey;
					}

					// Get file from fileMap
					const file = fileMap.get(config.key);
					if (!file) {
						throw new Error(
							`No file provided for configuration key: ${config.key}`,
						);
					}

					// Determine file type for naming
					const fileTypeForNaming = config.key.replace("_config", "");

					// Image WebP + varian -w640/-w1280 di-handle uploadConfigurationFile
					let uploadedWidth: number | undefined;
					let uploadedHeight: number | undefined;
					let uploadedMimeType = file.type;

					const isImageFile =
						config.key.includes("bg") ||
						config.key.includes("thumbnail") ||
						file.type.startsWith("image/");

					const uploadResult = await uploadConfigurationFile(
						file,
						fileTypeForNaming,
					);

					uploadedMimeType = uploadResult.mimeType;
					uploadedWidth = uploadResult.width;
					uploadedHeight = uploadResult.height;

					// Delete old file if exists
					if (oldStorageKey) {
						try {
							await deleteConfigurationFile(oldStorageKey);
							logger.info({ oldStorageKey }, "Old configuration file deleted");
						} catch (deleteError) {
							// Log but don't fail if old file deletion fails
							logger.warn(
								{ oldStorageKey, deleteError },
								"Failed to delete old configuration file",
							);
						}
					}

					// ── Prepare file value with dimensions ────────────────────────
					let imageDimensions: { width?: number; height?: number } = {};

					if (uploadedWidth && uploadedHeight) {
						imageDimensions = {
							width: uploadedWidth,
							height: uploadedHeight,
						};
						logger.info(
							{ key: config.key, ...imageDimensions },
							"Using dimensions from compressed image",
						);
					} else if (isImageFile) {
						try {
							const arrayBuffer = await file.arrayBuffer();
							const buffer = Buffer.from(arrayBuffer);
							const dimensions = await getImageDimensionsFromBuffer(
								buffer,
								uploadedMimeType,
							);
							imageDimensions = {
								width: dimensions.width,
								height: dimensions.height,
							};
							logger.info(
								{ key: config.key, ...imageDimensions },
								"Image dimensions extracted from original",
							);
						} catch (dimensionError) {
							logger.warn(
								{ key: config.key, error: dimensionError },
								"Failed to extract image dimensions, continuing without them",
							);
							// Don't fail the process if dimension extraction fails
						}
					}

					// Update configuration in MongoDB
					const fileValue: ConfigurationValue = {
						storageKey: uploadResult.storageKey,
						bucket: CONFIGURATION_BUCKET,
						mimeType: uploadedMimeType, // Use compressed MIME type (WebP if image)
						...imageDimensions, // Add width/height if extracted
					};

					const result = await col.findOneAndUpdate(
						{ key: config.key },
						{
							$set: {
								key: config.key,
								value: fileValue,
								type: "file",
								updatedAt: now,
							},
						},
						{ upsert: true, returnDocument: "after" },
					);

					if (result) {
						updatedConfigurations.push({
							...result,
							_id: result._id?.toString(),
						} as Configuration);
						logger.info(
							{ key: config.key, storageKey: uploadResult.storageKey },
							"File configuration updated",
						);
					}
				} catch (fileError) {
					logger.error(
						{ key: config.key, fileError },
						"Failed to process file configuration",
					);
					throw fileError;
				}

				// ── Handle Hero Video Thumbnail (pre-extracted from client) ──
				if (
					config.key === "hero_video_config" &&
					fileMap.has("hero_video_config_thumbnail")
				) {
					try {
						const thumbnailFile = fileMap.get("hero_video_config_thumbnail");
						if (thumbnailFile) {
							// Find and delete old thumbnail if exists
							const oldThumbConfig = await col.findOne({
								key: "hero_video_config_thumbnail",
							});
							if (
								oldThumbConfig &&
								oldThumbConfig.value &&
								typeof oldThumbConfig.value === "object" &&
								"storageKey" in oldThumbConfig.value
							) {
								try {
									await deleteConfigurationFile(
										oldThumbConfig.value.storageKey,
									);
									logger.info(
										{ storageKey: oldThumbConfig.value.storageKey },
										"Old thumbnail deleted",
									);
								} catch (err) {
									logger.warn(
										{ storageKey: oldThumbConfig.value.storageKey, err },
										"Failed to delete old thumbnail",
									);
								}
							}

							// Upload thumbnail directly using existing upload function
							const uploadResult = await uploadConfigurationFile(
								thumbnailFile,
								"hero_video_config_thumbnail",
							);

							// Update MongoDB with thumbnail configuration
							const thumbValue: ConfigurationValue = {
								storageKey: uploadResult.storageKey,
								bucket: CONFIGURATION_BUCKET,
								mimeType: uploadResult.mimeType,
							};

							await col.findOneAndUpdate(
								{ key: "hero_video_config_thumbnail" },
								{
									$set: {
										key: "hero_video_config_thumbnail",
										value: thumbValue,
										type: "file",
										updatedAt: now,
									},
								},
								{ upsert: true },
							);

							logger.info(
								{ storageKey: uploadResult.storageKey },
								"Thumbnail uploaded successfully",
							);
						}
					} catch (thumbErr) {
						logger.error({ thumbErr }, "Failed to process thumbnail");
						// Don't throw - thumbnail is optional
					}
				}
			}
		}

		const keysTouched = [
			...new Set([
				...configurations.map((c) => c.key),
				...Array.from(fileMap.keys()),
			]),
		];
		try {
			const detailsText =
				keysTouched.length > 40
					? `${keysTouched.slice(0, 40).join(", ")}… (+${keysTouched.length - 40})`
					: keysTouched.join(", ");
			await createAuditLog(db, {
				actor: auditActor,
				action: AuditLogAction.UPDATE,
				entity: "CONFIGURATION",
				entityId: "configuration",
				details: `Memperbarui konfigurasi: ${detailsText}`,
				newValue: { keys: keysTouched, count: keysTouched.length },
			});
		} catch (auditErr) {
			logger.error(
				{ err: auditErr },
				"createAuditLog gagal setelah createOrUpdateConfiguration",
			);
		}

		return updatedConfigurations;
	} catch (error) {
		logger.error({ error }, "Failed to create or update configuration");
		throw new Error(
			`Failed to create or update configuration: ${error instanceof Error ? error.message : "Unknown error"}`,
		);
	}
}
