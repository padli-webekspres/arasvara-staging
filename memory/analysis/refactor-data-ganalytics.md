# Strategi Integrasi & Refactor Google Analytics — Arasvara

> Disusun: 29 Juni 2026
> Scope: GA4 Property baru, skema event lengkap, Hybrid tracking (browser + server Measurement Protocol), Looker Studio

---

## 1. Kondisi Saat Ini

### Apa yang sudah ada

| Layer | Status |
|---|---|
| GA4 gtag.js dimuat di `layout.tsx` | ✅ Aktif |
| `page_view` per SPA navigation via `GaRouteTracker` | ✅ Aktif |
| `view_article` dengan 15 custom parameter dari `google-analytics.ts` | ✅ Aktif |
| MongoDB `article_views` per sesi dari `/api/analytics/view-article` | ✅ Aktif |
| Custom Dimensions terdaftar di GA4 Admin | ❓ Perlu dicek manual |
| Headline click, share, search, scroll depth | ❌ Belum ada |
| Ads impression/click di GA | ❌ Belum ada (hanya MongoDB `ad_click_events`) |
| Push notification di GA | ❌ Belum ada (API ada, tidak terhubung) |
| Author profile visit di GA | ❌ Belum ada |
| Measurement Protocol (server-side) | ❌ Belum ada |

### Kelemahan skema event saat ini

1. **`view_article` tidak ada `reading_time`** — tidak bisa tahu rata-rata lama baca
2. **Unique visitor lemah** — `sessionId` dari JWT token, bukan dedicated anonymous ID
3. **Tag dikirim sebagai string CSV** (`"Politik, Hukum, Ekonomi"`) — tidak bisa difilter per-tag di GA/Looker Studio
4. **Tidak ada event untuk interaksi pengguna** (klik, share, scroll)
5. **GA dan MongoDB berjalan independen** tanpa sinkronisasi — bisa terjadi selisih hitung
6. **Event hilang jika adblock** — seluruh tracking saat ini 100% client-side

---

## 2. Keputusan Arsitektur

| Keputusan | Pilihan |
|---|---|
| GA Property | **Baru** di akun yang sama — property lama tetap aktif paralel |
| Tracking mode | **Hybrid** — browser untuk event interaksi, server (Measurement Protocol) untuk view artikel |
| Looker Studio | **GA4 saja** — data MongoDB tetap di CMS internal |
| Pendekatan | **Bertahap** — kualitas > kecepatan |

### Kenapa Property baru, bukan modifikasi property lama?

- Custom Dimensions di GA4 **tidak bisa diubah nama/scope** setelah dibuat — harus diganti dengan yang baru
- Skema event baru (tag per-dimension, reading_time, dll.) akan membuat laporan lama tidak konsisten
- Property lama tetap bisa diakses untuk referensi historis di Looker Studio dengan konektor terpisah
- Zero risk: tidak ada data lama yang hilang

---

## 3. Skema Event GA4 Lengkap

### 3.1 Event yang dipertahankan + diperluas

#### `view_article` (diperluas)

Event paling penting. Dikirim **hybrid**: browser saat halaman load + server via Measurement Protocol saat `/api/analytics/view-article` diterima.

**Parameter saat ini yang dipertahankan:**

| Parameter | Tipe | Contoh |
|---|---|---|
| `article_id` | string | `"683abc..."` |
| `article_slug` | string | `"judul-artikel-panjang"` |
| `article_title` | string | `"Judul Artikel"` |
| `author_id` | string | `"683def..."` |
| `author_name` | string | `"Budi Santoso"` |
| `category_id` | string | `"683ghi..."` |
| `category_name` | string | `"Politik"` |
| `category_slug` | string | `"politik"` |
| `article_format` | string | `"STANDARD"` \| `"GALLERY"` |
| `is_breaking` | string | `"true"` \| `"false"` |
| `is_headline` | string | `"true"` \| `"false"` |
| `content_page` | string | `"1"` \| `"all"` |

**Parameter BARU yang ditambahkan:**

