# Strategi Integrasi & Refactor Google Analytics — Arasvara

> Disusun: 29 Juni 2026  
> Diperbarui: 29 Juni 2026 — keputusan akun final  
> Scope: GA4 Property baru, skema event lengkap, Hybrid tracking (browser + server Measurement Protocol), Looker Studio

---

## 0. Keputusan Akun & Environment (Final)

| Layer                 | Staging                                                               | Production                                                                         |
| --------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| **Akun Google**       | `mp.webekspres@gmail.com`                                             | `arasvaranews@gmail.com`                                                           |
| **GA4**               | Property **Arasvara Staging** (akun mp) — validasi skema event        | Property **Production v2** baru (akun arasvaranews) — jadi utama setelah cutover   |
| **GA4 historis**      | —                                                                     | Property lama (arasvaranews) **tetap aktif**, tidak dihapus                        |
| **Firebase (FCM)**    | Project Firebase di akun **mp.webekspres**                            | Project `arasvara-14a8c` di akun **arasvaranews**                                  |
| **Vercel**            | Project staging (`staging-arasvara.vercel.app`)                       | Project production (`arasvara.id`)                                                 |
| **Looker Studio**     | Laporan uji — login akun **mp**                                       | Laporan resmi — login akun **arasvaranews**                                        |
| **Analytics di kode** | `NEXT_PUBLIC_GA_MEASUREMENT_ID` + `GA_MP_API_SECRET` dari property mp | `NEXT_PUBLIC_GA_MEASUREMENT_ID` + `GA_MP_API_SECRET` dari property v2 arasvaranews |

### Prinsip pemisahan

- **Staging = seluruhnya akun mp.webekspres** (GA + Firebase + env Vercel staging).
- **Production = seluruhnya akun arasvaranews** (GA v2 + Firebase `arasvara-14a8c`).
- Property GA lama di arasvaranews tidak diubah — data historis tidak hilang.
- Cutover production hanya mengganti **GA measurement ID**; Firebase production tidak berubah.

### Firebase vs GA di codebase

| Env var                                               | Fungsi                                                                                         |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID`                       | **Analytics** — `gtag.js` di `layout.tsx` (ini yang dikontrol per environment)                 |
| `NEXT_PUBLIC_FIREBASE_*` + `FIREBASE_SERVICE_ACCOUNT` | **Push notification (FCM)** — terpisah dari GA                                                 |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`                 | Ada di `firebase.ts`, tapi **tidak dipakai** untuk tracking (`getAnalytics()` tidak dipanggil) |

> Staging: jangan pakai Firebase `arasvara-14a8c` (prod) — push test bisa sampai ke pembaca sungguhan.

---

## 1. Kondisi Saat Ini

### Apa yang sudah ada

| Layer                                                                | Status                                         |
| -------------------------------------------------------------------- | ---------------------------------------------- |
| GA4 gtag.js dimuat di `layout.tsx`                                   | ✅ Aktif                                       |
| `page_view` per SPA navigation via `GaRouteTracker`                  | ✅ Aktif                                       |
| `view_article` dengan 15 custom parameter dari `google-analytics.ts` | ✅ Aktif                                       |
| MongoDB `article_views` per sesi dari `/api/analytics/view-article`  | ✅ Aktif                                       |
| Custom Dimensions terdaftar di GA4 Admin                             | ❓ Perlu dicek manual                          |
| Headline click, share, search, scroll depth                          | ❌ Belum ada                                   |
| Ads impression/click di GA                                           | ❌ Belum ada (hanya MongoDB `ad_click_events`) |
| Push notification di GA                                              | ❌ Belum ada (API ada, tidak terhubung)        |
| Author profile visit di GA                                           | ❌ Belum ada                                   |
| Measurement Protocol (server-side)                                   | ❌ Belum ada                                   |

### Kelemahan skema event saat ini

1. **`view_article` tidak ada `reading_time`** — tidak bisa tahu rata-rata lama baca
2. **Unique visitor lemah** — `sessionId` dari JWT token, bukan dedicated anonymous ID
3. **Tag dikirim sebagai string CSV** (`"Politik, Hukum, Ekonomi"`) — tidak bisa difilter per-tag di GA/Looker Studio
4. **Tidak ada event untuk interaksi pengguna** (klik, share, scroll)
5. **GA dan MongoDB berjalan independen** tanpa sinkronisasi — bisa terjadi selisih hitung
6. **Event hilang jika adblock** — seluruh tracking saat ini 100% client-side

---

## 2. Keputusan Arsitektur

