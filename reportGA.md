# Laporan: Opsi Integrasi Google Analytics (GA4) untuk Data Artikel ARASVARA

**Tanggal:** 29 Mei 2026  
**Konteks:** Proyek ARASVARA — Next.js App Router, GA4 via `gtag.js`, Looker Studio sebagai alat visualisasi.  
**Tujuan:** Satu jalur integrasi ke Google Analytics agar GA dapat memproses metadata artikel (penulis, kategori, tag, format, dll.), tidak hanya URL halaman.

---

## 1. Kondisi saat ini

### 1.1 Implementasi GA4 di codebase

| Lokasi                                              | Perilaku                                                                                    |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `src/app/layout.tsx`                                | Load `gtag.js` + `gtag('config', NEXT_PUBLIC_GA_MEASUREMENT_ID)` — pageview otomatis global |
| `src/app/(public)/news/[slug]/NewsDetailClient.tsx` | `gtag('config', …, { page_path })` saat mount — tanpa metadata artikel                      |
| `memory/analytics.md`                               | Dokumentasi internal menyebut event custom, belum diimplementasi penuh                      |

### 1.2 Data artikel yang tersedia di client (belum dikirim ke GA)

Objek `article` di `NewsDetailClient` sudah memuat field dari `src/types/article.ts`:

- Identitas: `_id`, `title`, `slug`, `excerpt`
- Editorial: `authorId`, `author`, `editorId`, `editor`, `contributors`
- Taksonomi: `categoryId`, `category`, `tags[]`
- Format: `format` (`STANDARD` | `GALLERY`)
- Flag sorotan: `isFeatured`, `isHeadline`, `isBreaking`, `isPopular`, `isEditorChoices`
- Waktu: `publishedAt`, `updatedAt`

### 1.3 Gap utama

| Yang dibutuhkan redaksi                | Tersedia di DB/client | Terkirim ke GA4 hari ini |
| -------------------------------------- | --------------------- | ------------------------ |
| Halaman / URL                          | ✅                    | ✅ (`page_path`)         |
| ID & judul artikel                     | ✅                    | ❌                       |
| Penulis                                | ✅                    | ❌                       |
| Kategori / rubrik                      | ✅                    | ❌                       |
| Tag                                    | ✅                    | ❌                       |
| Format (teks vs galeri)                | ✅                    | ❌                       |
| Flag breaking/headline                 | ✅                    | ❌                       |
| Halaman artikel multi-page (`?page=2`) | ✅                    | ❌ (hanya pathname awal) |

Analytics internal MongoDB (`article_views` + join di `audienceAnalyticsService`) **bukan** sumber Looker Studio kecuali diekspor terpisah. Laporan ini fokus **satu jalur: GA4 → Looker Studio**.

---

## 2. Opsi integrasi ke Google Analytics

### Opsi A — `gtag` Event + Custom Dimensions (disarankan)

**Deskripsi:** Tetap pakai `gtag.js` yang sudah ada. Tambah event `view_article` dengan parameter metadata; daftarkan parameter sebagai Custom Dimensions di GA4 Admin.

| Aspek                     | Detail                            |
| ------------------------- | --------------------------------- |
| Kompleksitas implementasi | Rendah–sedang                     |
| Perubahan infra           | Minimal (tidak perlu GTM)         |
| Cocok untuk Looker Studio | ✅ via konektor GA4 atau BigQuery |
| Data historis             | Tidak retroaktif                  |

**Alur:**

```
NewsDetailClient (article loaded)
    → gtag('event', 'view_article', { article_id, author_name, … })
    → GA4 memproses event + custom dimensions
    → Looker Studio (GA4 connector / BigQuery export)
```

**Kelebihan**

- Selaras dengan stack existing (`layout.tsx` + `NewsDetailClient`)
- Satu titik kode untuk halaman artikel
- Debug mudah lewat GA4 DebugView

**Kekurangan**

- Custom dimensions GA4 dibatasi (gratis: 50 event-scoped; 360: lebih banyak)
- Tag array harus di-flatten (mis. `tag_names` sebagai string comma-separated)
- Perlu registrasi manual setiap parameter di GA4 Admin