| Parameter | Tipe | Keterangan |
|---|---|---|
| `tag_1` | string | Tag pertama artikel (bukan CSV lagi) |
| `tag_2` | string | Tag kedua artikel |
| `tag_3` | string | Tag ketiga artikel |
| `article_age_days` | number | Hari sejak `publishedAt` — untuk analisis longevity konten |
| `word_count` | number | Jumlah kata artikel — proxy untuk panjang konten |
| `has_video` | string | `"true"` / `"false"` — apakah ada embed video |
| `has_gallery` | string | `"true"` / `"false"` — format gallery |
| `publish_hour` | number | Jam publish (0–23) — untuk analisis waktu terbaik |
| `publish_day_of_week` | string | `"Senin"` s.d. `"Minggu"` |
| `user_type` | string | `"logged_in"` \| `"guest"` |
| `referrer_type` | string | `"direct"` \| `"search"` \| `"social"` \| `"push"` \| `"internal"` |
| `session_source` | string | `"push_notification"` \| `"organic"` \| ... |

> **Catatan `tag_names`**: parameter CSV lama (`tag_names`) **dihapus** dari property baru. Diganti dengan `tag_1`, `tag_2`, `tag_3`. GA4 hanya mendukung 25 custom parameter per event — pilih 3 tag teratas sudah cukup untuk analisis.

---

#### `page_view` (tidak berubah)

Sudah baik. Tetap dikirim via `GaRouteTracker` untuk semua halaman publik selain `/admin-xyz` dan `/login`.

---

### 3.2 Event baru yang ditambahkan

#### `article_read_complete` — Scroll Depth

Dikirim saat user mencapai **80% scroll** ke bawah pada halaman artikel. Ini indikator terbaik bahwa artikel benar-benar dibaca.

| Parameter | Nilai |
|---|---|
| `article_id` | |
| `article_slug` | |
| `article_title` | |
| `category_name` | |
| `article_format` | |
| `scroll_depth` | `80` (angka fixed, penanda threshold) |
| `time_on_page_seconds` | Detik sejak halaman di-load sampai trigger scroll |

> **Rata-rata lama baca**: hitung dari `time_on_page_seconds` di laporan Looker Studio, bukan dikirim per-event. Rata-rata diambil dari agregasi event ini.

---

#### `article_share` — Share Artikel

Dikirim saat user klik tombol share (WhatsApp, Twitter/X, Facebook, copy link, dll.).

| Parameter | Nilai |
|---|---|
| `share_method` | `"whatsapp"` \| `"twitter"` \| `"facebook"` \| `"copy_link"` \| `"other"` |
| `article_id` | |
| `article_slug` | |
| `article_title` | |
| `category_name` | |

---

#### `select_content` — Klik Headline / Card Artikel

Menggunakan nama event GA4 standar `select_content` agar kompatibel dengan laporan GA default.

| Parameter | Nilai |
|---|---|
| `content_type` | `"article"` |
| `content_id` | `article_id` |
| `article_title` | |
| `article_slug` | |
| `category_name` | |
| `click_location` | `"homepage_headline"` \| `"homepage_card"` \| `"category_listing"` \| `"sidebar"` \| `"related"` \| `"search_result"` |
| `position` | number — urutan kartu di listing (1, 2, 3, ...) |

---

#### `search` — Site Search

Menggunakan nama event GA4 standar `search`.

| Parameter | Nilai |
|---|---|
| `search_term` | string — query yang diketik user |
| `results_count` | number — jumlah hasil yang dikembalikan |

---

#### `ad_impression` — Impresi Banner Iklan

| Parameter | Nilai |
|---|---|
| `ad_id` | ID iklan dari MongoDB |
| `ad_position` | `"headline"` \| `"sidebar"` \| `"popular"` \| ... (sesuai `AdsPosition`) |
| `ad_size` | `"728x90"` \| `"9:16"` \| ... |
| `ad_sponsor` | Nama sponsor (jika ada) |
| `page_location` | URL halaman |

---

#### `ad_click` — Klik Banner Iklan

| Parameter | Nilai |
|---|---|
| `ad_id` | |
| `ad_position` | |
| `ad_size` | |
| `ad_sponsor` | |
| `ad_destination_url` | URL tujuan iklan |

---

#### `push_open` — Push Notification Dibuka

Dikirim dari halaman yang dibuka via push notification (deteksi dari URL query param `?ref=push` atau referrer dari service worker).

| Parameter | Nilai |
|---|---|
| `notification_id` | ID notifikasi |
| `notification_title` | Judul notifikasi |
| `article_id` | Artikel yang dituju (jika ada) |
| `category_name` | |