| Keputusan                  | Pilihan                                                                                        |
| -------------------------- | ---------------------------------------------------------------------------------------------- |
| **Akun staging**           | `mp.webekspres@gmail.com` — GA + Firebase + Vercel staging                                     |
| **Akun production**        | `arasvaranews@gmail.com` — GA v2 baru + Firebase `arasvara-14a8c` (existing)                   |
| **GA Property staging**    | Baru di akun mp — untuk dev & validasi skema                                                   |
| **GA Property production** | Baru (v2) di akun arasvaranews — property lama tetap sebagai arsip                             |
| **Tracking mode**          | **Hybrid** — browser untuk event interaksi, server (Measurement Protocol) untuk view artikel   |
| **Looker Studio**          | Staging: akun mp. Production: akun arasvaranews                                                |
| **Pendekatan**             | **Bertahap** — validasi di staging (mp) dulu, cutover production (arasvaranews) setelah stabil |

### Kenapa Property baru, bukan modifikasi property lama?

- Custom Dimensions di GA4 **tidak bisa diubah nama/scope** setelah dibuat — harus diganti dengan yang baru
- Skema event baru (tag per-dimension, reading_time, dll.) akan membuat laporan lama tidak konsisten
- Property lama di **arasvaranews** tetap bisa diakses untuk referensi historis di Looker Studio
- Zero risk: tidak ada data lama yang hilang

### Kenapa staging pakai akun mp, production pakai arasvaranews?

- Staging terisolasi — traffic uji tidak mengotori GA/Firebase production
- Production tetap di akun resmi brand (`arasvaranews`) — Looker Studio historis & baru dalam satu organisasi
- Firebase staging (mp) terpisah dari FCM production — push test aman

---

## 3. Skema Event GA4 Lengkap

### 3.1 Event yang dipertahankan + diperluas

#### `view_article` (diperluas)

Event paling penting. Dikirim **hybrid**: browser saat halaman load + server via Measurement Protocol saat `/api/analytics/view-article` diterima.

**Parameter saat ini yang dipertahankan:**

| Parameter        | Tipe   | Contoh                      |
| ---------------- | ------ | --------------------------- |
| `article_id`     | string | `"683abc..."`               |
| `article_slug`   | string | `"judul-artikel-panjang"`   |
| `article_title`  | string | `"Judul Artikel"`           |
| `author_id`      | string | `"683def..."`               |
| `author_name`    | string | `"Budi Santoso"`            |
| `editor_id`      | string | `"683abc..."` (kosong jika tanpa editor) |
| `editor_name`    | string | `"Siti Editor"`             |
| `editor_slug`    | string | `"siti-editor"`             |
| `category_id`    | string | `"683ghi..."`               |
| `category_name`  | string | `"Politik"`                 |
| `category_slug`  | string | `"politik"`                 |
| `article_format` | string | `"STANDARD"` \| `"GALLERY"` |
| `is_breaking`    | string | `"true"` \| `"false"`       |
| `is_headline`    | string | `"true"` \| `"false"`       |
| `content_page`   | string | `"1"` \| `"all"`            |

**Parameter BARU yang ditambahkan:**

| Parameter             | Tipe   | Keterangan                                                         |
| --------------------- | ------ | ------------------------------------------------------------------ |
| `tag_1`               | string | Tag pertama artikel (bukan CSV lagi)                               |
| `tag_2`               | string | Tag kedua artikel                                                  |
| `tag_3`               | string | Tag ketiga artikel                                                 |
| `article_age_days`    | number | Hari sejak `publishedAt` — untuk analisis longevity konten         |
| `word_count`          | number | Jumlah kata artikel — proxy untuk panjang konten                   |
| `has_video`           | string | `"true"` / `"false"` — apakah ada embed video                      |
| `has_gallery`         | string | `"true"` / `"false"` — format gallery                              |
| `publish_hour`        | number | Jam publish (0–23) — untuk analisis waktu terbaik                  |
| `publish_day_of_week` | string | `"Senin"` s.d. `"Minggu"`                                          |
| `user_type`           | string | `"logged_in"` \| `"guest"`                                         |
| `referrer_type`       | string | `"direct"` \| `"search"` \| `"social"` \| `"push"` \| `"internal"` |
| `session_source`      | string | `"push_notification"` \| `"organic"` \| ...                        |

> **Catatan `tag_names`**: parameter CSV lama (`tag_names`) **dihapus** dari property baru. Diganti dengan `tag_1`, `tag_2`, `tag_3`. GA4 hanya mendukung 25 custom parameter per event — pilih 3 tag teratas sudah cukup untuk analisis.

---

#### `page_view` (tidak berubah)

Sudah baik. Tetap dikirim via `GaRouteTracker` untuk semua halaman publik selain `/admin-xyz` dan `/login`.

---

### 3.2 Event baru yang ditambahkan

#### `article_read_complete` — Scroll Depth

Dikirim saat user mencapai **80% scroll** ke bawah pada halaman artikel. Ini indikator terbaik bahwa artikel benar-benar dibaca.