---

### Opsi B — Google Tag Manager (GTM) + dataLayer

**Deskripsi:** Ganti injeksi `gtag` langsung dengan container GTM. Aplikasi push objek ke `dataLayer`; GTM memetakan ke GA4 Event Tag.

| Aspek                     | Detail                                                         |
| ------------------------- | -------------------------------------------------------------- |
| Kompleksitas implementasi | Sedang                                                         |
| Perubahan infra           | Tambah container GTM, kurangi script hardcoded di `layout.tsx` |
| Cocok untuk Looker Studio | ✅ sama seperti Opsi A                                         |
| Data historis             | Tidak retroaktif                                               |

**Alur:**

```
NewsDetailClient
    → window.dataLayer.push({ event: 'view_article', article_id: '…', … })
    → GTM Trigger: Custom Event = view_article
    → GTM Tag: GA4 Event (map variabel → event parameters)
    → GA4 → Looker Studio
```

**Kelebihan**

- Marketing/GA bisa ubah mapping tanpa deploy kode
- Mudah menambah tag lain (Meta Pixel, dll.) dari satu container
- Cocok jika tim non-engineering mengelola tracking

**Kekurangan**

- Setup awal GTM + dokumentasi variabel dataLayer
- Debugging lebih berlapis (GTM Preview + GA DebugView)
- Tetap perlu custom dimensions di GA4

---

### Opsi C — GA4 Measurement Protocol (server-side)

**Deskripsi:** Server mengirim event ke GA4 REST API saat `POST /api/analytics/view-article` berhasil.

| Aspek                     | Detail                                  |
| ------------------------- | --------------------------------------- |
| Kompleksitas implementasi | Sedang–tinggi                           |
| Perubahan infra           | API secret GA4, validasi payload server |
| Cocok untuk Looker Studio | ✅                                      |
| Data historis             | Tidak retroaktif                        |

**Kelebihan**

- Metadata diisi dari DB (author/category selalu konsisten, tidak bergantung client)
- Lebih tahan ad-blocker (sebagian traffic)

**Kekurangan**

- Kehilangan konteks browser GA (client_id/session harus disinkronkan manual)
- Duplikasi risiko jika client + server sama-sama kirim event
- **Bukan satu jalur murni frontend** — hybrid dengan API internal

**Rekomendasi:** Gunakan hanya sebagai pelengkap atau pengganti `article_views` internal, **bukan** jalur utama Looker jika tujuan adalah satu pipeline GA standar.

---

### Opsi D — Content Groups / `content_group` di `gtag config`

**Deskripsi:** Set `content_group` per halaman (mis. nama kategori atau slug rubrik) lewat `gtag('config', …, { content_group: 'Politik' })`.

| Aspek                        | Detail                                   |
| ---------------------------- | ---------------------------------------- |
| Kompleksitas                 | Rendah                                   |
| Dimensi yang bisa dilaporkan | Sangat terbatas (satu grup per pageview) |
| Cocok untuk kebutuhan penuh  | ❌ tidak cukup                           |

**Kesimpulan:** Bisa sebagai pelengkap ringan, **tidak** memenuhi kebutuhan filter penulis + tag + format sekaligus.

---

### Opsi E — Enhanced Measurement saja (tanpa custom event)

**Deskripsi:** Mengandalkan page_view otomatis GA4 + explorasi berdasarkan `page_location` / `page_title`.

| Aspek                         | Detail                                                   |
| ----------------------------- | -------------------------------------------------------- |
| Usaha implementasi            | Nol tambahan                                             |
| Filter by author/category/tag | ❌ tidak memungkinkan tanpa parsing URL manual di Looker |
| Rekomendasi                   | Tidak memenuhi requirement                               |

---

## 3. Perbandingan opsi