---

#### `author_profile_view` — Kunjungan Profil Penulis

| Parameter | Nilai |
|---|---|
| `author_id` | |
| `author_name` | |
| `author_slug` | |

---

### 3.3 Ringkasan semua Custom Dimensions yang perlu didaftarkan di GA4 Admin

GA4 Property baru perlu mendaftarkan ini di **Admin → Custom Definitions**:

| Nama Dimension | Scope | Parameter |
|---|---|---|
| Article ID | Event | `article_id` |
| Article Slug | Event | `article_slug` |
| Article Title | Event | `article_title` |
| Article Format | Event | `article_format` |
| Author ID | Event | `author_id` |
| Author Name | Event | `author_name` |
| Category ID | Event | `category_id` |
| Category Name | Event | `category_name` |
| Category Slug | Event | `category_slug` |
| Tag 1 | Event | `tag_1` |
| Tag 2 | Event | `tag_2` |
| Tag 3 | Event | `tag_3` |
| Is Breaking | Event | `is_breaking` |
| Is Headline | Event | `is_headline` |
| Content Page | Event | `content_page` |
| Article Age Days | Event | `article_age_days` |
| Word Count | Event | `word_count` |
| Has Video | Event | `has_video` |
| Publish Hour | Event | `publish_hour` |
| Publish Day of Week | Event | `publish_day_of_week` |
| User Type | Event | `user_type` |
| Referrer Type | Event | `referrer_type` |
| Click Location | Event | `click_location` |
| Share Method | Event | `share_method` |
| Ad Position | Event | `ad_position` |
| Ad Sponsor | Event | `ad_sponsor` |
| Notification ID | Event | `notification_id` |
| Time on Page (seconds) | Event | `time_on_page_seconds` |

> GA4 Free tier batas: **50 Custom Dimensions** per property (scope Event) — skema di atas menggunakan 28, masih aman.

---

## 4. Strategi Hybrid Tracking (Browser + Server)

### Kenapa Hybrid?

| Masalah | Solusi |
|---|---|
| Adblock/Privacy browser memblokir gtag.js | Server-side Measurement Protocol tidak terpengaruh |
| Bot/crawler men-trigger page view | Server bisa filter berdasarkan `user_agent` |
| Data lebih akurat untuk view artikel | Server menerima POST `/api/analytics/view-article` yang sudah ada |

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

### Paralel Running Period

```
Timeline:
Sekarang          Fase 1          Fase 2          Fase 3
   │                │               │               │
   ▼                ▼               ▼               ▼
[Property Lama]──────────────────────────────────── tetap aktif
                [Property Baru] ─────────────────── berjalan paralel
                                [Looker Studio]───── laporan baru
                                                [Cleanup lama]
```

- **Bulan 1–2**: Property lama + baru berjalan paralel. Validasi data di property baru
- **Bulan 3+**: Property baru menjadi acuan utama. Property lama dipertahankan untuk referensi historis
- **Bulan 6+** (opsional): Property lama di-archive (tidak dihapus, hanya tidak aktif)

### Cara mengaktifkan property baru tanpa mematikan yang lama

Di `layout.tsx`, load **dua** gtag stream:

```typescript
// Property lama (read-only, tidak ubah)
gtag('config', 'G-OLD_PROPERTY_ID');

// Property baru (skema lengkap)
gtag('config', 'G-NEW_PROPERTY_ID', { send_page_view: false });
```

Namun semua custom event (`view_article`, `select_content`, dll.) hanya dikirim ke property baru dengan `send_to`:

```typescript
window.gtag('event', 'view_article', {
  send_to: 'G-NEW_PROPERTY_ID',
  ...params
});
```

Dengan ini:
- Property lama tetap menerima `page_view` (data tidak hilang)
- Property baru menerima semua event baru
- Tidak ada perubahan breaking pada property lama

---

## 6. Rencana Implementasi Bertahap

### Fase 1 — Setup & Foundation (Estimasi: 1–2 minggu)

**Tujuan**: Property baru siap, infrastruktur tracking terpasang.

**Langkah:**

1. **Buat GA4 Property baru** di Google Analytics Admin (akun yang sama)
   - Nama: `Arasvara - Analytics v2`
   - Timezone: Asia/Jakarta
   - Currency: IDR

