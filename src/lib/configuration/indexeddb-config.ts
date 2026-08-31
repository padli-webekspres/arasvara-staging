/**
 * IndexedDB helper for storing configuration media files (like hero video).
 * Prevents unnecessary uploads and allows offline draft saving.
 *
 * CATATAN: File ini menggunakan DB yang sama ("arasvara-draft-images") dengan
 * draftImageDb.ts. Pengelolaan versi dan pembuatan store dilakukan di sana
 * secara terpusat agar tidak ada konflik versi antar modul.
 */

import { openDraftImageDb } from "@/lib/db/draftImageDb";
import {
  requestDraftStoragePersist,
  warnDraftStorageFailed,
} from "@/lib/image/draftImageStorage";

const STORE_NAME = process.env.STORE_CONFIG_MEDIA || "configuration-media";

// ── Type ──────────────────────────────────────────────────────────────────

interface StoredConfigMedia {
  key: string;
  file: Blob;
  mimeType: string;
  timestamp: number;
}

// ── Save Video to IndexedDB ───────────────────────────────────────────────

/**
 * Simpan file video/media ke IndexedDB (store configuration-media).
 * Gagal (private mode / quota) di-toast sekali; blob di memori tetap dipakai.
 */
export async function saveVideoToIndexedDB(
  key: string,
  file: Blob,
  mimeType: string,
): Promise<void> {
  if (typeof window === "undefined") return;
  if (!window.indexedDB) {
    warnDraftStorageFailed();
    return;
  }
  try {
    await requestDraftStoragePersist();
    const db = await openDraftImageDb();
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    const data: StoredConfigMedia = {
      key,
      file,
      mimeType,
      timestamp: Date.now(),
    };

    const request = store.put(data);

    return new Promise((resolve) => {
      request.onsuccess = () => resolve();
      request.onerror = () => {
        warnDraftStorageFailed();
        resolve();
      };
    });
  } catch {
    warnDraftStorageFailed();
  }
}

// ── Get Video from IndexedDB ──────────────────────────────────────────────

/**
 * Ambil file video/media dari IndexedDB.
 * Kembalikan null jika tidak ditemukan atau terjadi error.
 */
export async function getVideoFromIndexedDB(
  key: string,
): Promise<{ file: Blob; mimeType: string } | null> {
  if (typeof window === "undefined" || !window.indexedDB) return null;
  try {
    const db = await openDraftImageDb();
    const transaction = db.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(key);

    return new Promise((resolve) => {
      request.onsuccess = () => {
        const data = request.result as StoredConfigMedia | undefined;
        resolve(data ? { file: data.file, mimeType: data.mimeType } : null);
      };
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

// ── Remove Video from IndexedDB ───────────────────────────────────────────

/**
 * Hapus satu file dari IndexedDB.
 * Jika IndexedDB tidak tersedia, fungsi ini diam-diam di-skip.
 */
export async function removeVideoFromIndexedDB(key: string): Promise<void> {
  if (typeof window === "undefined" || !window.indexedDB) return;
  try {
    const db = await openDraftImageDb();
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(key);

    return new Promise((resolve) => {
      request.onsuccess = () => resolve();
      request.onerror = () => resolve(); // Silently skip
    });
  } catch {
    // Silently skip
  }
}

// ── Clear All Configuration Media ────────────────────────────────────────

/**
 * Hapus semua configuration media dari IndexedDB.
 * Jika IndexedDB tidak tersedia, fungsi ini diam-diam di-skip.
 */
export async function clearAllConfigMedia(): Promise<void> {
  if (typeof window === "undefined" || !window.indexedDB) return;
  try {
    const db = await openDraftImageDb();
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    return new Promise((resolve) => {
      request.onsuccess = () => resolve();
      request.onerror = () => resolve(); // Silently skip
    });
  } catch {
    // Silently skip
  }
}
