# Audit Kompatibilitas Interaktivitas — admin-xyz (iPhone / iPad / macOS Safari)

**Tanggal audit:** 2026-08-11  
**Scope:** CMS `src/app/admin-xyz` (33 route aktif + layout) dan komponen shared yang diimpor  
**Metode:** review kode read-only; tidak ada pengujian di perangkat Apple nyata  
**Fokus:** pola interaktif yang biasanya lolos di Chrome Windows / Android, tetapi berpotensi gagal atau terasa rusak di Safari / WebKit  

**Dokumen terkait:**
- [`memory/audit_platform.md`](audit_platform.md) — audit platform CMS (2026-07-29)
- [`memory/analysis/admin-socmed-apple-audit.md`](analysis/admin-socmed-apple-audit.md) — fokus socmed
- [`memory/issue_ipad.md`](issue_ipad.md) — kegagalan upload gallery di iPad

---

## Ringkasan eksekutif

CMS admin-xyz punya **mitigasi Apple-aware yang sudah matang di beberapa jalur** (WIB datetime di editor artikel / approval, `prepareImageForCrop` + `process-temp` di draft artikel, `100dvh` + `touch-none` di socmed, shared `sortableStyles` dengan `touch-none`). Namun audit ulang 2026-08-11 menemukan risiko interaktivitas yang **masih terbuka** dan mudah lolos jika QA hanya di Chrome desktop:

1. **Kontrol DnD / hapus berbasis hover** (`opacity-25` + `group-hover`) — hampir tidak discoverable di iPhone/iPad.
2. **Jadwal iklan (`datetime-local`) di-seed dengan UTC** (`toISOString().slice`) — beda dari alur artikel yang sudah WIB-aware; risiko offset jam.
3. **Jalur crop media / ads / sponsor** masih memakai `URL.createObjectURL(file)` mentah — HEIC / foto kamera iPhone rentan gagal sebelum crop.
4. **Chart AE dashboard** memakai tooltip custom `onHover` + `onMouseLeave` — detail chart sulit dibaca di touch.
5. **Crop modal + dialog center-fixed** rentan bentrok keyboard / viewport dinamis Safari.
6. **Related-articles DnD** memakai `PointerSensor` tanpa `activationConstraint` — bentrok scroll di iPad.
7. **Layout admin** (`overflow-x-clip`, sidebar `h-screen`, mobile overlay tanpa body scroll lock) — sticky toolbar & rubber-band scroll.
8. **Draft storage** (localStorage / IndexedDB / idb-keyval) tanpa UX gagal yang jelas di Safari private / quota.

Tidak ditemukan indikasi “CMS selalu crash di Safari”, tetapi kombinasi di atas cukup untuk menghasilkan bug intermiten, jadwal salah, upload gagal, atau UX “tombol hilang”.

---

## Yang sudah relatif aman (mitigasi existing)

| Area | Lokasi | Catatan |
|------|--------|---------|
| HEIC + decode sebelum crop (draft artikel) | `src/lib/image/prepareImageForCrop.ts`, `DraftImageUploadForm.tsx` | Decode → JPEG downscale; komentar eksplisit iOS/iPad |
| Upload draft → server Sharp | `DraftImageUploadForm` → `POST /media/process-temp` | Offload WebP/watermark ke server (perbaikan dari isu iPad gallery) |
| HEIC di jalur socmed thumbnail | `VideoSocmedForm.tsx` | Memakai `prepareImageForCrop` |
| Schedule artikel / approval WIB | `src/lib/datetime-jakarta.ts`, `ArticleEditorForm`, `ArticleApprovalForm` | Wall-clock WIB → UTC benar |
| Socmed viewport | `VideoSocmedForm.tsx` | `100dvh` + `-webkit-overflow-scrolling: touch` |
| Handle DnD video | `VideoFormCard.tsx` + `sortableVideoDragHandleClass` | Sudah `touch-none` |
| Handle ads / sponsor | `sortableCompactDragHandleClass` | Sudah `touch-none` (mitigasi M3 audit lama) |
| SelectAndSort tinggi panel | `SelectAndSort.tsx` | Mixed `100vh` + fallback `[height:calc(100dvh-…)]` |
| Category order modals | `NavbarCategoriesOrderModal`, `FeaturedCategoriesOrderModal` | `max-h-[90dvh]` |
| Clipboard CMS | `src/lib/utils.ts` `copyToClipboard` | Ada fallback textarea |
| Chart Writer / Editor / Admin | Dashboard non-AE | Tooltip native Chart.js (lebih aman dibanding AE custom hover) |