| Kriteria                      | A: gtag Event | B: GTM | C: Measurement Protocol | D: Content Group | E: Default saja |
| ----------------------------- | :-----------: | :----: | :---------------------: | :--------------: | :-------------: |
| Satu jalur ke GA4             |      ✅       |   ✅   |        ⚠️ hybrid        |    ⚠️ parsial    |       ✅        |
| Metadata artikel lengkap      |      ✅       |   ✅   |           ✅            |        ❌        |       ❌        |
| Minim perubahan kode existing |      ✅       |   ⚠️   |           ⚠️            |        ✅        |       ✅        |
| Looker Studio ready           |      ✅       |   ✅   |           ✅            |        ⚠️        |       ❌        |
| Tim non-dev bisa maintain     |      ⚠️       |   ✅   |           ❌            |        ⚠️        |       ✅        |
| Tahan ad-blocker              |      ⚠️       |   ⚠️   |           ✅            |        ⚠️        |       ⚠️        |

---

## 4. Rekomendasi: satu jalur utama

### Pilihan: **Opsi A — `gtag` Event + Custom Dimensions**, dengan BigQuery Export

Alasan:

1. Stack sudah memakai `gtag.js` di `layout.tsx`.
2. Data artikel sudah ada di `NewsDetailClient` — cukup satu helper + satu `useEffect`.
3. Looker Studio paling fleksibel jika GA4 dihubungkan ke **BigQuery** (filter tag, agregasi penulis, join dengan campaign).
4. Satu event utama `view_article` = satu kontrak data yang jelas.

Opsi B (GTM) layak jika tim marketing ingin mengelola tag tanpa deploy; implementasi dataLayer bisa mengikuti kontrak event yang sama seperti Opsi A.

---

## 5. Rencana implementasi (Opsi A)

### 5.1 Daftar Custom Dimensions di GA4 Admin

Daftarkan sebagai **Event-scoped custom dimensions** (Admin → Data display → Custom definitions):

| Nama di GA4    | Parameter event  | Sumber di `article`     | Contoh nilai                   |
| -------------- | ---------------- | ----------------------- | ------------------------------ |
| Article ID     | `article_id`     | `article._id`           | `674a1b2c…`                    |
| Article Slug   | `article_slug`   | `article.slug`          | `demo-artikel`                 |
| Article Title  | `article_title`  | `article.title`         | Judul berita                   |
| Author ID      | `author_id`      | `article.authorId`      | ObjectId string                |
| Author Name    | `author_name`    | `article.author.name`   | Nama penulis                   |
| Category ID    | `category_id`    | `article.categoryId`    | ObjectId string                |
| Category Name  | `category_name`  | `article.category.name` | Politik                        |
| Category Slug  | `category_slug`  | `article.category.slug` | politik                        |
| Article Format | `article_format` | `article.format`        | `STANDARD` / `GALLERY`         |
| Tag Names      | `tag_names`      | `article.tags`          | `ekonomi, pilkada` (join `, `) |
| Is Breaking    | `is_breaking`    | `article.isBreaking`    | `true` / `false`               |
| Is Headline    | `is_headline`    | `article.isHeadline`    | `true` / `false`               |
| Content Page   | `content_page`   | `pageNum` di client     | `1`, `2`, `all`                |

Batasi jumlah dimensi jika mendekati limit GA4; prioritas: `article_id`, `author_name`, `category_name`, `article_format`, `tag_names`.

### 5.2 Helper tracking (usulan file baru)

Buat `src/lib/ga-article-tracking.ts`:

```typescript
type ArticleGaPayload = {
  article_id: string;
  article_slug: string;
  article_title: string;
  author_id: string;
  author_name: string;
  category_id: string;
  category_name: string;
  category_slug: string;
  article_format: string;
  tag_names: string;
  is_breaking: string;
  is_headline: string;
  content_page: string;
};

export function trackArticleView(
  article: Article,
  contentPage: number | "all",
): void {
  if (typeof window === "undefined" || !window.gtag) return;
  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  if (!measurementId) return;

  const params: ArticleGaPayload = {
    article_id: String(article._id ?? ""),
    article_slug: article.slug ?? "",
    article_title: article.title ?? "",
    author_id: String(article.authorId ?? ""),
    author_name: article.author?.name ?? "",
    category_id: String(article.categoryId ?? article.category?._id ?? ""),
    category_name: article.category?.name ?? "",
    category_slug: article.category?.slug ?? "",
    article_format: article.format ?? "STANDARD",
    tag_names: (article.tags ?? []).map((t) => t.name).join(", "),
    is_breaking: article.isBreaking ? "true" : "false",
    is_headline: article.isHeadline ? "true" : "false",
    content_page: contentPage === "all" ? "all" : String(contentPage),
  };

  window.gtag("event", "view_article", params);
}
```