| Parameter              | Nilai                                             |
| ---------------------- | ------------------------------------------------- |
| `article_id`           |                                                   |
| `article_slug`         |                                                   |
| `article_title`        |                                                   |
| `category_name`        |                                                   |
| `article_format`       |                                                   |
| `editor_id`            | Kosong jika artikel tanpa editor                  |
| `editor_name`          |                                                   |
| `editor_slug`          |                                                   |
| `scroll_depth`         | `80` (angka fixed, penanda threshold)             |
| `time_on_page_seconds` | Detik sejak halaman di-load sampai trigger scroll |

> **Rata-rata lama baca**: hitung dari `time_on_page_seconds` di laporan Looker Studio, bukan dikirim per-event. Rata-rata diambil dari agregasi event ini.

---

#### `article_share` — Share Artikel

Dikirim saat user klik tombol share (WhatsApp, Twitter/X, Facebook, copy link, dll.).

| Parameter       | Nilai                                                                     |
| --------------- | ------------------------------------------------------------------------- |
| `share_method`  | `"whatsapp"` \| `"twitter"` \| `"facebook"` \| `"copy_link"` \| `"other"` |
| `article_id`    |                                                                           |
| `article_slug`  |                                                                           |
| `article_title` |                                                                           |
| `category_name` |                                                                           |

---

#### `select_content` — Klik Headline / Card Artikel

Menggunakan nama event GA4 standar `select_content` agar kompatibel dengan laporan GA default.

| Parameter        | Nilai                                                                                                                 |
| ---------------- | --------------------------------------------------------------------------------------------------------------------- |
| `content_type`   | `"article"`                                                                                                           |
| `content_id`     | `article_id`                                                                                                          |
| `article_title`  |                                                                                                                       |
| `article_slug`   |                                                                                                                       |
| `category_name`  |                                                                                                                       |
| `click_location` | `"homepage_headline"` \| `"homepage_card"` \| `"category_listing"` \| `"sidebar"` \| `"related"` \| `"search_result"` |
| `position`       | number — urutan kartu di listing (1, 2, 3, ...)                                                                       |

---

#### `search` — Site Search

Menggunakan nama event GA4 standar `search`.

| Parameter       | Nilai                                   |
| --------------- | --------------------------------------- |
| `search_term`   | string — query yang diketik user        |
| `results_count` | number — jumlah hasil yang dikembalikan |

---

#### `ad_impression` — Impresi Banner Iklan

| Parameter       | Nilai                                                                    |
| --------------- | ------------------------------------------------------------------------ |
| `ad_id`         | ID iklan dari MongoDB                                                    |
| `ad_position`   | `"headline"` \| `"sidebar"` \| `"popular"` \| ... (sesuai `AdsPosition`) |
| `ad_size`       | `"728x90"` \| `"9:16"` \| ...                                            |
| `ad_sponsor`    | Nama sponsor (jika ada)                                                  |
| `page_location` | URL halaman                                                              |

---

#### `ad_click` — Klik Banner Iklan

| Parameter            | Nilai            |
| -------------------- | ---------------- |
| `ad_id`              |                  |
| `ad_position`        |                  |
| `ad_size`            |                  |
| `ad_sponsor`         |                  |
| `ad_destination_url` | URL tujuan iklan |

---

#### `push_open` — Push Notification Dibuka

Dikirim dari halaman yang dibuka via push notification (deteksi dari URL query param `?ref=push` atau referrer dari service worker).

| Parameter            | Nilai                          |
| -------------------- | ------------------------------ |
| `notification_id`    | ID notifikasi                  |
| `notification_title` | Judul notifikasi               |
| `article_id`         | Artikel yang dituju (jika ada) |
| `category_name`      |                                |

---

#### `author_profile_view` — Kunjungan Profil Penulis

| Parameter     | Nilai |
| ------------- | ----- |
| `author_id`   |       |
| `author_name` |       |
| `author_slug` |       |

---

### 3.3 Custom Definitions — daftar lengkap untuk GA4 Admin

Daftarkan di **Admin → Custom Definitions** pada property staging (mp) dulu, lalu replikasi identik ke property production v2 (arasvaranews) saat cutover.

#### 3.3.1 Custom Dimensions (Event scope)

