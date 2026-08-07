# Issue: Kegagalan Upload Gambar di `/admin-xyz/articles/new/gallery` (Khusus iPad Safari)

**Tanggal**: 3 Agustus 2026
**Device**: iPad (Safari/iOS) — Android tab normal
**Gejala**: Upload sering gagal, "kadang tidak tersimpan", dan masalah lain terkait upload. Hanya terjadi di iPad.

---

## 1. Alur Upload Galeri (yang perlu dipahami dulu)

Di halaman `/admin-xyz/articles/new/gallery` (format `GALLERY`), alur upload gambar lewat `ImagePickerModal` → tab **Upload**:

1. **Pilih file** → `DraftImageUploadForm.onDrop`
   → `prepareImageForCrop(file)` — decode `createImageBitmap` → downscale ≤ 2560px → blob JPEG; fallback probe `<img>`.
2. **Crop** → `CropImageModal` → `getCroppedImg(imageSrc, naturalCrop, { outputWidth: 1920, outputHeight: 1080 })` — gambar di-draw ke canvas 1920×1080, ekspor via `canvas.toBlob` (WebP jika `checkWebpSupport()`, else JPEG), dengan beberapa percobaan skala/kualitas.
3. **Metadata + simpan** → `DraftImageUploadForm.onSubmitMetadata`
   → (opsional) `embedWatermarkToImage` → `ensureWebpFile(blob)` (cek magic bytes; jika bukan WebP valid → `compressImageFile` via **Pica** + binary search kualitas) → **`saveEditorImage(idbKey, file)` ke IndexedDB** → `PendingMedia` (blobUrl + idbKey).
4. **Autosave draft** → JSON draft (termasuk referensi `idbKey` gambar) ditulis ke **localStorage**.
5. **Submit** → `uploadAllPendingMedia()` → untuk tiap item pending:
   - `getEditorImage(idbKey)` baca blob dari **IndexedDB**
   - `POST /media/presigned-url` → `axios.put(uploadUrl, blob)` langsung ke S3/MinIO
   - `POST /media/finalize` → server `ensurePresignedUploadIsWebp` (audit & re-encode Sharp ke WebP jika perlu)
   - lalu `POST /articles`.

**File kunci**: `src/components/admin/articles/ArticleEditorForm.tsx`, `src/components/ui/ImagePickerModal.tsx`, `src/components/media/DraftImageUploadForm.tsx`, `src/components/media/CropImageModal.tsx`, `src/lib/image/{prepareImageForCrop,getCroppedImg,compressImage,ensureWebpBlob,detectImageFormat,embedWatermark}.ts`, `src/lib/db/draftImageDb.ts`, `src/services/mediaService.ts`, `src/app/api/media/{presigned-url,finalize}/route.ts`.

---

## 2. Hipotesis Akar Masalah (diurutkan berdasarkan kemungkinan)

### H1. HEIC/HEIF dari kamera iPad — _"sering gagal upload"_

- Kamera iPad/iOS default menyimpan **HEIC**. `detectImageFormat()` hanya mengenali WebP/PNG/JPEG → HEIC dianggap **"unknown"** → `ensureWebpFile` meneruskan ke re-kompresi Pica → `loadImageFromFile` (`new Image()` + object URL).
- Safari iOS **bisa** decode HEIC di `<img>`, tapi **tidak stabil** untuk varian tertentu (Live Photos, depth map, foto resolusi tinggi) dan `createImageBitmap(HEIC)` di Safari **tidak andal**. `prepareImageForCrop` sudah punya fallback, tapi fallback-nya sama-sama rawan → error "Gambar tidak dapat dimuat" / "Failed to load image" → upload batal.
- Android menangani HEIC lebih baik (kodek lengkap), menjelaskan kenapa Android aman.

### H2. IndexedDB iOS Safari tidak andal — _"kadang tidak tersimpan"_

- Semua blob gambar disimpan ke **IndexedDB** (`draftImageDb.ts`) sampai submit. Di iPad Safari:
  - **Penulisan gagal**: quota penuh, storage pressure, atau bug IndexedDB di versi iOS tertentu (laporan bug iOS 17.4/18.x) → `saveEditorImage` reject → toast "Gagal memproses gambar" → gambar tidak pernah masuk galeri.
  - **Eviction senyap**: saat storage iPad penuh, Safari menghapus data IndexedDB tanpa aba-aba → saat submit, `getEditorImage(idbKey)` mengembalikan `undefined` → throw **"Blob tidak ditemukan di IndexedDB untuk key: ..."** → seluruh submit gagal → artikel tidak tersimpan.
  - **Private Browsing**: IndexedDB bersifat sementara → reload = blob hilang, draft (localStorage) tersisa → muncul toast "N foto draft tidak ditemukan".
- Ketidakseimbangan ini (draft di localStorage, blob di IDB) memperparah: draft bisa ada tapi gambar-gambarnya sudah hilang.

### H3. Tekanan memori → tab Safari di-relaunch iOS — memperparah H1 & H2