---

## Matriks halaman (33 route aktif)

| Route | Komponen interaktif utama | Risiko utama |
|-------|---------------------------|--------------|
| `/admin-xyz` (layout) | `AdminLayoutClient`, `Sidebar` | M6, M7 — sticky/`overflow-x-clip`, scroll lock |
| `/admin-xyz` | Role dashboards (`AEDashboard`, dll.) | H4 — chart hover (AE); L — hover kosmetik |
| `/admin-xyz/articles` | `ListTable`, DayPicker+Popover, pagination | M11 — popover kalender touch |
| `/admin-xyz/articles/new` | `ArticleEditorForm` stack | H3, H5, H6, M1, M2, M9, M6 |
| `/admin-xyz/articles/new/gallery` | Sama + `GallerySorting` | H3, H5, H6, M1, M9 |
| `/admin-xyz/articles/[idOrSlug]` | Sama editor stack | H3, H5, H6, M1, M2, M9 |
| `/admin-xyz/articles/preview` | `ArticleUi`, draft localStorage, clipboard | M9 |
| `/admin-xyz/articles/[idOrSlug]/approval` | `ArticleApprovalForm`, `ArticleUi` | Relatif aman (WIB); clipboard L |
| `/admin-xyz/articles/approval` | `ListTable` | Rendah |
| `/admin-xyz/articles/headline` | `SelectAndSort` | H3, M5 |
| `/admin-xyz/articles/featured` | `SelectAndSort` | H3, M5 |
| `/admin-xyz/articles/popular` | `SelectAndSort` | H3, M5 |
| `/admin-xyz/articles/editor-choice` | `SelectAndSort` | H3, M5 |
| `/admin-xyz/articles/[idOrSlug]/related` | `SelectAndSort` | H3, M5 |
| `/admin-xyz/articles/socmed` | `VideoSocmedForm` | H3 (handle opacity), nested scroll; mitigasi dvh OK |
| `/admin-xyz/articles/youtube-section` | `VideoSocmedForm` | Sama socmed |
| `/admin-xyz/articles/selected-topics` | `NewsCard`, panel topics | Rendah (form + list) |
| `/admin-xyz/categories` | Order modals DnD, `CategoryFormDialog` | H3; dialog `90vh` di form |
| `/admin-xyz/configuration` | `VideoHeroUploader`, `ImageDropZone` | H2 (image), M10 (video), dropzone |
| `/admin-xyz/configuration/about-us` | Nested `@dnd-kit` people/positions | H3, M2-like nested DnD |
| `/admin-xyz/media` | `MediaFormModal`, `MediaUploadForm`, `CardMedia` | H2, H5, M8, L1 |
| `/admin-xyz/users` | Dialogs, `DialogConfirmInputDelete` | L2 |
| `/admin-xyz/teams` | Team dialogs | Rendah / L2-like |
| `/admin-xyz/sponsor` | `SponsorForm` | H2, H3, M5, M9 |
| `/admin-xyz/ads/homepage` | `AdsHomepageForm`, idb-keyval | H1, H2, H3, M5, M9 |
| `/admin-xyz/ads/single-article` | `AdsSIngleArticleForm` | H1, H2, H3, M5, M9 |
| `/admin-xyz/ads/history` | List + preview dialog `50vh` | M5 (preview height) |
| `/admin-xyz/analytics/audience` | Chart.js + `ListTable` | Rendah–sedang (tooltip native) |
| `/admin-xyz/analytics/editor-activity` | DayPicker+Popover | M11 |
| `/admin-xyz/analytics/workflow` | Chart.js + `ListTable` | Rendah–sedang |
| `/admin-xyz/analytics/writing` | Vaul `Drawer` `85vh` | M5 |
| `/admin-xyz/reports/kpi` | Tabs + metrics | Rendah |
| `/admin-xyz/monthly-target` | Tabs + inputs | Rendah |
| `/admin-xyz/profile/[id]` | `ProfileUi` | Rendah |

Route unused: `articles/carousel-section/page-notused.tsx` — di luar matriks aktif.

---

## Temuan detail