### 5.3 Integrasi di `NewsDetailClient.tsx`

- Panggil `trackArticleView(article, isShowAll ? "all" : pageNum)` di `useEffect` dengan dependency `[article._id, pageNum, isShowAll]`.
- Pertahankan `gtag('config', …, { page_path })` untuk SPA pagination, atau gabungkan `page_path` + query `?page=` agar konsisten.

### 5.4 Event tambahan (opsional, fase 2)

| Event                 | Trigger                          | Parameter utama                                                 |
| --------------------- | -------------------------------- | --------------------------------------------------------------- |
| `share_article`       | Klik tombol share di `ArticleUi` | `article_id`, `share_platform` (`facebook`, `x`, `whatsapp`, …) |
| `article_page_change` | Pagination multi-halaman         | `article_id`, `content_page`                                    |
| `headline_click`      | Klik headline di homepage        | `article_id`, `section`                                         |

### 5.5 BigQuery Export (sangat disarankan untuk Looker Studio)

1. GA4 Admin → Product links → BigQuery Links → link project GCP.
2. Aktifkan **daily export** (gratis) atau streaming (berbayar).
3. Di Looker Studio: data source = BigQuery → tabel `events_*`.
4. Query contoh dimensi artikel:

```sql
SELECT
  event_date,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'article_id') AS article_id,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'author_name') AS author_name,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'category_name') AS category_name,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'tag_names') AS tag_names,
  COUNT(*) AS views
FROM `project_id.analytics_XXXXX.events_*`
WHERE event_name = 'view_article'
  AND _TABLE_SUFFIX BETWEEN '20260101' AND '20261231'
GROUP BY 1, 2, 3, 4, 5
```

### 5.6 Validasi sebelum production

| Langkah                      | Cara cek                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------ |
| Event terkirim               | Chrome extension **GA Debugger** atau **Tag Assistant**                        |
| Parameter lengkap            | GA4 → Admin → DebugView (realtime)                                             |
| Custom dimension ter-mapping | GA4 → Reports → Realtime → Event count by custom dimension (setelah 24–48 jam) |
| Looker Studio                | Buat chart: `author_name` × `event count`; filter `event_name = view_article`  |

---

## 6. Laporan Looker Studio yang bisa dibangun

Setelah Opsi A + BigQuery aktif:

| Dashboard / chart       | Dimensi                                       | Metrik                      |
| ----------------------- | --------------------------------------------- | --------------------------- |
| Performa per penulis    | `author_name`                                 | `view_article` count, users |
| Performa per rubrik     | `category_name`                               | views, avg engagement time  |
| Artikel terpopuler      | `article_title`, `article_slug`               | views                       |
| Distribusi format       | `article_format`                              | % views                     |
| Tag trending            | `tag_names` (split di BigQuery)               | views                       |
| Breaking vs regular     | `is_breaking`                                 | views                       |
| Multi-page depth        | `content_page`                                | views per artikel           |
| Sumber traffic × rubrik | GA default `session_source` + `category_name` | views                       |

---

## 7. Yang tidak perlu dilakukan (untuk satu jalur GA)

- **Jangan** mengandalkan hanya `article_views` MongoDB untuk Looker — itu jalur terpisah kecuali diekspor manual.
- **Jangan** mengirim metadata hanya lewat `page_title` dinamis — tidak scalable untuk filter penulis/tag di GA4.
- **Jangan** duplikasi event `view_article` dari client dan Measurement Protocol tanpa deduplication — risiko double count.

Analytics internal (`/api/analytics/view-article`) tetap berguna untuk `viewCount` di CMS dan dashboard admin; GA4 tetap jalur untuk **Looker Studio & marketing analytics**.

---

## 8. Checklist eksekusi