- Satu galeri bisa berisi sampai **20 gambar**. Tiap gambar melalui: decode `createImageBitmap` full-res (12MP+) + beberapa `canvas.toBlob` (crop + binary search kualitas Pica) + Web Worker Pica + banyak blob URL yang dipegang state.
- iPad Safari sangat agresif membunuh tab saat memory pressure → **"Page Reloaded Because of an Issue"** → semua state hilang → "kadang tidak tersimpan" / "kadang gagal" yang **intermittent** (tergantung jumlah & resolusi foto).

### H4. Batas dimensi canvas WebKit iOS — untuk foto resolusi tinggi

- WebKit iOS membatasi area canvas (secara historis ±4096×4096 ≈ 16,7 juta piksel; lebih besar pada device baru tetapi tetap ada batas, plus beban memori RGBA ~4 byte/piksel).
- Foto iPad 12MP (4032×3024) **tepat di bawah** batas → "kadang" sukses. Foto iPhone 48MP (8064×6048) atau panorama dengan mudah **melampaui** → `canvas.width = ...` di-clamp/blank, `drawImage`/`toBlob` menghasilkan gambar rusak/putih, atau crash.
- Titik rawan: `getCroppedImg` (jika fallback memakai file asli, bukan hasil downscale), `embedWatermarkToImage` (membuat canvas ukuran natural gambar), dan Pica (membuat canvas internal ukuran natural sumber).

### H5. Submit all-or-nothing tanpa retry — memperbesar dampak kegagalan apa pun

- `uploadAllPendingMedia()` di `ArticleEditorForm.tsx` meng-upload **berurutan**; kegagalan pertama langsung **menghentikan semua** dan meng-rollback file yang sudah terupload. Tidak ada retry per gambar.
- Di iPad dengan Wi-Fi tidak stabil / koneksi seluler lambat, satu dari 20 PUT gagal = seluruh submit gagal → "kadang tidak tersimpan".

### H6. Sisi server / network (probabilitas lebih rendah sebagai pembeda)

- `PUT` ke S3/MinIO membawa header kustom `Cache-Control` + `Content-Type` → **CORS preflight**; jika preflight MinIO/R2 salah konfigurasi, PUT gagal — tapi ini juga akan kena Android, jadi kecil kemungkinan jadi pembeda utama.
- `registerPresignedMedia` server **meng-audit & re-encode** objek; jika Safari berhasil menyimpan file terpotong/rusak (akibat File-type loss atau PUT gagal yang tak terdeteksi), hasil re-encode bisa rusak → "masalah lain terkait upload" (media row ada tapi gambar broken).

---

## 3. Analisis Kode — Poin Rawan Spesifik