### H1 — Tinggi: Ads `datetime-local` di-seed/parse sebagai UTC

**Status:** OPEN (sama audit Juli 2026)

**Lokasi**
- `src/components/admin/ads/AdsHomepageForm.tsx` — `nowLocalStr` / `monthLaterStr` via `toISOString().slice(0, 16)`
- `src/components/admin/ads/AdsSIngleArticleForm.tsx` — pola sama
- Hydrate: `src/app/admin-xyz/ads/homepage/page.tsx`, `ads/single-article/page.tsx` (`new Date(...).toISOString().slice(0, 16)`)

**Masalah**  
Nilai `datetime-local` diisi dari UTC ISO string. Form artikel sudah memakai `formatDatetimeLocalFromUtc` / `parseDatetimeLocalAsWib`; form iklan tidak.

**Dampak Apple**  
Safari sering memparse string tanpa timezone secara inkonsisten. Editor di Mac/iPad melihat default waktu “aneh” vs intent WIB; jadwal iklan bisa bergeser beberapa jam tanpa terlihat di Chrome Windows jika zona lokal kebetulan mirip pola uji.

**Halaman terdampak:** `/admin-xyz/ads/homepage`, `/admin-xyz/ads/single-article`

**Rekomendasi**  
Samakan dengan helper WIB; jangan seed dengan `toISOString().slice`.  
**Zero UX:** ya (field sama; hanya nilai benar).

---

### H2 — Tinggi: `prepareImageForCrop` tidak merata di jalur upload CMS

**Status:** PARTIAL — draft artikel & socmed sudah; media / ads / sponsor / config belum

**Lokasi yang memakai**
- `DraftImageUploadForm.tsx` (jalur artikel)
- `VideoSocmedForm.tsx` (thumbnail)

**Lokasi yang belum**
- `MediaUploadForm.tsx` — `URL.createObjectURL(file)` langsung ke crop
- `AdsHomepageForm.tsx`, `AdsSIngleArticleForm.tsx` — `setRawImageSrc(URL.createObjectURL(file))`
- `SponsorForm.tsx` — sama
- `ImageDropZone` / configuration — file mentah ke parent tanpa normalisasi HEIC di client sebelum preview/crop

**Masalah**  
Foto dari Photos app iPhone sering HEIC atau JPEG sangat besar. Tanpa normalisasi, `CropImageModal` menerima object URL mentah.

**Dampak Apple**  
Gagal decode intermiten, preview hitam/blank, crop “stuck”, atau tab Safari di-reload karena memory pressure.

**Halaman terdampak:** `/media`, `/ads/*`, `/sponsor`, `/configuration`

**Rekomendasi**  
Semua entry crop CMS lewat `prepareImageForCrop`; revoke URL hasil prepare.  
**Zero UX:** ya (silent normalisasi). Toast HEIC gagal = hampir zero UX.

---

### H3 — Tinggi: Kontrol gallery / section sort bergantung hover

**Status:** OPEN

**Lokasi**
- `src/lib/admin/sortableStyles.ts` — semua handle/remove: `opacity-25 group-hover:opacity-75`
- Pemakai: `GallerySorting`, `SortableArticleCard`, `VideoFormCard`, `AdsFormCard`, `SponsorFormCard`, SelectAndSort cards, category order items (pola serupa)

**Masalah**  
Handle drag dan tombol hapus hampir/hanya terlihat jelas saat hover. Di touch, opacity tetap ~25%.

**Dampak Apple**  
iPad/iPhone tidak punya hover. User mengira fitur sort/hapus “hilang” atau hanya bisa pakai gesture yang salah.

**Halaman terdampak:** headline, featured, popular, editor-choice, related, gallery editor, socmed, youtube, ads, sponsor, categories order, about-us

**Rekomendasi**  
Kontrol selalu terlihat di `pointer: coarse` / tanpa bergantung hover; target sentuh lebih besar.  
**Zero UX:** tidak (UI affordance berubah di touch/desktop).

---

### H4 — Tinggi: Chart AE dashboard tooltip hover-only

**Status:** OPEN

**Lokasi**
- `src/components/dashboard/AEDashboard.tsx` — `tooltip: { enabled: false }`, `onHover: handleHover`, container `onMouseLeave` clears popover (3 chart widgets)

**Masalah**  
Tooltip native dimatikan; detail hanya muncul via hover mouse.

