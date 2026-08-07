# Audit Platform CMS — iOS / iPad / macOS (Safari / WebKit)

Tanggal audit: 2026-07-29  
Scope: CMS `admin-xyz` (bukan situs publik)  
Metode: review kode (read-only); tidak ada perubahan fitur  
Dokumen terkait: `memory/analysis/admin-socmed-apple-audit.md` (fokus halaman socmed)

## Ringkasan eksekutif

CMS Arasvara sudah punya **beberapa mitigasi Apple-aware** (HEIC/crop di jalur artikel, schedule WIB di form artikel, `100dvh` di socmed list, fallback WebP canvas). Namun ada risiko yang **sangat mungkin tidak terdeteksi** bila QA hanya di Chrome desktop Windows:

1. **Jadwal iklan (ads)** memakai `toISOString().slice` (UTC) untuk `datetime-local` — beda dari alur artikel yang sudah WIB-aware.
2. **Normalisasi HEIC / foto kamera iPhone** belum merata: `prepareImageForCrop` dipakai di draft artikel, tetapi **tidak** di media library, ads, sponsor, dan sebagian jalur socmed.
3. **Kontrol DnD / hapus berbasis hover** di gallery & section sort — hampir tidak discoverable di iPad.
4. **Modal crop + dialog fixed center** rentan bentrok keyboard Safari dan viewport dinamis.
5. **Chart dashboard** tooltip hover-only — detail chart sulit di iPad.

Tidak ditemukan indikasi “CMS selalu crash di Safari”, tetapi kombinasi di atas cukup untuk menghasilkan bug intermiten, jadwal salah, upload gagal, atau UX “tombol hilang” yang sulit direpro di Chrome.

## Yang sudah relatif aman

| Area | Lokasi | Catatan |
|------|--------|---------|
| HEIC + decode besar | `src/lib/image/prepareImageForCrop.ts` | Komentar eksplisit iOS/iPad; `createImageBitmap` → JPEG |
| Retry crop | `src/components/media/CropImageModal.tsx` | Remount + UX retry mobile |
| WebP canvas | `src/lib/image/detectImageFormat.ts` | Dokumen Safari iOS &lt; 17.2 |
| Schedule artikel WIB | `src/lib/datetime-jakarta.ts` + ArticleEditorForm | Wall-clock WIB → UTC benar |
| Socmed viewport | `VideoSocmedForm.tsx` | `100dvh` + `-webkit-overflow-scrolling: touch` |
| Handle DnD video | `VideoFormCard.tsx` | Sudah `touch-none` / `touchAction: none` |

---

## Temuan

### H1 — Tinggi: Ads `datetime-local` di-seed/parse sebagai UTC

**Lokasi**
- `src/components/admin/ads/AdsHomepageForm.tsx` (`nowLocalStr` / `monthLaterStr` via `toISOString().slice(0, 16)`)
- `src/components/admin/ads/AdsSIngleArticleForm.tsx` (pola sama)
- Hydrate di `src/app/admin-xyz/ads/homepage/page.tsx`, `single-article/page.tsx`

**Masalah**  
Nilai `datetime-local` diisi dari UTC ISO string, lalu dikirim sebagai string tanpa timezone. Form artikel sudah memakai helper WIB; form iklan tidak.

**Dampak Apple**  
Safari sering memparse string tanpa timezone secara inkonsisten. Editor di Mac/iPad melihat default waktu “aneh” vs intent WIB; jadwal iklan bisa bergeser beberapa jam tanpa terlihat di Chrome Windows jika zona lokal kebetulan mirip pola uji.

**Arah perbaikan**  
Samakan dengan `formatDatetimeLocalFromUtc` / `parseDatetimeLocalAsWib` (atau wall-clock lokal yang konsisten); jangan seed dengan `toISOString().slice`.

---

### H2 — Tinggi: `prepareImageForCrop` tidak dipakai di banyak jalur upload CMS

**Lokasi yang memakai**
- `DraftImageUploadForm.tsx` (jalur artikel)

**Lokasi yang belum**
- `MediaUploadForm.tsx` (library `/admin-xyz/media`)
- `AdsHomepageForm.tsx`, `AdsSIngleArticleForm.tsx`
- `SponsorForm.tsx`
- Sebagian jalur di `VideoSocmedForm.tsx` (raw `createObjectURL`)

**Masalah**  
Foto dari Photos app iPhone sering HEIC atau JPEG sangat besar. Tanpa normalisasi, `CropImageModal` menerima object URL mentah.

**Dampak Apple**  
Gagal decode intermiten, preview hitam/blank, crop “stuck”, atau tab Safari di-reload karena memory pressure — sulit direpro di Chrome desktop dengan JPEG kecil.