| Nama Dimension      | Parameter             | Event utama                                                                             | Prioritas |
| ------------------- | --------------------- | --------------------------------------------------------------------------------------- | --------- |
| Article ID          | `article_id`          | `view_article`, `article_read_complete`, `article_share`, `select_content`, `push_open` | Wajib     |
| Article Slug        | `article_slug`        | `view_article`, `article_read_complete`, `article_share`, `select_content`              | Wajib     |
| Article Title       | `article_title`       | `view_article`, `article_read_complete`, `article_share`, `select_content`              | Wajib     |
| Article Format      | `article_format`      | `view_article`, `article_read_complete`                                                 | Wajib     |
| Author ID           | `author_id`           | `view_article`, `author_profile_view`                                                   | Wajib     |
| Author Name         | `author_name`         | `view_article`, `author_profile_view`                                                   | Wajib     |
| Author Slug         | `author_slug`         | `author_profile_view`                                                                   | Fase 2    |
| Editor ID           | `editor_id`           | `view_article`, `article_read_complete`                                                 | Wajib     |
| Editor Name         | `editor_name`         | `view_article`, `article_read_complete`                                                 | Wajib     |
| Editor Slug         | `editor_slug`         | `view_article`, `article_read_complete`                                                 | Wajib     |
| Category ID         | `category_id`         | `view_article`                                                                          | Wajib     |
| Category Name       | `category_name`       | `view_article`, `article_read_complete`, `article_share`, `select_content`, `push_open` | Wajib     |
| Category Slug       | `category_slug`       | `view_article`                                                                          | Wajib     |
| Tag 1               | `tag_1`               | `view_article`                                                                          | Wajib     |
| Tag 2               | `tag_2`               | `view_article`                                                                          | Wajib     |
| Tag 3               | `tag_3`               | `view_article`                                                                          | Wajib     |
| Is Breaking         | `is_breaking`         | `view_article`                                                                          | Wajib     |
| Is Headline         | `is_headline`         | `view_article`                                                                          | Wajib     |
| Content Page        | `content_page`        | `view_article`                                                                          | Wajib     |
| Has Video           | `has_video`           | `view_article`                                                                          | Wajib     |
| Has Gallery         | `has_gallery`         | `view_article`                                                                          | Wajib     |
| Publish Day of Week | `publish_day_of_week` | `view_article`                                                                          | Wajib     |
| User Type           | `user_type`           | `view_article`                                                                          | Wajib     |
| Referrer Type       | `referrer_type`       | `view_article`                                                                          | Wajib     |
| Session Source      | `session_source`      | `view_article`                                                                          | Wajib     |
| Scroll Depth        | `scroll_depth`        | `article_read_complete`                                                                 | Fase 2    |
| Share Method        | `share_method`        | `article_share`                                                                         | Fase 2    |
| Content Type        | `content_type`        | `select_content`                                                                        | Fase 2    |
| Click Location      | `click_location`      | `select_content`                                                                        | Fase 2    |
| Search Term         | `search_term`         | `search`                                                                                | Fase 2    |
| Ad ID               | `ad_id`               | `ad_impression`, `ad_click`                                                             | Fase 3    |
| Ad Position         | `ad_position`         | `ad_impression`, `ad_click`                                                             | Fase 3    |
| Ad Size             | `ad_size`             | `ad_impression`, `ad_click`                                                             | Fase 3    |
| Ad Sponsor          | `ad_sponsor`          | `ad_impression`, `ad_click`                                                             | Fase 3    |
| Ad Destination URL  | `ad_destination_url`  | `ad_click`                                                                              | Fase 3    |
| Notification ID     | `notification_id`     | `push_open`                                                                             | Fase 3    |
| Notification Title  | `notification_title`  | `push_open`                                                                             | Fase 3    |

**Total: 34 Custom Dimensions** — masih di bawah batas 50 (GA4 free tier).

> **Catatan `content_id` di `select_content`:** GA4 event standar memakai `content_type` + `item_id`. Di implementasi kode, isi `item_id` dengan `article_id` — tidak perlu dimension terpisah selama `article_id` sudah terdaftar.

#### 3.3.2 Custom Metrics (Event scope)

Parameter numerik lebih tepat sebagai **Custom Metric** agar bisa di-aggregate (AVG, SUM) di Looker Studio.

| Nama Metric            | Parameter              | Event utama             | Tipe    |
| ---------------------- | ---------------------- | ----------------------- | ------- |
| Article Age Days       | `article_age_days`     | `view_article`          | Integer |
| Word Count             | `word_count`           | `view_article`          | Integer |
| Publish Hour           | `publish_hour`         | `view_article`          | Integer |
| Time on Page (seconds) | `time_on_page_seconds` | `article_read_complete` | Integer |
| Click Position         | `position`             | `select_content`        | Integer |
| Search Results Count   | `results_count`        | `search`                | Integer |

**Total: 6 Custom Metrics** — masih di bawah batas 50.

#### 3.3.3 Parameter built-in — tidak perlu Custom Definition

GA4 sudah menangani parameter ini secara native (terutama pada `page_view`):

| Parameter       | Dipakai di                                   |
| --------------- | -------------------------------------------- |
| `page_path`     | `page_view`, `view_article`                  |
| `page_location` | `page_view`, `view_article`, `ad_impression` |
| `page_title`    | `page_view`, `view_article`                  |

Jangan daftarkan sebagai Custom Dimension kecuali ingin memakainya di event non-pageview dengan laporan khusus.

#### 3.3.4 Urutan pendaftaran (staging)

**Batch 1 — sebelum deploy Fase 1** (semua parameter `view_article`):

`article_id`, `article_slug`, `article_title`, `article_format`, `author_id`, `author_name`, `editor_id`, `editor_name`, `editor_slug`, `category_id`, `category_name`, `category_slug`, `tag_1`, `tag_2`, `tag_3`, `is_breaking`, `is_headline`, `content_page`, `has_video`, `has_gallery`, `publish_day_of_week`, `user_type`, `referrer_type`, `session_source` + metrics: `article_age_days`, `word_count`, `publish_hour`

