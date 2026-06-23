import { Db, ObjectId } from "mongodb";
import { MonthlyTargetKey, TargetScopeType } from "@/types/monthlyTarget";
import logger from "@/lib/logger";

/** Nama koleksi MongoDB untuk target bulanan. */
const COLLECTION = "monthly_targets";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Representasi satu item target dalam payload upsert dari frontend.
 * Nilai SLA dikirim dalam satuan jam (desimal), backend mengonversinya ke menit.
 */
export interface UpsertTargetItem {
  key: MonthlyTargetKey;
  /** Nilai mentah: bisa berupa angka biasa atau jam (khusus SLA). Kosong string berarti hapus. */
  value: string;
  scopeType: TargetScopeType;
  /** Hanya wajib diisi jika scopeType === CHANNEL */
  categoryId?: string;
}

/**
 * Representasi dokumen yang dikembalikan ke frontend.
 * Nilai SLA sudah dalam menit (integer).
 */
export interface SerializedTarget {
  _id: string;
  key: MonthlyTargetKey;
  /** Nilai dalam unit asli masing-masing key (SLA sudah dalam menit). */
  value: number;
  period: string;
  scopeType: TargetScopeType;
  category?: {
    _id: string;
    name: string;
    slug: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validasi format periode "YYYY-MM".
 * @throws Error jika format tidak valid.
 */
function validatePeriod(period: string): void {
  const periodRegex = /^\d{4}-(0[1-9]|1[0-2])$/;
  if (!periodRegex.test(period)) {
    const err: any = new Error(
      `Format periode tidak valid: "${period}". Gunakan format YYYY-MM (contoh: "2026-06").`,
    );
    err.status = 400;
    throw err;
  }
}

/**
 * Konversi jam (desimal) ke menit (dibulatkan ke menit terdekat).
 * Contoh: 1.5 jam → 90 menit; 0.75 jam → 45 menit.
 */
function hoursToMinutes(hours: number): number {
  return Math.round(hours * 60);
}

/**
 * Konversi nilai mentah string ke angka yang valid untuk disimpan.
 * Untuk key SLA, konversi jam → menit.
 * Mengembalikan null jika string kosong atau bukan angka yang valid.
 */
function parseAndConvertValue(
  key: MonthlyTargetKey,
  rawValue: string,
): number | null {
  const trimmed = rawValue.trim();

  // String kosong berarti target tidak diset (akan dihapus dari DB)
  if (!trimmed) return null;

  const numeric = parseFloat(trimmed);

  // Validasi: harus angka yang finite dan non-negatif
  if (!isFinite(numeric) || isNaN(numeric) || numeric < 0) {
    return null;
  }

  // Khusus key SLA: input dalam jam, simpan dalam menit
  if (key === MonthlyTargetKey.PROCESSING_TIME_SLA_MINUTES) {
    return hoursToMinutes(numeric);
  }

  // Untuk persentase: batas 0–100
  if (key === MonthlyTargetKey.REVISION_RATE_MAX) {
    if (numeric > 100) {
      const err: any = new Error(
        `Nilai REVISION_RATE_MAX tidak boleh melebihi 100%. Diterima: ${numeric}.`,
      );
      err.status = 400;
      throw err;
    }
    return Math.round(numeric * 100) / 100; // bulatkan ke 2 desimal
  }

  // Untuk key lainnya: bulatkan ke integer
  return Math.round(numeric);
}

/**
 * Serialisasi satu dokumen MongoDB ke format response API.
 */
function serializeTarget(doc: Record<string, any>): SerializedTarget {
  const serialized: SerializedTarget = {
    _id: String(doc._id),
    key: doc.key as MonthlyTargetKey,
    value: doc.value as number,
    period: doc.period as string,
    scopeType: doc.scopeType as TargetScopeType,
    createdAt: doc.createdAt instanceof Date ? doc.createdAt : new Date(doc.createdAt),
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt : new Date(doc.updatedAt),
  };

  // Tambahkan data kategori hanya jika scopeType CHANNEL
  if (doc.scopeType === TargetScopeType.CHANNEL && doc.category) {
    serialized.category = {
      _id: String(doc.category._id),
      name: String(doc.category.name),
      slug: String(doc.category.slug),
    };
  }

  return serialized;
}

// ─────────────────────────────────────────────────────────────────────────────
// Service Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ambil seluruh dokumen target bulanan untuk satu periode.
 *
 * @param db    - Instance Db dari MongoDB.
 * @param period - String periode dalam format "YYYY-MM".
 * @returns Array dokumen target yang telah diserialisasi.
 */
export async function getMonthlyTargets(
  db: Db,
  period: string,
): Promise<SerializedTarget[]> {
  logger.info({ period }, "getMonthlyTargets dimulai");

  try {
    validatePeriod(period);

    const col = db.collection(COLLECTION);
    const docs = await col
      .find({ period })
      .sort({ scopeType: 1, key: 1 })
      .toArray();

    const result = docs.map((doc) =>
      serializeTarget(doc as Record<string, any>),
    );

    logger.info({ period, count: result.length }, "getMonthlyTargets selesai");
    return result;
  } catch (err) {
    logger.error({ err, period }, "getMonthlyTargets gagal");
    throw err;
  }
}

/**
 * Simpan (upsert) batch target bulanan secara bulk.
 * - Dokumen dengan nilai valid akan di-upsert (create/update).
 * - Dokumen dengan nilai kosong atau tidak valid akan dihapus dari DB.
 * - Filter unik: kombinasi (period + key + scopeType + categoryId).
 *
 * @param db      - Instance Db dari MongoDB.
 * @param period  - String periode dalam format "YYYY-MM".
 * @param items   - Array item target yang akan disimpan.
 * @returns Objek ringkasan hasil operasi.
 */
export async function bulkUpsertMonthlyTargets(
  db: Db,
  period: string,
  items: UpsertTargetItem[],
): Promise<{ upserted: number; deleted: number; skipped: number }> {
  logger.info({ period, count: items.length }, "bulkUpsertMonthlyTargets dimulai");

  try {
    validatePeriod(period);

    // Validasi bahwa items adalah array
    if (!Array.isArray(items) || items.length === 0) {
      const err: any = new Error("Payload items harus berupa array yang tidak kosong.");
      err.status = 400;
      throw err;
    }

    const col = db.collection(COLLECTION);
    const now = new Date();

    let upsertedCount = 0;
    let deletedCount = 0;
    let skippedCount = 0;

    // Proses setiap item satu per satu (bisa dioptimalkan dengan bulkWrite)
    const bulkOps: any[] = [];
    const deleteFilters: any[] = [];

    for (const item of items) {
      // Validasi key
      const validKeys = Object.values(MonthlyTargetKey) as string[];
      if (!validKeys.includes(item.key)) {
        logger.warn({ key: item.key }, "Key tidak dikenal, dilewati");
        skippedCount++;
        continue;
      }

      // Validasi scopeType
      const validScopes = Object.values(TargetScopeType) as string[];
      if (!validScopes.includes(item.scopeType)) {
        logger.warn({ scopeType: item.scopeType }, "ScopeType tidak valid, dilewati");
        skippedCount++;
        continue;
      }

      // Bangun filter unik untuk dokumen ini
      const filter: Record<string, any> = {
        period,
        key: item.key,
        scopeType: item.scopeType,
      };

      let categoryDoc = null;

      // Untuk target Channel: wajib ada categoryId yang valid
      if (item.scopeType === TargetScopeType.CHANNEL) {
        if (!item.categoryId) {
          logger.warn(
            { key: item.key },
            "Channel target tanpa categoryId, dilewati",
          );
          skippedCount++;
          continue;
        }

        // Cari kategori asli dari database secara dinamis
        if (ObjectId.isValid(item.categoryId)) {
          categoryDoc = await db.collection("categories").findOne({
            _id: new ObjectId(item.categoryId),
          });
        } else {
          // Fallback: cari menggunakan slug (misal "cat_news" -> slug "news")
          const slug = item.categoryId.startsWith("cat_")
            ? item.categoryId.substring(4)
            : item.categoryId;
          categoryDoc = await db.collection("categories").findOne({ slug });
        }

        if (!categoryDoc) {
          logger.warn(
            { key: item.key, categoryId: item.categoryId },
            "Kategori tidak ditemukan di database, dilewati",
          );
          skippedCount++;
          continue;
        }

        filter["category._id"] = categoryDoc._id;
      }

      // Parse dan konversi nilai
      let parsedValue: number | null;
      try {
        parsedValue = parseAndConvertValue(item.key, item.value);
      } catch (parseErr: any) {
        // Error validasi bisnis (misalnya persentase > 100%)
        throw parseErr;
      }

      if (parsedValue === null) {
        // Nilai kosong/tidak valid → hapus dokumen dari DB jika ada
        deleteFilters.push(filter);
        deletedCount++;
      } else {
        // Nilai valid → upsert
        const setFields: Record<string, any> = {
          value: parsedValue,
          updatedAt: now,
        };

        // Jika target berskala CHANNEL, lakukan denormalisasi informasi kategori lengkap
        if (item.scopeType === TargetScopeType.CHANNEL && categoryDoc) {
          setFields.category = {
            _id: categoryDoc._id,
            name: categoryDoc.name,
            slug: categoryDoc.slug,
          };
        }

        bulkOps.push({
          updateOne: {
            filter,
            update: {
              $set: setFields,
              $setOnInsert: {
                createdAt: now,
              },
            },
            upsert: true,
          },
        });
        upsertedCount++;
      }
    }

    // Eksekusi upsert dalam satu batch bulkWrite (lebih efisien dari loop)
    if (bulkOps.length > 0) {
      await col.bulkWrite(bulkOps, { ordered: false });
    }

    // Eksekusi delete satu per satu (jumlah biasanya sedikit)
    for (const deleteFilter of deleteFilters) {
      await col.deleteOne(deleteFilter);
    }

    logger.info(
      { period, upsertedCount, deletedCount, skippedCount },
      "bulkUpsertMonthlyTargets selesai",
    );

    return {
      upserted: upsertedCount,
      deleted: deletedCount,
      skipped: skippedCount,
    };
  } catch (err) {
    logger.error({ err, period }, "bulkUpsertMonthlyTargets gagal");
    throw err;
  }
}