**Arah perbaikan**  
Semua entry crop CMS lewat `prepareImageForCrop`; toast jelas jika HEIC gagal; revoke URL hasil prepare.

---

### H3 — Tinggi: Kontrol gallery / section sort bergantung hover

**Lokasi**
- `GallerySorting.tsx` — handle/remove `opacity` + `group-hover`
- `SortableArticleCard.tsx`, `SortableSidebarArticleItem.tsx`
- Pola serupa di `SelectAndSort`

**Masalah**  
Handle drag dan tombol hapus hampir/terlihat hanya saat hover.

**Dampak Apple**  
iPad/iPhone tidak punya hover. User mengira fitur sort/hapus “hilang” atau hanya bisa pakai gesture yang salah.

**Arah perbaikan**  
Kontrol selalu terlihat di `pointer: coarse` / tanpa hover; target sentuh lebih besar; tetap `touch-action: none` pada handle.

---

### M1 — Sedang: Crop modal + dialog center vs keyboard Safari

**Lokasi**
- `CropImageModal.tsx` — tinggi crop fixed (~280/480px)
- `src/components/ui/dialog.tsx` — `fixed top-[50%] translate-y-[-50%]`

**Masalah**  
Tidak ada adaptasi `dvh`/`svh` atau `visualViewport` saat keyboard naik.

**Dampak Apple**  
Footer aksi crop terpotong; modal “loncat”; sulit konfirmasi crop di iPhone portrait.

**Arah perbaikan**  
Cap area crop dengan `min(..., 50dvh)`; dialog scrollable / top-anchored di viewport kecil.

---

### M2 — Sedang: Related articles DnD tanpa activation distance

**Lokasi**
- `ArticleEditorFormUi.tsx` — `PointerSensor` tanpa `activationConstraint`

**Masalah**  
Drag aktif segera pada pointer down; scroll vertikal list bentrok dengan DnD.

**Dampak Apple**  
Di iPad, scroll list related sering jadi “ikut drag”.

**Arah perbaikan**  
`activationConstraint: { distance: 8 }` atau drag hanya via handle.

---

### M3 — Sedang: Handle ads/sponsor kurang `touch-none`

**Lokasi**
- `AdsFormCard.tsx`, `SponsorFormCard.tsx` vs `VideoFormCard.tsx` (sudah benar)

**Masalah**  
Inkonsisten; Safari cenderung memprioritaskan scroll daripada drag.

**Arah perbaikan**  
Samakan pola `touch-none` + `touchAction: "none"` di semua handle sortable.

---

### M4 — Sedang: Chart dashboard tooltip hover-only

**Lokasi**
- `AEDashboard.tsx`, `WriterDashboard.tsx` (Chart.js + popover `onHover` / `onMouseLeave`)

**Masalah**  
Tooltip native dimatikan; detail hanya muncul on hover.

**Dampak Apple**  
Tap di iPad tidak setara hover; angka/detail chart tidak bisa dibaca.

**Arah perbaikan**  
Toggle on click/touch, atau aktifkan event `touchstart`/`click` di Chart.js.

---

### M5 — Sedang: Banyak panel masih `vh` / `h-screen`

**Lokasi**
- `SelectAndSort.tsx` (`lg:h-[80vh]`, `max-h-screen`)
- `VideoSocmedSorting.tsx`, `SponsorForm.tsx`
- Loading `h-screen` di beberapa form
- Sticky sidebar ads: `max-h-[calc(100vh-6rem)]`

**Masalah**  
`vh` di Safari mengabaikan chrome dinamis (toolbar URL).

**Dampak Apple**  
Konten terpotong di bawah; nested scroll + rubber-band saling ganggu.

**Arah perbaikan**  
Prefer `dvh`/`svh` seperti `VideoSocmedForm`; `overscroll-contain`.

---

### M6 — Sedang: Sticky TipTap toolbar di bawah `overflow-x-clip`

**Lokasi**
- `AdminLayoutClient.tsx` — `overflow-x-clip`
- `ToolbarArticle.tsx` — `sticky top-14`

**Masalah**  
Sticky di dalam ancestor yang clip overflow adalah footgun WebKit yang dikenal.

**Dampak Apple**  
Toolbar artikel bisa gagal sticky / “loncat” di Safari Mac/iPad.

**Arah perbaikan**  
Pindahkan clip ke wrapper yang tidak membungkus toolbar sticky.

---

### M7 — Sedang: Sidebar mobile admin tanpa body scroll lock

**Lokasi**
- `AdminLayoutClient.tsx` / `Sidebar.tsx`  
- Bandingkan publik `MobileMenu.tsx` yang sudah `overflow: hidden` pada body

**Masalah**  
Overlay menutupi, tetapi body di belakang masih bisa di-scroll.