**Dampak Apple**  
Tap di iPad/iPhone tidak setara hover; angka/detail chart tidak bisa dibaca. macOS Safari dengan mouse relatif OK.

**Halaman terdampak:** `/admin-xyz` (role AE)

**Rekomendasi**  
Toggle detail on click/touch, atau aktifkan event Chart.js yang setara pointer.  
**Zero UX:** tidak (interaksi baru).

---

### H5 — Tinggi: Crop modal + dialog center vs keyboard / viewport Safari

**Status:** OPEN

**Lokasi**
- `CropImageModal.tsx` — tinggi crop fixed (~280 / 480px)
- `src/components/ui/dialog.tsx` — `fixed top-[50%] translate-y-[-50%]`
- Nested: `ImagePickerModal` → crop; `MediaFormModal` custom fixed center

**Masalah**  
Tidak ada adaptasi `dvh`/`svh` atau `visualViewport` saat keyboard naik; tinggi crop kaku.

**Dampak Apple**  
Footer aksi crop terpotong; modal “loncat”; sulit konfirmasi crop di iPhone portrait. Nested dialog focus trap di iOS lebih sensitif.

**Halaman terdampak:** editor artikel, media, ads, sponsor, socmed (semua yang pakai crop)

**Rekomendasi**  
Cap area crop dengan `min(..., 50dvh)`; dialog scrollable / top-anchored di viewport kecil.  
**Zero UX:** sebagian (layout modal berubah di mobile).

---

### H6 — Tinggi: TipTap editor — sticky toolbar + focus + contentEditable WebKit

**Status:** OPEN (risiko platform)

**Lokasi**
- `ToolbarArticle.tsx` — `sticky top-14 md:top-16`
- `AdminLayoutClient.tsx` — ancestor `overflow-x-clip`
- `ArticleEditorForm.tsx` / TipTap — `editor.chain().focus()`, contentEditable

**Masalah**  
Sticky di dalam ancestor yang clip overflow adalah footgun WebKit yang dikenal. Keyboard on-screen iOS menutup toolbar; caret/selection TipTap di Safari lebih rapuh.

**Dampak Apple**  
Toolbar gagal sticky / “loncat”; formatting button tidak restore caret; editing panjang di iPad terasa berat.

**Halaman terdampak:** `articles/new`, `articles/new/gallery`, `articles/[idOrSlug]`

**Rekomendasi**  
Pindahkan `overflow-x-clip` ke wrapper yang tidak membungkus sticky toolbar; uji fokus toolbar setelah setiap aksi format.  
**Zero UX:** clip move = ya; redesign toolbar = tidak.

---

### M1 — Sedang: Related articles DnD tanpa activation distance

**Status:** OPEN

**Lokasi**
- `ArticleEditorFormUi.tsx` — `useSensor(PointerSensor)` tanpa `activationConstraint`

**Masalah**  
Drag aktif segera pada pointer down; scroll vertikal list bentrok dengan DnD.

**Dampak Apple**  
Di iPad, scroll list related sering jadi “ikut drag”.

**Halaman terdampak:** editor artikel (panel related)

**Rekomendasi**  
`activationConstraint: { distance: 8 }` atau drag hanya via handle (sudah ada handle di `SortableSidebarArticleItem`).  
**Zero UX:** hampir (mouse drag sedikit lebih “keras”).

---

### M2 — Sedang: Nested DnD about-us & panel scroll vs drag

**Status:** OPEN (mitigasi parsial: `touch-none` di handle)

**Lokasi**
- `configuration/about-us/page.tsx` — nested `DragDropProvider`, handle `touch-none`
- `SelectAndSort.tsx` — `touch-pan-y` pada scroll container berdampingan DnD
- `VideoSocmedForm.tsx` — dual panel scroll + DnD

**Masalah**  
Meskipun handle punya `touch-none`, daftar panjang + nested scroll Safari tetap mudah memprioritaskan pan.

**Dampak Apple**  
Reorder “kadang bisa, kadang tidak” di iPad landscape/portrait.

**Halaman terdampak:** about-us, SelectAndSort routes, socmed, youtube

**Rekomendasi**  
Activation constraint; opsional tombol naik/turun untuk touch.  
**Zero UX:** constraint = hampir; tombol = tidak.

---

### M3 — Sedang: Handle ads/sponsor `touch-none` — TERMITIGASI

