import { get as idbGet, set as idbSet } from "idb-keyval";
import { toast } from "sonner";

let persistRequested = false;
let didWarn = false;

const DRAFT_FAIL_MESSAGE =
  "Draft gambar tidak tersimpan di perangkat ini (mode privat atau penyimpanan penuh). Simpan segera sebelum menutup tab.";

/** Minta storage persisten sekali per tab. Safari sering mengabaikan tanpa prompt. */
export async function requestDraftStoragePersist(): Promise<void> {
  if (persistRequested || typeof navigator === "undefined") return;
  persistRequested = true;
  try {
    await navigator.storage?.persist?.();
  } catch {
    // abaikan
  }
}

/** Toast sekali per sesi — autosave iklan tidak boleh spam. */
export function warnDraftStorageFailed(): void {
  if (didWarn) return;
  didWarn = true;
  toast.error(DRAFT_FAIL_MESSAGE);
}

/** idb-keyval set + persist. Gagal tidak melempar — blob di memori tetap dipakai. */
export async function setDraftImage(key: string, value: Blob): Promise<void> {
  await requestDraftStoragePersist();
  try {
    await idbSet(key, value);
  } catch {
    warnDraftStorageFailed();
  }
}

/** Baca draft dari IDB; jika kosong/gagal, pakai blob di memori. */
export async function resolveDraftImage(
  key: string,
  fallback?: Blob | null,
): Promise<Blob | undefined> {
  try {
    const stored = await idbGet<Blob>(key);
    if (stored && stored.size > 0) return stored;
  } catch {
    // IDB unreadable (private / eviction)
  }
  if (fallback && fallback.size > 0) return fallback;
  return undefined;
}

/** Ambil bytes dari object URL blob: — cadangan jika IDB kosong tapi preview masih hidup. */
export async function blobFromPreviewUrl(
  url: string | undefined | null,
): Promise<Blob | undefined> {
  if (!url || !url.startsWith("blob:")) return undefined;
  try {
    const blob = await (await fetch(url)).blob();
    return blob.size > 0 ? blob : undefined;
  } catch {
    return undefined;
  }
}