**Dampak Apple**  
Overscroll/background scroll di iOS saat drawer terbuka.

**Arah perbaikan**  
Kunci scroll body saat sidebar mobile open; restore on close.

---

### M8 — Sedang: Media library = jalur upload utama tanpa normalisasi iOS

**Lokasi**
- `MediaUploadForm.tsx` — `accept: image/*` → object URL mentah

**Masalah**  
Sama dengan H2, tetapi frekuensi pemakaian tinggi di newsroom.

**Arah perbaikan**  
Sama H2; opsional reject HEIC di server dengan pesan jelas (`adsSharedHelpers` sudah mengenal `image/heic`).

---

### M9 — Sedang: Autosave draft (IndexedDB / localStorage) tanpa UX gagal Safari

**Lokasi**
- `src/lib/db/draftImageDb.ts`, `src/lib/autosave.ts`, sponsor localStorage

**Masalah**  
Private mode / quota / `onblocked` bisa gagal diam-diam.

**Dampak Apple**  
Safari private browsing dan eviction storage lebih ketat; draft “hilang” tanpa toast.

**Arah perbaikan**  
Catch `QuotaExceededError` / gagal buka IDB; toast “draft tidak tersimpan”; fallback memory + peringatan.

---

### M10 — Sedang: Helper video thumbnail tanpa `playsInline` / `muted`

**Lokasi**
- `src/lib/configuration/video-thumbnail.ts`

**Masalah**  
Elemen `<video>` untuk metadata/seek/canvas tanpa atribut iOS-friendly.

**Dampak Apple**  
Timeout metadata/seek (sudah ada 10s) → upload hero video gagal intermiten di iPhone.

**Arah perbaikan**  
`playsInline`, `muted`, `preload="auto"`; pesan error timeout lebih jelas.

---

### L1 — Rendah: Overlay eye di `CardMedia` hover-only

Kartu tetap bisa diklik; hanya discoverability. Saran: affordance ringan untuk `pointer: coarse`.

### L2 — Rendah: Dialog hapus `autoFocus` + anti-paste

`DialogConfirmInputDelete` — keyboard naik di bawah modal center; paste diblokir terasa aneh di iPadOS. Saran: delay focus; izinkan paste.

### L3 — Rendah: TipTap toolbar padat + `title` hover

Banyak ikon wrap di iPad; tooltip `title` tidak muncul tanpa hover. Saran: `aria-label` + menu “more” di lebar sempit.

### L4 — Rendah: `backdrop-blur` di chrome admin

Kosmetik/perf; glitch jarang di iOS lama. Saran: fallback solid bila reduced transparency.

### L5 — Rendah: Clipboard CMS / Service Worker

Tidak ada API clipboard kritis di CMS admin; push debug ada di layout tetapi bukan jalur utama konten. Risiko rendah untuk scope ini.

---

## Matriks prioritas saran

| Urutan | ID | Alasan |
|--------|----|--------|
| 1 | H1 | Jadwal iklan salah = dampak bisnis langsung |
| 2 | H2 + M8 | Upload foto iPhone gagal di media/ads/sponsor |
| 3 | H3 + M3 | iPad tidak bisa sort/hapus dengan nyaman |
| 4 | M1 + M4 | Crop & chart usable di touch |
| 5 | M5–M7, M9–M10 | Viewport, sticky, storage, video |

---

## Saran perbaikan yang tidak mengubah behavior user

Definisi di sini: perbaikan **di balik layar** — user tetap melihat alur, tombol, copy, dan hasil yang sama di Chrome/desktop seperti sekarang. Tidak ada redesign UI, tidak ada tombol baru, tidak ada aturan bisnis baru. Yang berubah hanyalah kompatibilitas / ketepatan teknis di Safari/WebKit (atau bugfix agar intent produk yang sudah ada benar-benar jalan).

### Aman — zero UX (boleh dikerjakan tanpa mengubah pengalaman yang disengaja)