**Batch 2 — Fase 2–3 interaksi:**

`scroll_depth`, `share_method`, `content_type`, `click_location`, `search_term` + metrics: `time_on_page_seconds`, `position`, `results_count`

**Batch 3 — Fase 4 ads & push:**

`ad_id`, `ad_position`, `ad_size`, `ad_sponsor`, `ad_destination_url`, `notification_id`, `notification_title`, `author_slug`

#### 3.3.5 Ringkasan kuota GA4

| Tipe                      | Terpakai            | Batas (free) |
| ------------------------- | ------------------- | ------------ |
| Custom Dimensions (Event) | 37                  | 50           |
| Custom Metrics (Event)    | 6                   | 50           |
| Parameter per event       | `view_article` ≈ 25 | 25           |

> Setelah didaftarkan di property staging (mp), **copy konfigurasi identik** ke property production v2 (arasvaranews) saat cutover — nama parameter harus sama persis dengan yang dikirim dari kode.

#### 3.3.6 Bulk register via script

Registry & script ada di repo:

| File | Fungsi |
| --- | --- |
| `scripts/ga-custom-definitions.registry.ts` | Daftar 34 dimensions + 6 metrics (single source of truth) |
| `scripts/register-ga-custom-definitions.ts` | CLI bulk create via Google Analytics Admin API |

**Prasyarat:**

1. Enable **Google Analytics Admin API** di Google Cloud Console
2. Auth: `gcloud auth application-default login` (login akun `mp.webekspres@gmail.com`)  
   atau service account dengan role **Editor** di GA4 property
3. Isi `GA4_PROPERTY_ID` di `.env.staging` — angka dari GA Admin → Property settings (bukan `G-XXXXXXXX`)

**Perintah:**

```bash
# Lihat yang sudah terdaftar
npm run ga:register-definitions -- --env-file=.env.staging --list-existing

# Dry-run batch 1 (view_article)
npm run ga:register-definitions -- --env-file=.env.staging --batch=1 --dry-run

# Daftarkan batch 1 ke property staging
npm run ga:register-definitions -- --env-file=.env.staging --batch=1

# Semua sekaligus
npm run ga:register-definitions -- --env-file=.env.staging --batch=all
```

Script otomatis **skip** definisi yang sudah ada (tidak error duplicate).

---

## 4. Strategi Hybrid Tracking (Browser + Server)

### Kenapa Hybrid?

| Masalah                                   | Solusi                                                            |
| ----------------------------------------- | ----------------------------------------------------------------- |
| Adblock/Privacy browser memblokir gtag.js | Server-side Measurement Protocol tidak terpengaruh                |
| Bot/crawler men-trigger page view         | Server bisa filter berdasarkan `user_agent`                       |
| Data lebih akurat untuk view artikel      | Server menerima POST `/api/analytics/view-article` yang sudah ada |

### Alur Hybrid

```
User buka artikel
      │
      ├──► [Browser] useArticleTracking → gtag view_article  (cepat, interaktif)
      │
      └──► [Browser] POST /api/analytics/view-article (existing)
                │
                └──► [Server Node.js] Measurement Protocol → GA4
                      (filter bot, deduplikasi, lebih reliable)
```

Event interaksi (scroll, klik, share, search) tetap **browser-only** karena membutuhkan konteks DOM.

### Implementasi Measurement Protocol

```
POST https://www.google-analytics.com/mp/collect
  ?measurement_id=G-XXXXXXX
  &api_secret=<MP_API_SECRET>

Body:
{
  "client_id": "<anonymous_client_id>",
  "user_id": "<userId jika login>",
  "events": [{
    "name": "view_article",
    "params": {
      "article_id": "...",
      ... semua parameter skema baru
    }
  }]
}
```

`client_id` dikirim dari browser via cookie `_ga` (`GA1.X.XXXXXXXXXX.XXXXXXXXXX`) — ekstrak dari `document.cookie` di sisi client, simpan di `localStorage` atau kirim sebagai header request ke `/api/analytics/view-article`.

---

## 5. Strategi Migrasi (Property Lama → Property Baru)

### Dua fase, dua akun

```
STAGING (mp.webekspres@gmail.com)
  Property: Arasvara Staging
  ├── Validasi skema event baru
  ├── Refactor kode + DebugView
  └── Looker Studio uji

PRODUCTION (arasvaranews@gmail.com) — setelah staging stabil
  Property Lama ────────────── tetap aktif (arsip historis)
  Property v2 (baru) ────────── terima traffic arasvara.id
  Firebase arasvara-14a8c ───── tidak berubah
  Looker Studio resmi ────────── connect ke property v2
```

### Paralel Running Period (production)

