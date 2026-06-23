/**
 * draftImageDb.js
 * Helper untuk menyimpan dan mengambil file gambar draft artikel ke/dari IndexedDB.
 * Menggunakan native IndexedDB API (tidak perlu library tambahan).
 */

const dbName = process.env.INDEX_DB_NAME || "arasvara-draft-images";
// Versi 2: menambah store "configuration-media" yang sebelumnya dikelola
// terpisah oleh indexeddb-config.ts dengan versi 1 yang sama — konflik ini
// menyebabkan error "object store not found" pada salah satu store.
// Aturan: jika DB_VERSION di .env belum diubah ke 2, fallback ini memaksa v2.
const dbVersion = Math.max(Number(process.env.DB_VERSION) || 1, 2);
const storeFeatured = process.env.STORE_FEATURED || "featured-image";
const storeEditor = process.env.STORE_EDITOR || "editor-images";
const storeConfig = process.env.STORE_CONFIG_MEDIA || "configuration-media";

/**
 * Buka (atau buat) IndexedDB.
 * Di-export agar modul lain (mis. indexeddb-config.ts) bisa menggunakan
 * instance DB yang sama tanpa membuka koneksi terpisah.
 * @returns {Promise<IDBDatabase>}
 */
export function openDraftImageDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined")
      return reject(new Error("Not in browser"));
    const request = indexedDB.open(dbName, dbVersion);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBRequest).result as IDBDatabase;
      // Buat semua store jika belum ada (idempotent — aman untuk upgrade)
      if (!db.objectStoreNames.contains(storeFeatured)) {
        db.createObjectStore(storeFeatured);
      }
      if (!db.objectStoreNames.contains(storeEditor)) {
        db.createObjectStore(storeEditor);
      }
      if (!db.objectStoreNames.contains(storeConfig)) {
        // configuration-media menggunakan keyPath "key" (lihat indexeddb-config.ts)
        db.createObjectStore(storeConfig, { keyPath: "key" });
      }
    };
    request.onsuccess = (event) =>
      resolve((event.target as IDBRequest).result as IDBDatabase);
    request.onerror = (event) => reject((event.target as IDBRequest).error);
  });
}

/**
 * Simpan featured image ke IndexedDB
 * @param {File} file
 */
export async function saveFeaturedImage(file: File): Promise<void> {
  const db = await openDraftImageDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeFeatured, "readwrite");
    const req = tx.objectStore(storeFeatured).put(file, "featured");
    req.onsuccess = () => resolve();
    req.onerror = (e) => reject((e.target as IDBRequest).error);
  });
}

/**
 * Ambil featured image dari IndexedDB
 * @returns {Promise<File|undefined>}
 */
export async function getFeaturedImage(): Promise<File | undefined> {
  const db = await openDraftImageDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeFeatured, "readonly");
    const req = tx.objectStore(storeFeatured).get("featured");
    req.onsuccess = (e) =>
      resolve((e.target as IDBRequest).result as File | undefined);
    req.onerror = (e) => reject((e.target as IDBRequest).error);
  });
}

/**
 * Hapus featured image dari IndexedDB
 */
export async function deleteFeaturedImage(): Promise<void> {
  const db = await openDraftImageDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeFeatured, "readwrite");
    const req = tx.objectStore(storeFeatured).delete("featured");
    req.onsuccess = () => resolve();
    req.onerror = (e) => reject((e.target as IDBRequest).error);
  });
}

/**
 * Simpan editor image ke IndexedDB
 * @param {string} key - unik key (misal: "img-<uuid>")
 * @param {File} file
 */
export async function saveEditorImage(
  key: string,
  file: File | Blob,
): Promise<void> {
  const db = await openDraftImageDb();
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (run: () => void) => {
      if (settled) return;
      settled = true;
      run();
    };

    const tx = db.transaction(storeEditor, "readwrite");
    const req = tx.objectStore(storeEditor).put(file, key);

    req.onerror = () => {
      finish(() =>
        reject(req.error ?? new Error("IndexedDB gagal menyimpan gambar")),
      );
    };
    tx.onerror = () => {
      finish(() =>
        reject(tx.error ?? new Error("Transaksi IndexedDB gagal")),
      );
    };
    tx.onabort = () => {
      finish(() =>
        reject(tx.error ?? new Error("Transaksi IndexedDB dibatalkan")),
      );
    };
    tx.oncomplete = () => {
      finish(() => resolve());
    };
  });
}

/**
 * Ambil editor image dari IndexedDB
 * @param {string} key
 * @returns {Promise<File|undefined>}
 */
export async function getEditorImage(key: string): Promise<File | undefined> {
  const db = await openDraftImageDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeEditor, "readonly");
    const req = tx.objectStore(storeEditor).get(key);
    req.onsuccess = (e) =>
      resolve((e.target as IDBRequest).result as File | undefined);
    req.onerror = (e) => reject((e.target as IDBRequest).error);
  });
}

/**
 * Hapus satu editor image dari IndexedDB
 * @param {string} key
 */
export async function deleteEditorImage(key: string): Promise<void> {
  const db = await openDraftImageDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeEditor, "readwrite");
    const req = tx.objectStore(storeEditor).delete(key);
    req.onsuccess = () => resolve();
    req.onerror = (e) => reject((e.target as IDBRequest).error);
  });
}

/**
 * Hapus semua editor images dari IndexedDB
 */
export async function clearAllEditorImages(): Promise<void> {
  const db = await openDraftImageDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeEditor, "readwrite");
    const req = tx.objectStore(storeEditor).clear();
    req.onsuccess = () => resolve();
    req.onerror = (e) => reject((e.target as IDBRequest).error);
  });
}

/**
 * Hapus semua draft images (featured + editor) dari IndexedDB
 * Dipanggil saat clear draft atau setelah publish sukses
 */
export async function clearAllDraftImages(): Promise<void> {
  await deleteFeaturedImage().catch(() => {});
  await clearAllEditorImages().catch(() => {});
}
