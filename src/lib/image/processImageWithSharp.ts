/**
 * Pemrosesan gambar server-side dengan Sharp → WebP.
 *
 * Dipakai oleh `POST /api/media/process-temp`: klien iPad cukup mengirim hasil
 * crop (JPEG/WebP/PNG/HEIC apa pun), server yang menangani:
 * - decode format apa pun termasuk HEIC/HEIF (libvips)
 * - kompresi WebP dengan target ukuran (binary search quality)
 * - watermark otomatis (logo terang/gelap berdasarkan luminance gambar)
 *
 * Dengan ini klien tidak lagi menjalankan kompresi Pica / canvas besar yang
 * menjadi penyebab utama "Page Reloaded Because of an Issue" di iPad Safari.
 */

import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { compressImageWithSharp } from "@/lib/image/compressImageWithSharp";
import { BRAND_LOGO } from "@/lib/brand-logos";
import logger from "@/lib/logger";

export interface ProcessImageOptions {
  maxWidth?: number;
  maxHeight?: number;
  maxSizeMB?: number;
  /** Terapkan watermark logo otomatis (default false). */
  watermark?: boolean;
  /** Opacity watermark 0–1 (default 0.25, sama dengan jalur galeri lama). */
  watermarkOpacity?: number;
}

export interface ProcessedImageResult {
  buffer: Buffer;
  format: "webp";
  mimeType: "image/webp";
  width: number;
  height: number;
  fileSize: number;
  watermarkApplied: boolean;
}

const BRIGHTNESS_THRESHOLD = 128; // 0-255, di atas ini = gambar cerah

/** Lebar watermark = 25% lebar gambar; padding 5% (menyamai perilaku client lama). */
const WATERMARK_WIDTH_RATIO = 0.25;
const WATERMARK_PADDING_RATIO = 0.05;

async function loadWatermarkBuffer(logoPath: string): Promise<Buffer> {
  // Aset brand ada di folder `public/` (lihat @/lib/brand-logos).
  const fullPath = path.join(process.cwd(), "public", logoPath);
  try {
    return await fs.readFile(fullPath);
  } catch (err) {
    logger.error(
      { err, logoPath, fullPath },
      "processImage: gagal membaca aset watermark",
    );
    throw new Error(`Watermark asset not found: ${logoPath}`);
  }
}

/** Rata-rata luminance (ITU-R BT.601) dari mean channel Sharp stats. */
async function detectAverageLuminance(buffer: Buffer): Promise<number> {
  try {
    const stats = await sharp(buffer).stats();
    const r = stats.channels[0]?.mean ?? 0;
    const g = stats.channels[1]?.mean ?? 0;
    const b = stats.channels[2]?.mean ?? 0;
    return 0.299 * r + 0.587 * g + 0.114 * b;
  } catch {
    return BRIGHTNESS_THRESHOLD; // default: anggap netral
  }
}

/**
 * Terapkan watermark logo ke pojok kanan atas.
 * - Gambar cerah → logo gelap; gambar gelap → logo terang.
 * - Posisi & ukuran meniru `embedWatermarkToImage` versi client lama.
 */
async function applyWatermark(
  buffer: Buffer,
  opacity: number,
): Promise<Buffer> {
  const luminance = await detectAverageLuminance(buffer);
  const logoPath =
    luminance > BRIGHTNESS_THRESHOLD
      ? BRAND_LOGO.mainDark
      : BRAND_LOGO.mainLight;
  const wmBuffer = await loadWatermarkBuffer(logoPath);

  const metadata = await sharp(buffer).metadata();
  const width = metadata.width ?? 1920;

  const wmWidth = Math.max(1, Math.round(width * WATERMARK_WIDTH_RATIO));
  const padding = Math.max(1, Math.round(width * WATERMARK_PADDING_RATIO));

  // Sharp versi project ini tidak mendukung option `opacity` di composite —
  // terapkan opacity dengan mengalikan channel alpha secara manual (premultiply).
  const clampedOpacity = Math.min(1, Math.max(0, opacity));
  const raw = await sharp(wmBuffer)
    .resize({ width: wmWidth })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { data, info } = raw;
  const wmData = Buffer.from(data);
  for (let i = 3; i < wmData.length; i += 4) {
    wmData[i] = Math.round(wmData[i] * clampedOpacity);
  }
  const wm = await sharp(wmData, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer();
  return sharp(buffer)
    .composite([
      {
        input: wm,
        top: padding * 2,
        left: Math.max(0, width - wmWidth - padding),
      },
    ])
    .toBuffer();
}

/**
 * Proses buffer gambar menjadi WebP terkompresi (opsional + watermark).
 * Watermark diterapkan SEBELUM kompresi agar kualitas logo terjaga.
 */
export async function processImageWithSharp(
  inputBuffer: Buffer,
  options: ProcessImageOptions = {},
): Promise<ProcessedImageResult> {
  const {
    watermark = false,
    watermarkOpacity = 0.25,
    maxWidth,
    maxHeight,
    maxSizeMB,
  } = options;

  let working = inputBuffer;
  let watermarkApplied = false;
  if (watermark) {
    working = await applyWatermark(working, watermarkOpacity);
    watermarkApplied = true;
  }

  const result = await compressImageWithSharp(
    working,
    maxWidth,
    maxHeight,
    maxSizeMB,
  );

  return {
    buffer: result.buffer,
    format: result.format,
    mimeType: result.mimeType,
    width: result.width,
    height: result.height,
    fileSize: result.fileSize,
    watermarkApplied,
  };
}