**Status:** FIXED / MITIGATED (via `sortableCompactDragHandleClass` yang sudah `touch-none`)

Catatan: audit Juli 2026 menandai inkonsistensi vs VideoFormCard. Saat ini shared styles sudah menyertakan `touch-none`. Sisa risiko utama pindah ke **H3** (opacity hover).

---

### M4 — Sedang: (digabung ke H4) Chart hover

Lihat H4. Writer/Editor/Admin dashboard memakai tooltip Chart.js native — risiko lebih rendah.

---

### M5 — Sedang: Banyak panel masih `vh` / `h-screen` (campuran `dvh`)

**Status:** PARTIAL

**Lokasi masih `vh` / `h-screen`**
- Ads sticky sidebar: `xl:max-h-[calc(100vh-6rem)]` (`AdsHomepageForm`, `AdsSIngleArticleForm`)
- `SponsorForm`: `h-screen` loading, `lg:max-h-[min(80vh,…)]`
- `VideoSocmedSorting`: `lg:h-[80vh]` (jika masih dipakai)
- `SelectAndSort`: `lg:h-[80vh]` + `lg:max-h-screen` (punya fallback dvh di konstanta lain)
- Analytics writing drawer: `max-h-[85vh]`
- Ads history preview: `h-[min(50vh,28rem)]`
- Sidebar admin: `h-screen`
- Loading overlays berbagai form: `h-screen`

**Yang sudah baik**
- Socmed form: `100dvh`
- Category order: `90dvh`
- SelectAndSort list height constant: `100dvh` fallback

**Dampak Apple**  
`vh` mengabaikan chrome dinamis (toolbar URL); konten terpotong; nested scroll + rubber-band saling ganggu.

**Rekomendasi**  
Prefer `dvh`/`svh`; `overscroll-contain`.  
**Zero UX:** ya.

---

### M6 — Sedang: Sticky TipTap toolbar di bawah `overflow-x-clip`

**Status:** OPEN — lihat juga H6

**Lokasi:** `AdminLayoutClient.tsx` (`overflow-x-clip` pada main wrapper)

**Rekomendasi:** Pindahkan clip ke wrapper konten yang tidak membungkus toolbar sticky.  
**Zero UX:** ya.

---

### M7 — Sedang: Sidebar mobile admin tanpa body scroll lock

**Status:** OPEN

**Lokasi**
- `AdminLayoutClient.tsx` / `Sidebar.tsx` — overlay `fixed inset-0` tanpa `document.body.style.overflow = "hidden"`
- Bandingkan publik `MobileMenu.tsx` yang sudah mengunci scroll body

**Dampak Apple**  
Overscroll / background scroll di iOS saat drawer terbuka.

**Halaman terdampak:** semua admin (mobile)

**Rekomendasi**  
Kunci scroll body saat sidebar mobile open; restore on close.  
**Zero UX:** tidak (behavior scroll berubah saat drawer open — perbaikan yang diinginkan).

---

### M8 — Sedang: Media library — custom modal + crop tanpa prepare

**Status:** OPEN (upload post-crop sudah server `process-temp` — baik)

**Lokasi**
- `MediaFormModal.tsx` — custom `fixed inset-0`, tanpa Radix focus trap / body lock
- `MediaUploadForm.tsx` — raw object URL ke crop (H2)

**Dampak Apple**  
Background scroll bleed; viewport jump; crop HEIC gagal sebelum file sempat ke server.

**Halaman terdampak:** `/admin-xyz/media`

**Rekomendasi**  
Radix Dialog + `prepareImageForCrop`.  
**Zero UX:** prepare = ya; ganti modal = hampir.

---

### M9 — Sedang: Autosave / draft storage tanpa UX gagal Safari

**Status:** OPEN (sebagian arsitektur draft gambar artikel sudah pindah ke temp server)

**Lokasi**
- `src/lib/autosave.ts` — localStorage draft artikel
- `src/lib/db/draftImageDb.ts` — IndexedDB (masih ada; dipakai jalur legacy / config / restore)
- Ads: `localStorage` + `idb-keyval`
- Sponsor / socmed: localStorage (+ IDB thumbnail di socmed historis)

**Masalah**  
Private mode / quota / `onblocked` bisa gagal diam-diam. Safari lebih agresif eviction.