2. **Daftarkan semua Custom Dimensions** (28 dimensions dari skema di atas) di Admin → Custom Definitions → Custom Dimensions

3. **Buat `MP_API_SECRET`** di GA4 Admin → Data Streams → Measurement Protocol API Secrets

4. **Update `NEXT_PUBLIC_GA_MEASUREMENT_ID`** ke property baru (atau tambah env baru `NEXT_PUBLIC_GA_V2_MEASUREMENT_ID`)

5. **Update `src/lib/google-analytics.ts`**:
   - Tambah `tag_1`, `tag_2`, `tag_3` (gantikan `tag_names` CSV)
   - Tambah `article_age_days`, `word_count`, `has_video`, `publish_hour`, `publish_day_of_week`, `user_type`, `referrer_type`
   - Tambah `send_to` parameter ke semua event

6. **Buat `src/lib/measurement-protocol.ts`** — helper server-side untuk kirim event ke GA4 Measurement Protocol

7. **Update `/api/analytics/view-article`** — tambah Measurement Protocol call setelah insert MongoDB

**File yang diubah:**
- `src/lib/google-analytics.ts`
- `src/lib/measurement-protocol.ts` (baru)
- `src/app/api/analytics/view-article/route.ts`
- `src/app/layout.tsx`
- `.env` / `.env.production`

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

**Tujuan**: Dashboard Looker Studio siap dipakai.

**Laporan yang direkomendasikan:**

| Laporan | Metrik utama | Dimensi |
|---|---|---|
| Overview Traffic | Sessions, Users, Views | Date, Channel |
| Konten Terbaik | `view_article` count | article_title, category_name, author_name |
| Analisis Tag | `view_article` count | tag_1, tag_2, tag_3 |
| Engagement Artikel | avg `time_on_page_seconds`, completion rate | article_title, category_name, word_count |
| Share & Virality | `article_share` count | share_method, article_title |
| Performa Iklan | `ad_impression`, `ad_click`, CTR | ad_position, ad_sponsor |
| Push Analytics | `push_open` count, push-to-view rate | article_title, notification_title |
| Konten Discovery | `select_content` count | click_location, article_title |
| Search Analytics | `search` count | search_term, results_count |

**Setup:**
1. Connect Looker Studio → GA4 (konektor native Google)
2. Buat 9 halaman report (satu per tabel di atas)
3. Tambah filter global: date range, category, format

---

## 7. Hal-hal Penting Lainnya yang Perlu Diketahui

### 7.1 Batas GA4 Free Tier

| Batasan | Nilai | Status kita |
|---|---|---|
| Custom Dimensions (Event scope) | 50 | 28 dipakai — aman |
| Custom Metrics | 50 | Belum ada |
| Event parameter per event | 25 | `view_article` baru ≈ 20 — aman |
| Events per session | Tidak terbatas di GA4 | Aman |
| Data retention default | 2 bulan | **Ubah ke 14 bulan di Admin** |

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

| Fase | Waktu | Nilai |
|---|---|---|
| Fase 1: Setup + Measurement Protocol | 1–2 minggu | Sangat Tinggi |
| Fase 2: Scroll Depth + Reading Time | 1 minggu | Tinggi |
| Fase 3a: Klik Headline | 3–5 hari | Tinggi |
| Fase 3b: Share | 2–3 hari | Sedang |
| Fase 3c: Search | 2–3 hari | Sedang |
| Fase 4a: Ads | 1 minggu | Sedang |
| Fase 4b: Push | 3–5 hari | Sedang |
| Fase 4c: Author Profile | 1–2 hari | Rendah |
| Fase 5: Looker Studio | 3–5 hari | Tinggi |
| **Total estimasi** | **~7–9 minggu** | |

---

## 9. Checklist Sebelum Mulai Implementasi

- [ ] Buat GA4 Property baru di Google Analytics Admin
- [ ] Daftarkan 28 Custom Dimensions
- [ ] Generate Measurement Protocol API Secret
- [ ] Tambah env vars: `NEXT_PUBLIC_GA_V2_MEASUREMENT_ID`, `GA_MP_API_SECRET`
- [ ] Ubah Data Retention ke 14 bulan di property baru
- [ ] Tes DebugView di property baru sebelum deploy production
- [ ] Buat Looker Studio report setelah data masuk minimal 7 hari
