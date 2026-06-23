# Rangkuman Fitur Analytics Arasvara

## 1. Statistik Pembaca & Artikel (Google Analytics & Search Console)

### Use Case

- Mengetahui jumlah pembaca, pageviews, unique visitors per artikel.
- Melihat sumber traffic (direct, search, social, referral).
- Melihat performa headline, topik, dan artikel terpopuler.

### Integrasi & Cara Kerja

- **Provider:** Google Analytics (GA4) & Google Search Console.
- **Integrasi:**
  - Tambahkan script Google Analytics (GA4) di layout Next.js (gunakan gtag.js atau package @vercel/analytics jika di Vercel).
  - Daftarkan domain di Google Search Console.
  - Kirim event custom (misal: klik headline, share, dsb) dari frontend ke GA4 menggunakan `gtag('event', ...)`.
- **Export:**
  - Data bisa diexport dari dashboard Google Analytics/Search Console, atau gunakan Google Data Studio untuk visualisasi custom.

### Kode yang Harus Dibuat

- Tambahkan script GA4 di \_app/layout.
- Kirim event custom dari frontend, contoh:
  ```js
  gtag("event", "headline_click", { article_id: "xxx" });
  ```
- Buat button export di dashboard frontend (link ke export Google Analytics atau download dari backend jika perlu).

---

## 2. Aktivitas Redaksi (Publish, Update, Take Down)

### Use Case

- Mencatat semua aksi penting redaksi untuk audit dan monitoring.
- Menampilkan riwayat aktivitas di dashboard admin.

### Endpoint yang Dibuat

- **POST /api/analytics/editor-activity**
  - Body: `{ userId, action, articleId, timestamp }`
- **GET /api/analytics/editor-activity**
  - Query: filter by user, date, action, dsb.

---

## 3. Push Notification Analytics

### Use Case

- Melacak jumlah notifikasi yang dikirim dan dibuka (open rate).
- Mengetahui artikel mana yang diakses dari notifikasi.

### Endpoint yang Dibuat

- **POST /api/analytics/push-sent**
  - Body: `{ notificationId, articleId, userId, timestamp }`
- **POST /api/analytics/push-open**
  - Body: `{ notificationId, articleId, userId, timestamp }`
- **GET /api/analytics/push**
  - Statistik sent/open rate, artikel dari notifikasi.

---

## 4. Komentar, Like, Interaksi Internal

### Use Case

- Mencatat dan menampilkan komentar/like pada artikel.

### Endpoint yang Dibuat

- **POST /api/comments** (tambah komentar)
- **PATCH /api/comments/:id** (edit komentar)
- **DELETE /api/comments/:id** (hapus komentar)
- **GET /api/comments?articleId=xxx** (list komentar per artikel)
- **POST /api/likes** (tambah like)
- **DELETE /api/likes/:id** (hapus like)
- **GET /api/likes?articleId=xxx** (list like per artikel)

---

## 5. Statistik Penulis & KPI

### Use Case

- Menampilkan jumlah artikel per penulis/editor.
- Menampilkan performa artikel per penulis (views, engagement, dsb).
- Menampilkan skor KPI penulis (otomatis dari data views, publish, dsb).

### Endpoint yang Dibuat

- **GET /api/analytics/author/:userId/articles** (jumlah artikel per penulis)
- **GET /api/analytics/author/:userId/performance** (performa artikel per penulis)
- **GET /api/analytics/author/:userId/kpi** (skor KPI penulis)
- (Opsional) **PATCH /api/analytics/author-kpi/:userId** (update manual skor KPI)

---

## 6. Export Laporan

### Use Case

- Export data statistik ke PDF/Excel dari dashboard internal.

### Cara Kerja

- **Jika data dari Google Analytics/Search Console:**
  - Gunakan fitur export bawaan Google Analytics/Search Console.
  - Atau, gunakan Google Data Studio untuk custom export.
- **Jika data dari backend sendiri:**
  - Buat endpoint **GET /api/analytics/export?type=xxx&range=xxx**
  - Endpoint mengembalikan file PDF/Excel yang bisa di-download dari frontend.

---

## 7. Event Custom Lain (Share, Klik Headline, dsb)

### Use Case

- Melacak event penting lain yang tidak dicatat otomatis oleh Google Analytics.

### Endpoint yang Dibuat

- **POST /api/analytics/article-share**
  - Body: `{ articleId, userId, platform, timestamp }`
- **POST /api/analytics/headline-click**
  - Body: `{ headlineId, articleId, userId, timestamp }`

---

## Catatan

- Untuk statistik pembaca, traffic, dan event sederhana, **gunakan Google Analytics/Search Console** sebanyak mungkin.
- Untuk data yang spesifik ke sistem internal (penulis, notifikasi, aktivitas redaksi, dsb), **buat endpoint custom di backend**.
- Semua endpoint POST/PATCH dibuat per event (bukan endpoint serbaguna).
- Integrasi Google Analytics cukup dengan script GA4 dan event custom di frontend.

---

Jika ada fitur baru, tambahkan use case, endpoint, dan cara integrasi sesuai pola di atas.