| Lokasi                                          | Masalah potensial                                                                                                                                    |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prepareImageForCrop.ts`                        | `createImageBitmap(file)` decode full-res 12–48MP di iPad → rawan gagal/memori; fallback `<img>` untuk HEIC intermittent                             |
| `getCroppedImg.ts`                              | `new Image()` + `drawImage` sumber full-res (jika fallback) → batas canvas iOS; `canvas.toBlob` bisa return `null` pada beberapa kasus               |
| `compressImage.ts` (Pica)                       | `pica.resize(img, canvas)` membuat canvas ukuran natural sumber di internal Pica → clamp/blank jika > batas iOS; loop `toBlob` berkali-kali → memori |
| `ensureWebpBlob.ts`                             | HEIC = "unknown" → jalur re-kompresi penuh (berat) tanpa jalur khusus HEIC                                                                           |
| `embedWatermark.ts`                             | canvas ukuran natural gambar sumber                                                                                                                  |
| `draftImageDb.ts`                               | IndexedDB: tidak ada retry, tidak ada `navigator.storage.persist()`, tidak ada deteksi eviction                                                      |
| `ArticleEditorForm.tsx` `uploadAllPendingMedia` | Sequential, all-or-nothing, tanpa retry; `getEditorImage` miss → throw                                                                               |
| `axios.ts`                                      | Timeout global 10 detik (dioverride 60s di upload), interceptor refresh 401 — ok, tapi PUT tidak punya retry                                         |
| `ImagePickerModal.tsx`                          | Multi-select upload masih lewat atribusi per gambar + `prepareImageForCrop`; 20 gambar = beban memori kumulatif                                      |

**Catatan riwayat fix sebelumnya** (masih belum menutup kasus galeri):

- `a535fb8 fix(image): dukung dynamic format fallback jpeg untuk safari ios`
- `c58ebda fix(media): perbaiki crop preview di mobile`
- `be1f39f fix(cms): perbaiki upload apple dan alur publish` (hardening HEIC/MIME/FormData — terutama di `VideoSocmedForm` & `MediaUploadForm`, **bukan** jalur galeri `ArticleEditorForm`+`ImagePickerModal`)
- `b1e1cfa fix(socmed): harden admin untuk safari apple`

Artinya: fix Apple sebelumnya menyasar halaman media/socmed, sedangkan jalur **gallery di ArticleEditorForm** masih memakai rantai proses yang sama dan tetap rapuh.

---

## 4. Rekomendasi Solusi Terpadu (Server-Side Offloading & Temp Storage)

### Prioritas 1 — Pemindahan Pemrosesan Gambar ke Server (Server-Side Offloading)
- **Konversi WebP di Server (Sangat Aman & Direkomendasikan):** 
  - Mengubah konversi WebP, kompresi multi-pass, dan *watermarking* dari client-side JavaScript/Pica ke **Server (Node.js + Sharp / libvips)**.
  - **Mengapa Aman?** Engine `Sharp` di server beroperasi di lingkungan Native C++ yang sangat cepat, efisien RAM, dan tidak memiliki batasan canvas/WebKit seperti browser iPad Safari. Server dapat mengkonversi HEIC/JPEG/PNG ke WebP secara konsisten tanpa risiko *tab relaunch/crash*.
- **Client iPad Hanya Melakukan Task Ringan:**
  - Browser iPad hanya menangani pemisahan/crop area sederhana. Tidak ada lagi loop kompresi Pica atau *binary search quality* di client-side.

### Prioritas 2 — Eliminasi IndexedDB & Model Instant Upload ke `/temp` Storage
- **Hapus Ketergantungan IndexedDB:** 
  - Blob gambar tidak lagi disimpan di IndexedDB iPad yang rawan di-*evict* oleh Safari.
- **Alur Upload ke Folder `/temp`:**
  1. Saat user klik *"Gunakan Gambar Ini"* di modal, gambar langsung di-upload ke direktori temporary di S3/MinIO (`arasvara-images/temp/{temp_media_id}.webp`).
  2. Response mengembalikan `tempMediaId` dan `tempUrl` untuk preview langsung di editor galeri.
  3. Saat artikel dipublish/disimpan (`POST /articles`), server **mempromosikan/memindahkan** file dari `/temp/` ke direktori utama (`arasvara-images/`) dan menyimpan metadata final ke database.

### Prioritas 3 — Endpoint & Panduan Scheduler (Cleanup Temp Storage)
- **Mekanisme Cleanup (Garbage Collection):**
  - Untuk membersihkan gambar di `/temp` yang dibatalkan user atau tidak pernah di-submit > 24 jam.
- **Endpoint Baru:** `POST /api/media/cleanup-temp`
  - Proteksi: Memerlukan header `x-scheduler-secret: ${SCHEDULER_SECRET}` (sama dengan `/api/publish-scheduled`).
  - Logika: Mencari objek di storage `/temp/` yang berusia > 24 jam dan menghapusnya.
- **Panduan Setup Scheduler (Docker Compose / Cron):**
  - **Di `docker-compose.yml` (Container Scheduler):**
    ```yaml
    scheduler:
      image: curlimages/curl:latest
      container_name: arasvara_scheduler
      command:
        [
          "sh",
          "-c",
          'while true; do curl -X POST -H "x-scheduler-secret: ${SCHEDULER_SECRET}" http://host.docker.internal:3000/api/media/cleanup-temp; sleep 3600; done',
        ]
    ```
  - **Di Server Cron / Railway Cron (Produksi):**
    Jalankan cron job tiap jam / 6 jam sekali:
    `0 */6 * * * curl -X POST -H "x-scheduler-secret: SuperSecretKey" https://domain-anda.com/api/media/cleanup-temp`

### Prioritas 4 — Normalisasi HEIC & Guard Canvas Ringan di Client
- Untuk file `.heic` dari iPad: Browser iPad hanya melakukan normalisasi awal atau langsung mengirim file ke server `POST /api/media/process-temp` agar server yang mendekode HEIC & mengompresnya ke WebP.

---

## 5. Langkah Verifikasi di Device (untuk mengonfirmasi hipotesis)

1. **Tes HEIC**: upload foto HEIC langsung dari kamera iPad vs foto JPEG → pastikan server sukses mengonversi ke WebP.
2. **Tes Private Browsing iPad**: pastikan draft dan preview tetap bekerja karena `tempUrl` diambil dari server, bukan IndexedDB lokal.
3. **Tes foto resolusi tinggi** (48MP/panorama): pastikan iPad tidak *reload/crash* karena kompresi dilakukan di server.
4. **Tes Scheduler Cleanup**: upload gambar ke `/temp`, jalankan endpoint `POST /api/media/cleanup-temp` dengan secret, pastikan file temp lama terhapus dari MinIO/S3.

---

## 6. Ringkasan Solusi

| Gejala | Hipotesis utama | Solusi Utama (Arsitektur Baru) |
|---|---|---|
| "Sering gagal upload" | HEIC & Canvas iPad limit (H1, H4) | Offload konversi HEIC & WebP ke Server (Sharp). Client hanya kirim file/crop ringan. |
| "Kadang tidak tersimpan" | IndexedDB iOS di-evict / memory pressure (H2, H3) | Hapus IndexedDB. Gunakan Instant Upload ke `/temp` S3/MinIO. Promosikan saat Submit. |
| "Risiko Temp Storage Penuh" | Unattached draft media di `/temp` | Buat endpoint `/api/media/cleanup-temp` + Scheduler Cron (Docker/Railway) hapus file >24 jam. |
| "Submit gagal total" | All-or-nothing submit (H5) | Submit artikel hanya mengirim array `mediaId` (tanpa payload blob besar). |