```
Timeline:
Sekarang          Fase staging       Fase cutover
   │                    │                  │
   ▼                    ▼                  ▼
[Property Lama]────────────────────── tetap aktif (arasvaranews)
                  [Staging mp] ────── validasi skema
                                     [Property v2] ── traffic prod baru
```

- **Minggu 1–4**: Staging di akun mp — validasi skema, refactor kode
- **Minggu 5+**: Buat property v2 di arasvaranews, copy konfigurasi dari staging
- **Cutover**: Ganti `NEXT_PUBLIC_GA_MEASUREMENT_ID` di Vercel production saja
- **Property lama**: tidak dihapus — tetap untuk laporan historis

### Cara cutover production tanpa mematikan property lama

Hanya di **Vercel production** (`arasvara.id`):

```typescript
// Ganti measurement ID ke property v2 (arasvaranews)
// Property lama TIDAK menerima traffic baru setelah cutover
gtag("config", "G-PRODUCTION_V2_ID", { send_page_view: false });
```

Semua custom event (`view_article`, `select_content`, dll.) dikirim ke property v2:

```typescript
window.gtag("event", "view_article", {
  send_to: "G-PRODUCTION_V2_ID",
  ...params,
});
```

**Staging** tetap pakai measurement ID property staging (akun mp) — tidak terpengaruh cutover production.

> **Catatan:** Tidak perlu load dua gtag stream di production kecuali ingin periode paralel singkat untuk bandingkan hit count staging vs v2.

---

## 6. Rencana Implementasi Bertahap

### Fase 1 — Setup & Foundation (Estimasi: 1–2 minggu)

**Tujuan**: Property staging (mp) siap, infrastruktur tracking terpasang di Vercel staging.

**Langkah:**

1. **Buat GA4 Property staging** di `mp.webekspres@gmail.com`
   - Nama: `Arasvara Staging`
   - Timezone: Asia/Jakarta
   - Data stream: `https://staging-arasvara.vercel.app`

2. **Setup Firebase staging** di akun `mp.webekspres@gmail.com`
   - FCM + VAPID key
   - Isi semua `NEXT_PUBLIC_FIREBASE_*` + `FIREBASE_SERVICE_ACCOUNT` di `.env.staging`

3. **Daftarkan Custom Definitions** di property staging — 34 dimensions + 6 metrics (lihat §3.3; Batch 1 dulu)

4. **Buat `MP_API_SECRET`** → `GA_MP_API_SECRET` di `.env.staging`

5. **Update `src/lib/google-analytics.ts`** (deploy ke staging dulu):
   - Tambah `tag_1`, `tag_2`, `tag_3` (gantikan `tag_names` CSV)
   - Tambah parameter baru (`article_age_days`, `word_count`, dll.)
   - Tambah `send_to` parameter ke semua event

6. **Buat `src/lib/measurement-protocol.ts`** — helper server-side

7. **Update `/api/analytics/view-article`** — Measurement Protocol call

**Env staging (`.env.staging` / Vercel staging):**

| Variabel                        | Sumber                         |
| ------------------------------- | ------------------------------ |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Property staging — akun **mp** |
| `GA_MP_API_SECRET`              | Property staging — akun **mp** |
| `NEXT_PUBLIC_FIREBASE_*`        | Firebase project — akun **mp** |
| `FIREBASE_SERVICE_ACCOUNT`      | Service account — akun **mp**  |

**Production belum diubah** pada fase ini.

**File yang diubah:**

- `src/lib/google-analytics.ts`
- `src/lib/measurement-protocol.ts` (baru)
- `src/app/api/analytics/view-article/route.ts`
- `src/app/layout.tsx`
- `.env.staging` / Vercel staging env

---

### Fase 2 — Scroll Depth & Reading Time (Estimasi: 1 minggu)

**Tujuan**: Bisa mengukur rata-rata lama baca dan completion rate artikel.

**Langkah:**

1. **Buat `src/hooks/useScrollDepth.ts`** — IntersectionObserver yang mendeteksi elemen "akhir artikel" masuk viewport, catat `time_on_page_seconds` sejak mount

2. **Kirim event `article_read_complete`** saat threshold 80% tercapai (sekali per artikel per sesi)

3. **Tambah marker elemen** di `NewsDetailClient.tsx` — `<div id="article-end-marker" />` di bawah konten artikel

4. **Update `useArticleTracking.ts`** — integrasikan `useScrollDepth`

**File yang diubah:**

- `src/hooks/useScrollDepth.ts` (baru)
- `src/hooks/useArticleTracking.ts`
- `src/lib/google-analytics.ts`
- Komponen artikel detail

---

### Fase 3 — Event Interaksi (Estimasi: 1–2 minggu)

**Tujuan**: Tracking klik headline, share, dan search.

**3a. Klik headline (`select_content`)**

1. Buat `src/lib/ga-events.ts` — centralized helper untuk semua event baru
2. Tambah `onClick` handler di komponen card artikel (homepage, listing, sidebar, related)
3. Kirim `select_content` dengan `click_location` dan `position`

