Berikut  daftar potensi **laporan / dashboard / analytics**. Yang sudah punya tipe khusus atau endpoint mendapat catatan eksplisit.

---

## Peta singkat domain dari folder `types`

| Area | File utama | Intinya untuk analytics |
|------|------------|-------------------------|
| Konten | `article.ts` | Status workflow, `viewCount`, `revisionHistory`, flag sorotan, penulis/editor, format STANDARD/GALLERY |
| Pembaca | `analytics/viewArticle.ts` | Event per tayangan (`article_views`: articleId, user/session/IP/referrer/userAgent, waktu) |
| Redaksi | `analytics/editorActivity.ts` | Log aksi editor (publish, schedule, takedown, dll.) → koleksi `editor_activities` (dipakai service KPI) |
| Penulis | `analytics/authorAnalytics.ts` | Ringkasan artikel penulis + performa & trend bulanan |
| KPI & laporan | `reports/reportArticle.ts`, `reports/kpiUser.ts` | Writer report, engagement per artikel, KPI writer/editor/head-of + pemetaan `monthlyTarget.ts` |
| Target | `monthlyTarget.ts` | Target bulanan per key/peran/tim (`SITE_TOTAL_PAGEVIEWS`, `TEAM_ARTICLES`, SLA editor, dll.) |
| Audit | `auditLog.ts` | Jejak aksinya apa entity apa (USER, CATEGORY, dll.) |
| Notifikasi | `notification.ts` | Jenis event workflow + read/unread, push flag |
| Push | `analytics/pushNotif.ts` | Terkirim vs dibuka (notifikasi push) |
| Iklan | `ads.ts` | Slot homepage/single article, periode tayang (_biasanya_; konversi/impresi hanya jika Anda simpan log tambahan_) |
| Sponsor | `sponsor.ts` | Daftar sponsor (volume/order tanpa metrik kampanye kecuali dilog sendiri) |
| Homepage sections | `articleSection.ts` | Headline/featured/popular/editor choices sebagai dokumen urutan |
| Search/indeks | `search.ts`, `sitemap.ts` | Daftar/kategori untuk eksport atau crawl stats |

Ada juga **`services/analytics.ts`** dengan **`page_views`** dan **`articles`** (dashboard stats)—parallel dengan **`article_views`** dari **`viewArticleService`**. Untuk laporan konsisten, nanti perlu diputus satu “sumber kebenaran” atau gabungan eksplisit.

---

## Potensi laporan / dashboard / analytics (daftar utuh)

### Konten & produksi editorial

1. **Dashboard ringkas CMS** — Total/hutan draft vs published, user count, total tayangan, top artikel, artikel per kategori.  
   **Data:** `getDashboardStats` → `articles`, `users`, `page_views` (`/api/analytics/dashboard`). Sesuaikan jika Anda lebih mengandalkan `article_views`/`articles.viewCount`.

2. **Pipeline status artikel** — Snapshot/histogram per `ArticleStatus` (DRAFT → … → DELETED), SLA antrian review.  
   **Data:** `articles.status`, `submittedAt`/`updatedAt`/`publishedAt`.

3. **Volume publikasi per waktu** — Harian/bulanan: hitungan publish, schedule vs aktual.  
   **Data:** `articles.publishedAt`, `scheduledAt`, `status`.

4. **Distribusi per kategori & tag** — Artikel published per slug kategori/tag.  
   **Data:** `articles.category`, `articles.tags`; bisa dibantu **`search`**/`aggregate`.

5. **Format konten** — STANDARD vs GALLERY.  
   **Data:** `articles.format`.

6. **Sorotan beranda** — Berapa artikel di headline/featured/popular/editor choices/dll., churn slot.  
   **Data:** `articles.isHeadline`, `isFeatured`, `isPopular`, `isEditorChoices`, plus koleksi section/separate helpers **`carousel_section`**, **`articles_*`** dari **`searchService`**.

7. **Riwayat revisi & turnaround penulis** — Frekuensi `revisionHistory`, dari status apa ke apa.  
   **Data:** `ArticleRevision` di dokumen `articles`.

8. **Artikel terjadwal & backlog** — SCHEDULED vs gagal tayang.  
   **Data:** `articles.status`, `scheduledAt`.

### Pembacaan & engagement pembaca

9. **Tren tayangan situs / artikel** — Total/unik jika Anda definisi dari IP/session (`ArticleView`).  
   **Data:** **`article_views`**, **`articles.viewCount`** (increment dari **`view-article`**). **`page_views`** jika masih dipakai jalur lain.

10. **Laporan engagement per artikel** — Total vs 30 hari terakhir (`ArticleEngagementReport`).  
    **Data:** **`article_views.viewedAt`** + join **`articles`**; endpoint ada **`/api/reports/article/engagement`**.

11. **Top/bottom performers** — Ranking views, pertumbuhan MoM.  
    **`articles.viewCount`** atau agregasi **`article_views`**.

12. **Sumber traffic kasar** — Referrer/userAgent breakdown (privacy-conscious aggregation).  
    **Data:** `ArticleView.referrer`, `userAgent`.

### Penulis & tim konten

13. **Kinerja penulis (writer report)** — Artikel total, 30 hari terakhir, pembaca 30 hari (`ArticleWriterReport`).  
    **Data:** **`articles`** (authorId), **`article_views`**/views; **`/api/reports/article/writer`**.

14. **Ringkasan & daftar artikel penulis** — `AuthorArticles` / `AuthorPerformance`.  
    **Data:** **`/api/analytics/author/[userId]/articles`**, **`/performance`** + **`articles`**.