- [x] Tentukan daftar final custom dimensions (prioritas ≤ 25 untuk aman)
- [x] Daftarkan custom dimensions di GA4 Admin
- [x] Buat `src/lib/google-analytics.ts` (helper terpusat)
- [x] Buat `src/components/analytics/GaRouteTracker.tsx` (page_view SPA)
- [x] Integrasikan `useArticleTracking` di `NewsDetailClient.tsx`
- [ ] Uji di GA4 DebugView
- [ ] Aktifkan BigQuery Export
- [ ] Buat data source Looker Studio
- [ ] Buat laporan: penulis, kategori, artikel top, tag (via BigQuery)
- [ ] Dokumentasikan kontrak event di `memory/analytics.md`

---

## 9. Referensi file terkait

| File                                                 | Peran                                      |
| ---------------------------------------------------- | ------------------------------------------ |
| `src/lib/google-analytics.ts`                        | Helper terpusat: `trackPageView`, `trackArticleView` |
| `src/components/analytics/GaRouteTracker.tsx`        | `page_view` pada setiap perubahan route SPA |
| `src/hooks/useArticleTracking.ts`                    | Hook event `view_article` + dedup         |
| `src/app/layout.tsx`                                 | Inisialisasi GA4 (`send_page_view: false`) + mount tracker |
| `src/app/(public)/news/[slug]/NewsDetailClient.tsx`  | Memanggil `useArticleTracking` saja         |
| `src/types/article.ts`                               | Kontrak data artikel                       |
| `src/types/gtag.d.ts`                                | Tipe global `window.gtag`                  |
| `src/app/api/analytics/view-article/route.ts`        | Analytics internal (paralel, bukan Looker) |
| `src/services/analytics/audienceAnalyticsService.ts` | Join MongoDB untuk admin panel             |
| `memory/analytics.md`                                | Dokumentasi analytics internal             |

---

## 10. Kesimpulan

Untuk **satu jalur integrasi ke Google Analytics** yang memungkinkan GA memproses penulis, kategori, tag, dan metadata artikel lainnya di **Looker Studio**, opsi terbaik saat ini adalah:

**`gtag('event', 'view_article', { … })` + Custom Dimensions di GA4 + BigQuery Export**

Implementasi utama cukup di `NewsDetailClient` dengan helper terpusat; tidak perlu mengubah schema MongoDB `article_views` untuk tujuan Looker Studio.

---

## 11. Konvensi pasca-refactor (implementasi aktual)

### Arsitektur

```
layout.tsx (gtag init, send_page_view: false)
    ├── GaRouteTracker → gtag('event', 'page_view', …)   [semua halaman publik]
    └── NewsDetailClient → useArticleTracking → gtag('event', 'view_article', …)   [hanya artikel]
```

### Dua event, dua tujuan

| Event | Sumber kode | Gunakan di Looker untuk |
|-------|-------------|-------------------------|
| `page_view` | `GaRouteTracker` | Traffic situs, navigasi, session, sumber kunjungan |
| `view_article` | `useArticleTracking` | Penulis, kategori, tag, format, `content_page` |

### Parameter `view_article` (Custom Dimensions GA4)

Nama parameter di kode **harus persis** sama dengan Custom Definitions di GA4 Admin:

`article_id`, `article_slug`, `article_title`, `author_id`, `author_name`, `category_id`, `category_name`, `category_slug`, `article_format`, `tag_names`, `is_breaking`, `is_headline`, `content_page`, plus `page_path`, `page_location`, `page_title`.

### Route yang dikecualikan

`/admin-xyz` dan `/login` tidak mengirim `page_view` (guard di `GaRouteTracker`).

### Validasi manual (GA4 DebugView)

1. Buka artikel → muncul **1** `page_view` + **1** `view_article` (bukan triple hit).
2. Navigasi SPA home → artikel → kategori → setiap pindah halaman ada `page_view` baru.
3. Pagination `?page=2` → `page_path` berubah di `page_view`, `content_page=2` di `view_article`.
4. Breakdown `author_name` / `category_name` di Looker: filter `event_name = view_article`.
