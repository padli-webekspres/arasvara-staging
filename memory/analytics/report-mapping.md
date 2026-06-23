# Pemetaan Halaman Analytics & Report CMS Arasvara

## 1. Dashboard Utama CMS (`/dashboard`)
*Halaman ini menampilkan "Helicopter View" atau ringkasan cepat untuk memantau kesehatan situs secara keseluruhan.*

* **Dashboard ringkas CMS:** Total draft vs published, user count, total tayangan, top artikel, artikel per kategori.
* **Sorotan beranda:** Memantau berapa artikel di slot headline/featured/popular/editor choices dan tingkat churn slot.
* **Dashboard target bulanan (Summary):** Agregat aktual vs target bulanan (`monthly_targets`) secara global.

---

## 2. Halaman Baru: Traffic & Audience Analytics (`/dashboard/analytics/audience`)
*Fokus pada bagaimana pembaca berinteraksi dengan konten situs.*

* **Tren tayangan situs / artikel:** Total vs unik berdasarkan IP/session (Data: `article_views`).
* **Top/bottom performers:** Ranking views dan pertumbuhan Month-over-Month (MoM).
* **Laporan engagement per artikel:** Analisis tayangan total vs 30 hari terakhir (Data: `ArticleEngagementReport`).
* **Sumber traffic kasar:** Breakdown berdasarkan referrer dan userAgent.
* **Distribusi per kategori & tag:** Memantau performa artikel published per slug kategori/tag.
* **Permintaan pencarian internal:** Trend kata kunci pencarian pengunjung dari `/api/search`.

---

## 3. Halaman Baru: Kinerja Tim & KPI (`/dashboard/analytics/team-performance`)
*Fokus pada performa individu (Penulis, Editor, Head of Desk) dibandingkan dengan target bulanan mereka.*

* **Kinerja penulis (Writer report):** Total artikel, tayangan 30 hari terakhir, dan daftar artikel per penulis.
* **KPI penulis:** Target publish/submit, revision rate, capaian pageviews vs `MonthlyTarget`.
* **KPI editor:** Jumlah artikel diproses, strictness rate, dan pemenuhan SLA menit.
* **KPI kepala desk (tim):** Total artikel dan pageviews tim vs target tim + pertumbuhan MoM.
* **Peringkat capaian target:** Leaderboard capaian target (Writer/Editor/Tim vs `targetAchievementRate`).

---

## 4. Halaman Baru: Workflow & Produksi Editorial (`/dashboard/analytics/editorial-workflow`)
*Fokus pada kelancaran operasional dapur redaksi, antrean, dan bottleneck.*

* **Pipeline status artikel:** Snapshot/histogram status artikel (DRAFT hingga PUBLISHED/DELETED) dan SLA antrean review.
* **Volume publikasi per waktu:** Grafik hitungan harian/bulanan antara artikel yang di-schedule vs aktual tayang.
* **Waktu review-ke-publish:** Durasi artikel berada di `PENDING_REVIEW` hingga `PUBLISHED` (SLA Processing Time).
* **Riwayat revisi & turnaround penulis:** Frekuensi bolak-balik artikel (revisi) dari editor ke penulis.
* **Log aktivitas editor:** Volume aktivitas publish, schedule, takedown per orang/waktu.
* **Artikel terjadwal & backlog:** Memantau artikel berstatus SCHEDULED vs yang gagal tayang.
* **Format & Struktur Beranda:** Rasio konten STANDARD vs GALLERY, kelengkapan Video socmed, dan slot section artikel/homepage.

---

## 5. Halaman Baru: Bisnis & Monetisasi (`/dashboard/analytics/business`)
*Fokus pada kinerja komersial yang dikelola oleh Account Executive.*

* **Inventaris slot iklan:** Status aktif/expired per `AdsPosition` beserta `startedAt/endedAt`.
* **Operasional sponsor:** Jumlah dan urutan sponsor yang aktif.
* **Produktivitas akun eksekutif:** Jumlah kampanye konten sponsor yang berhasil ditangani.
* **Konversi/CTR push:** Metrik impresi atau klik konten sponsor/iklan.

---

## 6. Halaman Baru: Sistem, Audit & Aset (`/dashboard/analytics/system`)
*Fokus pada keamanan, kesehatan sistem, infrastruktur (media), dan log CMS.*

* **Audit trail CMS:** Log detail siapa mengubah apa (entity USER, CATEGORY, dll).
* **Aktivitas pengguna:** Rekam jejak login atau update profil user.
* **Push funnel:** Tingkat keberhasilan Push Notification (Terkirim vs Dibuka).
* **Notifikasi in-app:** Volume per tipe notifikasi, status unread vs read, dan waktu ke-read.
* **Penggunaan media:** Analisis gambar dipakai di featured vs body.
* **Penyimpanan / orphan:** Daftar media tak terpakai untuk keperluan *cleanup*.
* **Indeks berita & Sitemap-weight:** Volume indeks URL artikel/kategori untuk keperluan SEO & crawler.