**Dampak Apple**  
Draft “hilang” tanpa toast; metadata ada tapi blob hilang.

**Halaman terdampak:** editor, preview, ads, sponsor, socmed

**Rekomendasi**  
Catch `QuotaExceededError` / gagal IDB; toast jelas; indikator “data dari draft lokal”.  
**Zero UX:** hampir (hanya path error).

---

### M10 — Sedang: Helper video thumbnail tanpa `playsInline` / `muted`

**Status:** OPEN

**Lokasi**
- `src/lib/configuration/video-thumbnail.ts` — `getVideoDurationSeconds` & `extractVideoThumbnail` membuat `<video>` tanpa `playsInline`, `muted`

**Dampak Apple**  
Timeout metadata/seek (sudah ada 10s) → upload hero video gagal intermiten di iPhone.

**Halaman terdampak:** `/admin-xyz/configuration`

**Rekomendasi**  
`playsInline`, `muted`, `preload="auto"`; pesan timeout lebih jelas.  
**Zero UX:** atribut = ya; pesan = hampir.

---

### M11 — Sedang: DayPicker di Popover (kalender filter)

**Status:** OPEN (risiko UX)

**Lokasi**
- `articles/page.tsx`, `analytics/editor-activity/page.tsx` — `DayPicker` dalam `Popover`

**Dampak Apple**  
Positioning popover + touch target tanggal di iPhone; keyboard tidak relevan tetapi tap di luar / scroll bisa menutup prematur.

**Rekomendasi**  
Uji di iPhone; pertimbangkan dialog full-width di `pointer: coarse`.  
**Zero UX:** tergantung solusi.

---

### L1 — Rendah: Overlay eye di `CardMedia` hover-only

**Lokasi:** `CardMedia.tsx` — `opacity-0 group-hover:opacity-100`  
Kartu tetap bisa diklik; hanya discoverability.  
**Halaman:** `/media`

---

### L2 — Rendah: Dialog hapus `autoFocus` + anti-paste

**Lokasi:** `DialogConfirmInputDelete.tsx` — `autoFocus`, `onPaste={(e) => e.preventDefault()}`  
Keyboard naik di bawah modal center; paste diblokir terasa aneh di iPadOS.  
**Halaman:** users (dan pemakai dialog serupa)

---

### L3 — Rendah: TipTap toolbar padat + `title` hover

Banyak ikon wrap di iPad; tooltip `title` tidak muncul tanpa hover.  
**Saran:** `aria-label` (zero UX) + menu “more” di lebar sempit (UX change).

---

### L4 — Rendah: `backdrop-blur` di chrome admin

**Lokasi:** header `AdminLayoutClient`  
Kosmetik/perf; glitch jarang di iOS lama. Fallback solid bila `prefers-reduced-transparency`.

---

### L5 — Rendah: Dropzone drag-and-drop di iOS

`react-dropzone` / native drag di media, ads, config — **tap-to-browse** biasanya OK; drag dari Files app terbatas. Bukan blocker jika UI jelas menawarkan klik/pilih file.

---

### L6 — Rendah: Clipboard & Service Worker

`copyToClipboard` sudah punya fallback. Push debug hanya di layout development. Risiko rendah untuk scope interaktivitas konten.

---

## Rekomendasi per batch

### Batch 1 — Zero / hampir zero UX (prioritas bisnis)

| Urutan | ID | Perbaikan |
|--------|-----|-----------|
| 1 | H1 | Datetime ads WIB-aware |
| 2 | H2 + M8 | `prepareImageForCrop` di media / ads / sponsor / config image paths |
| 3 | M5 + M6 | `dvh`/`svh` + pindahkan `overflow-x-clip` |
| 4 | M10 | `playsInline` + `muted` pada helper video |
| 5 | M9 | Catch storage fail + toast (hampir zero) |
| 6 | L3 parsial | `aria-label` TipTap |

### Batch 2 — Interaktivitas touch (ubah UX secara sadar)

| Urutan | ID | Perbaikan |
|--------|-----|-----------|
| 1 | H3 | Handle/remove selalu terlihat di coarse pointer |
| 2 | M1 + M2 | Activation constraint / harden DnD |
| 3 | H4 | Chart AE tap-to-toggle detail |
| 4 | H5 | Crop/dialog mobile viewport adaptif |
| 5 | M7 | Body scroll lock sidebar mobile |