**Komponen yang perlu diupdate**: card artikel di homepage, category listing, sidebar, related articles section.

**3b. Share artikel (`article_share`)**

1. Tambah tracking di tombol-tombol share yang sudah ada
2. Kirim `article_share` dengan `share_method`

**3c. Site search (`search`)**

1. Tambah tracking di submit form search
2. Kirim `search` dengan `search_term` dan `results_count`

**File yang diubah:**

- `src/lib/ga-events.ts` (baru)
- Komponen card artikel (beberapa file)
- Komponen share button
- Komponen search

---

### Fase 4 — Ads & Push Analytics (Estimasi: 1–2 minggu)

**Tujuan**: Data iklan dan push notification masuk GA.

**4a. Ads (`ad_impression`, `ad_click`)**

1. Buat `useAdTracking` hook — IntersectionObserver untuk deteksi banner masuk viewport → `ad_impression`
2. Tambah `onClick` handler di komponen banner → `ad_click`
3. Event ini **tidak** menggantikan `ad_click_events` di MongoDB (tetap berjalan paralel)

**4b. Push Notification (`push_open`)**

1. Deteksi URL parameter `?ref=push&notif_id=XXX` di `NewsDetailClient`
2. Kirim `push_open` event ke GA
3. Hubungkan juga API `/api/analytics/push/open` yang sudah ada tapi belum terhubung

**4c. Author Profile (`author_profile_view`)**

1. Tambah tracking di komponen `/author/[slug]` — page load → `author_profile_view`

---

### Fase 5 — Looker Studio Setup (Estimasi: 3–5 hari)

**Tujuan**: Dashboard Looker Studio siap — staging dulu, production nanti.

**Staging (akun mp.webekspres):**

1. Login Looker Studio dengan akun **mp**
2. Connect ke property **Arasvara Staging**
3. Bangun 9 halaman laporan (tabel di bawah)
4. Validasi minimal 7 hari data staging

**Production (akun arasvaranews) — setelah cutover:**

1. Login Looker Studio dengan akun **arasvaranews**
2. Connect ke property **Production v2**
3. Replikasi struktur laporan dari staging
4. Property lama tetap tersedia untuk laporan historis terpisah

**Laporan yang direkomendasikan:**

| Laporan            | Metrik utama                                | Dimensi                                   |
| ------------------ | ------------------------------------------- | ----------------------------------------- |
| Overview Traffic   | Sessions, Users, Views                      | Date, Channel                             |
| Konten Terbaik     | `view_article` count                        | article_title, category_name, author_name |
| Analisis Tag       | `view_article` count                        | tag_1, tag_2, tag_3                       |
| Engagement Artikel | avg `time_on_page_seconds`, completion rate | article_title, category_name, word_count  |
| Share & Virality   | `article_share` count                       | share_method, article_title               |
| Performa Iklan     | `ad_impression`, `ad_click`, CTR            | ad_position, ad_sponsor                   |
| Push Analytics     | `push_open` count, push-to-view rate        | article_title, notification_title         |
| Konten Discovery   | `select_content` count                      | click_location, article_title             |
| Search Analytics   | `search` count                              | search_term, results_count                |

**Setup:**

1. Connect Looker Studio → GA4 property yang sesuai environment
2. Buat 9 halaman report (satu per tabel di atas)
3. Tambah filter global: date range, category, format

---

### Fase 6 — Cutover Production (Estimasi: 1–2 hari) — setelah staging stabil

**Tujuan**: `arasvara.id` mengirim event ke property v2 di akun arasvaranews.

**Langkah:**

1. Login `arasvaranews@gmail.com` → buat property **Arasvara Production v2**
2. Copy custom dimensions & event schema identik dengan staging (mp)
3. Buat data stream `https://arasvara.id` + Measurement Protocol API Secret
4. Update **Vercel production** env:
   - `NEXT_PUBLIC_GA_MEASUREMENT_ID` → `G-...` property v2
   - `GA_MP_API_SECRET` → secret property v2
   - Firebase **tidak diubah** (`arasvara-14a8c`)
5. Deploy production → validasi Realtime
6. Looker Studio production → connect property v2 (arasvaranews)
7. Property lama arasvaranews tetap aktif sebagai arsip

---

## 7. Hal-hal Penting Lainnya yang Perlu Diketahui

### 7.1 Batas GA4 Free Tier

| Batasan                         | Nilai                 | Status kita                     |
| ------------------------------- | --------------------- | ------------------------------- |
| Custom Dimensions (Event scope) | 50                    | 34 dipakai — aman               |
| Custom Metrics (Event scope)    | 50                    | 6 dipakai — aman                |
| Custom Metrics                  | 50                    | Belum ada                       |
| Event parameter per event       | 25                    | `view_article` baru ≈ 20 — aman |
| Events per session              | Tidak terbatas di GA4 | Aman                            |
| Data retention default          | 2 bulan               | **Ubah ke 14 bulan di Admin**   |