| ID | Perbaikan | Mengapa tidak mengubah behavior |
|----|-----------|----------------------------------|
| **H1** | Samakan seed/parse jadwal ads dengan helper WIB (seperti artikel), jangan `toISOString().slice` | Form & field sama; hanya nilai waktu yang disimpan/ditampilkan menjadi konsisten dengan intent produk. Bukan fitur baru. |
| **H2 / M8** | Semua jalur crop lewat `prepareImageForCrop` (HEIC → JPEG, decode aman) **tanpa toast baru** | User tetap pilih file → crop → simpan. Preview/crop yang dulu gagal di iPhone jadi berhasil; di Chrome hasil akhir tetap WebP/JPEG seperti sekarang. |
| **M3** | Tambah `touch-none` / `touchAction: "none"` pada handle ads & sponsor (samakan `VideoFormCard`) | Tampilan handle sama; hanya gesture scroll vs drag di Safari jadi benar. |
| **M5** | Ganti `vh` / `h-screen` → `dvh` / `svh` di panel sort & sticky ads (tanpa ubah layout struktur) | Struktur UI sama; area scroll mengikuti chrome Safari supaya konten tidak terpotong. |
| **M6** | Pindahkan `overflow-x-clip` ke wrapper yang tidak membungkus sticky toolbar | Toolbar & isi artikel sama; sticky hanya “benar-benar sticky” di WebKit. |
| **M10** | Set `playsInline` + `muted` + `preload` pada elemen video helper thumbnail | Tidak ada UI baru; metadata/seek di iOS lebih sering sukses, alur upload sama. |
| **L3 (parsial)** | Tambah `aria-label` pada ikon TipTap (tanpa menu “more”) | Visual sama; aksesibilitas / VoiceOver saja. |
| **L4 (parsial)** | Fallback solid hanya saat `prefers-reduced-transparency` | Hampir semua user melihat blur seperti sekarang; hanya mode aksesibilitas yang dapat fallback. |

### Hampir zero UX — hanya memperbaiki kegagalan / edge case (opsional ketat)

Perubahan ini **tidak mengubah happy path**, tetapi menambah sinyal saat Apple/Safari gagal (yang sebelumnya silent). Jika syarat “sama sekali tidak ada teks/toast baru” ketat, tangguhkan dulu.

| ID | Perbaikan | Catatan |
|----|-----------|---------|
| **M9** | Catch quota / IDB gagal + toast “draft tidak tersimpan” | Happy path autosave sama; hanya saat gagal user dapat pesan (dulu diam). |
| **M10** | Pesan error timeout metadata lebih jelas | Hanya saat gagal extract thumbnail. |
| **H2** | Toast khusus “format HEIC tidak didukung” jika convert gagal total | Hanya path error; sukses tetap tanpa copy baru. |

### Mengubah behavior / UX — sengaja di luar “zero behavior”

Jangan masuk batch “tanpa ubah behavior”:

| ID | Mengapa mengubah behavior |
|----|---------------------------|
| **H3** | Kontrol DnD/hapus selalu terlihat = UI berbeda di desktop & touch |
| **M1** | Dialog crop top-anchored / tinggi dinamis = layout modal berubah |
| **M2** | Activation distance = drag mouse sedikit lebih “keras” mulai |
| **M4** | Chart bisa di-tap/klik untuk detail = interaksi baru |
| **M7** | Body scroll lock = tidak bisa scroll background saat sidebar open |
| **L1** | Affordance eye selalu on = tampilan kartu berubah |
| **L2** | Izinkan paste + delay focus = perilaku dialog hapus berubah |
| **L3 (penuh)** | Menu “more” toolbar = struktur UI baru |

### Rekomendasi batch pertama (zero UX)

Kerjakan berurutan tanpa redesign:

1. **H1** — datetime ads WIB-aware  
2. **H2 + M8** — `prepareImageForCrop` di media / ads / sponsor (silent)  
3. **M3** — `touch-none` pada handle yang belum  
4. **M5 + M6** — `dvh` + perbaikan ancestor sticky  
5. **M10** — atribut video helper (silent)  
6. **L3 aria-label** + **L4** reduced-transparency (opsional)

Batch ini menutup risiko Apple terbesar yang bisa diperbaiki **tanpa mengubah cara user memakai CMS**.

---

## Catatan QA yang disarankan

Uji minimal di **Safari macOS**, **Safari iPad**, dan **Safari iPhone** untuk:

1. Buat/edit jadwal iklan homepage & single-article (cek offset jam).
2. Upload foto HEIC dari Photos ke Media Library + crop.
3. Sort gallery artikel & section featured/editor choices tanpa hover.
4. Crop featured image di iPhone portrait (keyboard + konfirmasi).
5. Tap chart di dashboard AE/writer.
6. Buka artikel draft setelah Private Browsing / storage penuh (simulasi).

## Batasan audit

- Tidak menjalankan browser Apple di lingkungan ini.
- Fokus CMS; perilaku publik (homepage, LCP, push guest) di luar scope kecuali overlap helper bersama.
- Detail socmed lebih dalam ada di `memory/analysis/admin-socmed-apple-audit.md`.

## Kesimpulan

Platform Apple **belum “aman by default”** untuk seluruh CMS. Mitigasi sudah ada di jalur artikel (schedule WIB, prepare crop), tetapi **iklan, media library, DnD hover, chart, dan viewport** masih menyimpan risiko klasik Safari/iOS yang mudah lolos jika pengujian hanya di Chrome desktop.