### Batch 3 — Polish & edge

| ID | Perbaikan |
|----|-----------|
| H6 (sisa) | Uji TipTap caret/keyboard iPad; sesuaikan sticky offset |
| M11 | Kalender filter mobile |
| L1, L2, L4 | Affordance CardMedia; paste delete dialog; reduced transparency |

---

## Matriks prioritas ringkas

| Prioritas | ID | Alasan |
|-----------|-----|--------|
| 1 | H1 | Jadwal iklan salah = dampak bisnis langsung |
| 2 | H2 + M8 | Upload foto iPhone gagal di media/ads/sponsor |
| 3 | H3 | iPad tidak bisa sort/hapus dengan nyaman (banyak route) |
| 4 | H5 + H6 | Crop & editor usable di touch/keyboard |
| 5 | H4 | Dashboard AE readable di tablet |
| 6 | M5–M7, M9–M11 | Viewport, sticky, storage, video, kalender |

---

## Skenario QA manual (Safari)

### A. Safari iPhone
1. Buat/edit jadwal iklan homepage & single-article — cek offset jam vs WIB intent.
2. Upload foto HEIC dari Photos ke Media Library → crop → simpan.
3. Crop featured image di editor artikel portrait (keyboard + tombol konfirmasi terlihat).
4. Buka sidebar mobile — pastikan background tidak ikut scroll.
5. Buka analytics/writing drawer — konten tidak terpotong chrome URL.
6. Configuration: upload video hero pendek — metadata/thumbnail tidak timeout.

### B. Safari iPad
1. Sort headline / featured / gallery **tanpa hover** — handle & hapus discoverable?
2. Drag-sort socmed + scroll panel kiri/kanan bergantian.
3. Nested reorder about-us (positions + people).
4. Related articles di editor: scroll list vs drag.
5. Tap chart AE dashboard — detail muncul?
6. TipTap: sticky toolbar saat scroll; bold/link setelah tap toolbar.

### C. Safari macOS
1. Nested scroll SelectAndSort / socmed dengan trackpad.
2. Sticky toolbar editor saat scroll panjang.
3. DayPicker filter di daftar artikel.
4. Private Browsing: autosave draft → reload → pesan/recovery jelas.

---

## Relasi dengan audit lama

| Sumber | Hubungan dengan audit ini |
|--------|---------------------------|
| `audit_platform.md` (2026-07-29) | Banyak temuan H/M masih **OPEN**; M3 touch-none ads/sponsor **sudah termitigasi** via shared styles; H2 **PARTIAL** (draft+socmed OK) |
| `admin-socmed-apple-audit.md` | Socmed tetap fokus memory/object URL & DnD; mitigasi `dvh`/`prepareImageForCrop` sudah ada; opacity handle masih H3 |
| `issue_ipad.md` | Gallery draft sekarang memakai `process-temp` (arah solusi server) — risiko IDB gallery **berkurang**, tetapi crop pra-upload & jalur non-artikel masih rawan |

---

## Batasan audit

- Tidak menjalankan Safari / perangkat Apple di lingkungan ini.
- Temuan = **potensi** berdasarkan pola kode + pengetahuan WebKit; bukan bug yang sudah direpro hari ini.
- Fokus CMS `admin-xyz`; perilaku situs publik di luar scope kecuali overlap helper bersama.
- Route `carousel-section/page-notused.tsx` tidak diuji sebagai halaman aktif.
- Perbedaan “functional vs cosmetic” `hover:` sudah dipisah (H3/H4/L1 vs shadow kosmetik).

---

## Kesimpulan

Platform Apple **belum “aman by default”** untuk seluruh interaktivitas CMS. Mitigasi kuat ada di jalur artikel (WIB schedule, prepare crop, process-temp) dan sebagian DnD (`touch-none`, `dvh` di socmed/categories). Celah terbesar yang tersisa untuk QA Chrome-only:

1. **Hover-gated DnD controls** di hampir semua halaman sort  
2. **Ads datetime UTC**  
3. **Crop tanpa prepare** di media / ads / sponsor  
4. **AE chart hover**  
5. **Viewport / sticky / mobile scroll lock** di shell admin  

Batch 1 (zero UX) menutup risiko bisnis terbesar tanpa redesign; Batch 2 membuat CMS benar-benar usable di iPad/iPhone untuk tugas harian reorder & analytics.