15. **KPI penulis (Reporter/Writer/Contributor)** — Target publish/submit, revision rate, pageviews bulan ini vs **`MonthlyTarget`**.  
    **Data:** **`kpiUserService`** → **`articles`**, **`article_views`**, **`editor_activities`**, **`monthly_targets`**; **`/api/reports/kpi`** / **`/api/analytics/user-kpi`**.

16. **KPI editor** — Artikel diproses, SLA menit, strictness rate.  
    **Data:** sama KPI pipeline + **`editor_activities`**.

17. **KPI kepala desk (tim)** — Artikel tim, pageviews tim vs target tim + pertumbuhan MoM.  
    **Data:** **`articles`** + **`users.teamId`**, **`monthly_targets`**, **`teams`**.

18. **Produktivitas akun eksekutif (bisnis)** — Ada stub **`KPIAccountExecutiveResponse`** (tersimpan sebagai komentar): bisa diisi dari **`articles`/ konten sponsor** jika Anda tag kampanye.

### Aktivitas redaksi (workflow)

19. **Log aktivitas editor** — Publish vs schedule vs takedown, volume per orang/waktu.  
    **`EditorActivity`**, koleksi **`editor_activities`**; ada **`/api/analytics/editor-analytics`**.

20. **Waktu review-ke-publish** — Dari `PENDING_REVIEW` hingga `PUBLISHED` (dukungan KPI SLA sudah selaras dengan **`MonthlyTargetKey.PROCESSING_TIME_SLA_MINUTES`**).

### Target vs aktual

21. **Dashboard target bulanan** — Semua key **`MonthlyTargetKey`** vs aktual agregat (global/per-role/per-tim).  
    **`monthly_targets`**, **`/api/monthly-target`**.

22. **Peringkat capaian target** — Writer/editor/tim vs **`targetAchievementRate`** pola **`kpiUser`**.

### Iklan, sponsor & monetisasi

23. **Inventaris slot iklan** — Aktif/expired per **`AdsPosition`**, **`startedAt`/`endedAt`**.  
    **`ads_homepage`**, **`ads_article`** (tipe **`ads.ts`**).

24. **Operasional sponsor** — Jumlah sponsor, urutan.  
    **`sponsors`**.

25. **Konversi/CTR push konten sponsor** — Hanya jika Anda menyimpan impresi/klik; dari tipe saja **belum** ada—perlu koleksi event baru atau gabungan **`audit_log`/`notifications`**.

### Notifikasi & push

26. **Notifikasi in-app** — Volume per **`NotificationType`**, unread vs read, waktu ke-read.  
    **`notifications`**, **`GetNotificationsQuery`**.

27. **Push funnel** — Terkirim vs dibuka per **`PushNotifSent`** / **`PushNotifOpen`**.  
    **`/api/analytics/push`**, **`/sent`**, **`/open`**.

### Audit, keamanan & administrasi

28. **Audit trail CMS** — Siapa mengubah apa (`SerializedAuditLog`).  
    **`audit_log`**, query seperti **`AuditLogQueryParams`**.

29. **Aktivitas pengguna** — Login tidak ada di types utama—bisa diperlengkap dari **`users.updatedAt`** atau log lain.

### Media & aset

30. **Penggunaan media** — `MediaUsageInArticle`: gambar dipakai featured vs body berapa artikel.  
    **`media`** + referensi dari **`articles`**.

31. **Penyimpanan / orphan** — Cleanup (`/api/media/cleanup`) bisa dijadikan dashboard “media tak terpakai”.

### Video & homepage structure

32. **Video socmed** — Jumlah per platform, urutan slot.  
    **`video_section`**, **`SectionVideoItem`**.

33. **Section artikel homepage** — Slot terisi vs kosong.  
    **`section_articles`**, **`carousel_section`**.

### Halaman publik & crawlers

34. **Indeks berita** — Volume per hari/kategori (halaman indeks).  
    **`getIndeksArticles`** / **`/api/indeks`**.

35. **Permintaan pencarian internal** — Trend kata kunci `q` di **`/api/search`** (butuh logging query atau log akses).

### Pilihan editorial lain

36. **Selected topics** — Frekuensi atau konsistensi topik pilihan editor.  
    **`selectedTopic.ts`** + koleksi terkait.

### Ekspor & SEO

37. **Sitemap-weight** — Jumlah URL artikel/kategori terbit vs **`SitemapResponse`**.  
    **`/api/sitemap`**.

---

## Yang sudah “siap cor” untuk UI report

Endpoint yang sudah ada dan selaras dengan tipe **`reports/**`** / **`analytics/**`** antara lain: **`/api/analytics/dashboard`**, **`/api/analytics/view-article`** (POST sinkron dengan **`ArticleView`**), **`/api/analytics/author/...`**, **`/api/analytics/editor-analytics`**, **`/api/analytics/user-kpi`**, **`/api/analytics/push*`**, **`/api/reports/article/writer`**, **`/api/reports/article/engagement`**, **`/api/reports/kpi`**, **`/api/monthly-target`**, **`/api/indeks`**, **`/api/search`**.

---

## Hal yang perlu Anda rapikan sebelum laporan “resmi”

- **`page_views`** vs **`article_views`** vs **`articles.viewCount`**: hindari double-count atau definisi ganda di satu dashboard.  
- **`ArticleEngagementData.viewCount`** vs **`article_views`**: pastikan definisi “total vs 30 hari” sama dengan implementasi service.  
- **`AuthorArticles`** memakai status **`ARCHIVED`** sedangkan **`ArticleStatus`** tidak punya ARCHIVED—selarasnya dengan mapping DB saat query.

Jika Anda mau, di Agent mode kita bisa mapping satu-per-satu **endpoint → komponen dashboard** atau diagram ER koleksi Mongo untuk dokumen internal.

*(Ask mode: tidak ada perubahan file dilakukan.)*