> **Penting**: Ubah Data Retention ke 14 bulan di GA4 Admin → Data Settings → Data Retention. Default 2 bulan akan membuat data historis hilang dari Looker Studio.

### 7.2 Privasi & GDPR / UU PDP Indonesia

- Jangan kirim data PII (email, nama lengkap user) ke GA
- `user_type` boleh dikirim (`logged_in` / `guest`), tapi bukan `userId` yang PII
- Jika ada cookie consent banner di masa depan, pastikan gtag hanya load setelah consent
- IP Anonymization: di GA4 sudah default ON (tidak perlu konfigurasi tambahan)

### 7.3 Deduplikasi View (Browser + Server)

Karena `view_article` dikirim dua kali (browser via gtag + server via Measurement Protocol), di GA4 akan ada potensi double-count. Solusi:

- Kirim **hanya dari server** untuk `view_article` (Measurement Protocol), **matikan** `trackArticleView()` dari browser untuk event ini
- Atau: pisahkan nama event — browser kirim `view_article_browser`, server kirim `view_article` — lalu di Looker Studio pakai `view_article` saja sebagai acuan

Rekomendasi: **Server-only untuk `view_article`**, browser tetap untuk event interaksi.

### 7.4 Dead Code yang Sebaiknya Dibersihkan

Bersamaan dengan refactor ini, ada beberapa hal yang perlu dibersihkan:

- `src/app/api/analytics/pageview/route.ts` — tidak ada consumer, tulis di `page_views` collection yang tidak pernah dibaca
- `src/lib/ga-article-tracking.ts` — hanya re-export, tidak perlu ada
- Mock data di `editorInChiefService.ts` (top authors/editors dan `trendingRate`) — sebaiknya diganti data nyata

### 7.5 Verifikasi Data

Setelah property baru aktif, verifikasi dengan:

1. **GA4 DebugView** (Admin → DebugView) — set `?gtm_debug=1` di URL atau aktifkan GA4 debug extension Chrome
2. **Realtime Report** — cek event masuk dalam 30 detik
3. **BigQuery Export** (opsional, gratis untuk GA4) — enable di GA4 Admin → BigQuery Linking untuk raw event data yang lebih fleksibel dari Looker Studio

---

## 8. Ringkasan Prioritas

| Fase                             | Environment | Akun          | Waktu           | Nilai         |
| -------------------------------- | ----------- | ------------- | --------------- | ------------- |
| Fase 1: Setup GA + Firebase + MP | Staging     | mp.webekspres | 1–2 minggu      | Sangat Tinggi |
| Fase 2: Scroll Depth             | Staging     | mp            | 1 minggu        | Tinggi        |
| Fase 3: Event interaksi          | Staging     | mp            | 1–2 minggu      | Tinggi        |
| Fase 4: Ads & Push               | Staging     | mp            | 1–2 minggu      | Sedang        |
| Fase 5: Looker Studio uji        | Staging     | mp            | 3–5 hari        | Tinggi        |
| Fase 6: Cutover production       | Production  | arasvaranews  | 1–2 hari        | Sangat Tinggi |
| Fase 5b: Looker Studio resmi     | Production  | arasvaranews  | 3–5 hari        | Tinggi        |
| **Total estimasi**               |             |               | **~7–9 minggu** |               |

---

## 9. Checklist Sebelum Mulai Implementasi

### Staging (mp.webekspres@gmail.com)

- [ ] Buat GA4 Property **Arasvara Staging** di akun mp
- [ ] Buat / setup Firebase project di akun mp (FCM + VAPID)
- [ ] Daftarkan Custom Definitions di property staging — Batch 1 (21 dim + 3 metrics), lalu Batch 2–3
- [ ] Generate Measurement Protocol API Secret → `GA_MP_API_SECRET`
- [ ] Isi `.env.staging` — semua `NEXT_PUBLIC_FIREBASE_*` + GA dari akun mp
- [ ] Deploy ke Vercel staging project
- [ ] Ubah Data Retention ke 14 bulan di property staging
- [ ] Tes DebugView di staging sebelum refactor kode

### Production (arasvaranews@gmail.com) — setelah staging stabil

- [ ] Buat GA4 Property **Arasvara Production v2** di akun arasvaranews
- [ ] Copy custom dimensions & schema identik dengan staging
- [ ] Generate MP API Secret untuk property v2
- [ ] Update Vercel production env (`NEXT_PUBLIC_GA_MEASUREMENT_ID`, `GA_MP_API_SECRET`)
- [ ] Pastikan Firebase production (`arasvara-14a8c`) **tidak berubah**
- [ ] Property lama arasvaranews tetap aktif (arsip)
- [ ] Looker Studio production connect ke property v2
- [ ] Buat Looker Studio report setelah data prod v2 masuk minimal 7 hari
