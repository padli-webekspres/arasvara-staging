import { ObjectId } from "mongodb";

/**
 * Enum untuk Kunci Aktivitas Target Bulanan (Monthly KPI).
 * Kunci-kunci ini mewakili metrik aktivitas redaksi dan komersial yang dapat dipantau.
 */
export enum MonthlyTargetKey {
  // ─── Aktivitas Produksi Konten (Global) ───────────────────────────
  ARTICLES_SUBMITTED = "ARTICLES_SUBMITTED", // Jumlah total draf artikel yang diajukan penulis
  ARTICLES_PUBLISHED = "ARTICLES_PUBLISHED", // Jumlah total artikel yang berhasil terbit/tayang
  SOCIAL_MEDIA_PUBLISHED = "SOCIAL_MEDIA_PUBLISHED", // Jumlah postingan sosial media yang diintegrasikan ke web

  // ─── Aktivitas Review & SLAs (Global) ─────────────────────────────
  ARTICLES_TO_PROCESS = "ARTICLES_TO_PROCESS", // Jumlah naskah yang ditargetkan untuk diproses Editor
  REVISION_RATE_MAX = "REVISION_RATE_MAX", // Batas toleransi revisi maksimal (0 - 100%)
  PROCESSING_TIME_SLA_MINUTES = "PROCESSING_TIME_SLA_MINUTES", // Batas maksimal waktu pemrosesan SLA (Menit)

  // ─── Metrik Traffic & Performa Pembaca (Global & Channel) ─────────
  SITE_TOTAL_PAGEVIEWS = "SITE_TOTAL_PAGEVIEWS", // Target pageviews kumulatif untuk seluruh situs
  CHANNEL_PAGEVIEWS = "CHANNEL_PAGEVIEWS", // Target pageviews spesifik per kategori/kanal
  CHANNEL_ARTICLES = "CHANNEL_ARTICLES", // Target artikel terbit spesifik per kategori/kanal

  // ─── Metrik Bisnis & Komersial (Global) ───────────────────────────
  AD_CLICKS_MIN = "AD_CLICKS_MIN", // Target klik iklan komersial minimum (KPI AE)
}

/**
 * Enum untuk Batasan Cakupan Target KPI Bulanan.
 * GLOBAL: Berlaku makro untuk seluruh situs.
 * CHANNEL: Berlaku mikro untuk satu kategori/desk tertentu.
 */
export enum TargetScopeType {
  GLOBAL = "GLOBAL",
  CHANNEL = "CHANNEL",
}

/**
 * Interface representasi dokumen target bulanan di MongoDB (koleksi `monthly_targets`).
 */
export interface MonthlyTarget {
  _id?: string | ObjectId;
  key: MonthlyTargetKey;
  value: number;
  period: string; // Format: "YYYY-MM" (contoh: "2026-06")
  scopeType: TargetScopeType;

  // hanya terisi ketika scopeType === TargetScopeType.CHANNEL
  category?: {
    _id: string | ObjectId;
    name: string;
    slug: string;
  };

  createdAt: Date;
  updatedAt: Date;
}