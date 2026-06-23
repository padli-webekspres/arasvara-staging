# Revised Analytics & Dashboard Blueprint

Dokumen ini adalah rancangan ulang (redesign) arsitektur sistem pelaporan (Analytics & Dashboard) untuk CMS Arasvara, disesuaikan dengan struktur `types` terbaru. Rancangan ini menggantikan 37 daftar laporan lama menjadi struktur UI/UX yang lebih terfokus, logis, dan actionable.

## 1. Analisis & Resolusi Technical Debt (Source of Truth)

Sebelum merancang UI, berikut adalah penyelesaian anomali dan penentuan "Source of Truth" berdasarkan `types` terbaru:

> [!IMPORTANT]
> **Source of Truth untuk Metrik Tayangan (Views)**
>
> - **Global/List Ranking (Fast Query):** Gunakan `articles.viewCount` (dari koleksi `articles`). Ini adalah _Source of Truth_ untuk menampilkan angka total view di daftar artikel, ranking top performer, atau summary penulis. Angka ini harus di-increment secara atomic setiap ada event baca.
> - **Time-Series & Deep Analytics:** Gunakan koleksi `article_views` (dari `ArticleView`). Ini adalah _Source of Truth_ untuk grafik tren waktu (harian/bulanan), sumber traffic (referrer/user-agent), engagement 30 hari terakhir, dan analisis audiens spesifik.

> [!WARNING]
> **Resolusi Anomali Tipe Lama vs Terbaru**
>
> - **Status `ARCHIVED` dihapus:** Berdasarkan `ArticleStatus` enum terbaru, status `ARCHIVED` tidak ada. Hanya ada `DRAFT`, `PENDING_REVIEW`, `PUBLISHED`, `SCHEDULED`, `REJECTED`, `TAKEN_DOWN`, dan `DELETED`. Laporan `AuthorArticles` harus disesuaikan untuk tidak menggunakan `ARCHIVED`.
> - **`featuredImage` bukan string:** Pada tipe terbaru, `featuredImage` adalah sebuah objek `ArticleMedia` (berisi `url`, `caption`, `credit`, dll). Query ke frontend harus mengambil `featuredImage.url`.
> - **Fokus Gen Z (Multimedia):** `BaseArticle` kini mendukung field `format: "STANDARD" | "GALLERY"`. Artikel galeri menggunakan `galleryItems: GalleryItem[]`. Dashboard harus memiliki porsi khusus untuk memantau performa format `GALLERY` ini.
> - **KPI Account Executive (Bisnis):** Telah ditambahkan `MonthlyTargetKey.AD_CLICKS_MIN`. KPI AE harus dihidupkan untuk mengukur klik iklan dan performa sponsor.

---

## 2. Restrukturisasi Halaman Dashboard (UI/UX Logic)

Ke-37 laporan lama telah disederhanakan dan dikelompokkan ke dalam 6 halaman/tab utama yang siap diimplementasikan ke antarmuka CMS.

### Halaman 1: Dashboard Utama (Executive Summary - Role-Based)

_Tujuan: Menyediakan beranda dynamic-rendered yang memuat metrik penting (Executive Summary) disesuaikan secara personal berdasarkan kewenangan dan tanggung jawab masing-masing Role._

Berikut adalah rancangan sebaran widget pelaporan utama yang disesuaikan secara personal:

---

#### ─── A. ROLE: Super Admin (`admin`) ───

_Fokus Utama: Kestabilan platform, audit trail sistem, pemanfaatan resource, dan keamanan._

1. **System Health & Activity Cards (Metrik Utama)**
   - **Data:** Jumlah staf yang online hari ini, jumlah audit log baru dalam 24 jam terakhir, total file media terunggah, persentase space tersisa.
   - **Collection:** `users` (filter `updatedAt`), `audit_log`, `media`.
   - **Interface:** `SerializedAuditLog`, `UserProfile`, `Media`.
2. **Recent Audit Trail Tracker (Widget Utama)**
   - **Data:** Live feed 10 aktivitas perubahan krusial terakhir di seluruh CMS (penghapusan, modifikasi kategori/user/ads).
   - **Collection:** `audit_log` (diurutkan descending berdasarkan `createdAt`).
   - **Interface:** `SerializedAuditLog` (dari `auditLog.ts`).
3. **Orphan Media Cleanup Utility Card (Widget Aksi)**
   - **Data:** Total berkas gambar/video yang tidak terikat ke artikel manapun, siap dibersihkan via cron/cleanup.
   - **Collection:** `media` join `articles` (mendeteksi media ID yang tidak direferensikan).
   - **Interface:** `Media` & Endpoint `/api/media/cleanup`.
4. **Push Funnel Status & FCM Log (Widget Teknis)**
   - **Data:** Persentase keberhasilan pengiriman push notifications sistem ke perangkat user (`isPushSent: true` vs `false`).
   - **Collection:** `notifications` (group by `isPushSent`).
   - **Interface:** `Notification`.

---

#### ─── B. ROLE: Pemimpin Redaksi (`editor-in-chief`) ───

_Fokus Utama: Performa makro situs (traffic), target korporat, tren konten terpopuler, dan pencapaian desk redaksi._

1. **Macro Performance Cards (Metrik Utama)**
   - **Data:** Total pembaca bulan ini vs target bulanan (`SITE_TOTAL_PAGEVIEWS`), total artikel terbit hari ini, total unique visitor.
   - **Collection:** `articles`, `article_views`, `monthly_targets`.
   - **Interface:** `MonthlyTarget` (key: `SITE_TOTAL_PAGEVIEWS`), `ArticleListResponse`.
2. **Real-time Trending & Popular Articles (Widget Utama)**
   - **Data:** Daftar 5-10 artikel dengan view tertinggi 24 jam terakhir.
   - **Collection:** `articles` (diurutkan descending berdasarkan `viewCount`).
   - **Interface:** `ArticleListResponse`.
3. **Desk / Kategori Traffic Share Chart (Widget Visual)**
   - **Data:** Grafik donat/pie pembagian kontribusi pageview antar kanal desk (Lifestyle vs Hard News vs Sport).
   - **Collection:** `articles` (group by `categoryId` join `category`).
   - **Interface:** `Category`.
4. **Sorotan Beranda Monitor (Widget Editor Choices)**
   - **Data:** Monitoring slot editorial aktif: headline, popular, editor choices.
   - **Collection:** `articles` (filter flags `isHeadline`, `isFeatured`, `isEditorChoices` = `true`).
   - **Interface:** `Article`.

---

#### ─── C. ROLE: Editor (`editor`) ───

_Fokus Utama: Menjaga alur kerja gatekeeping, antrean review naskah, waktu respons SLA, dan ketepatan revisi._

1. **Workload & SLA Dashboard Cards (Metrik Utama)**
   - **Data:** Rata-rata waktu tunggu naskah dari diajukan sampai terbit (SLA), target review bulanan, realisasi artikel yang telah diproses bulan ini.
   - **Collection:** `articles` (durasi `submittedAt` ke `publishedAt`), `editor_activities`, `monthly_targets`.
   - **Interface:** `KPIEditorResponse` (properti: `avgProcessingTimeMinutes`, `targetSlaMinutes`, `slaComplianceRate`).
2. **Urgent Pending Review Queue (Widget Utama - Tindakan Cepat)**
   - **Data:** Daftar artikel dengan status `PENDING_REVIEW`, diurutkan dari yang paling lama mengantre lengkap dengan tag waktu tunggu real-time.
   - **Collection:** `articles` (filter `status: "PENDING_REVIEW"` sort `submittedAt ASC`).
   - **Interface:** `Article` (properti `submittedAt`, `author`).
3. **Revision Strictness Rate & Feedback Logger (Widget Kualitas)**
   - **Data:** Statistik rasio pengembalian draf penulis (Strictness Rate) bulan ini.
   - **Collection:** `editor_activities` (filter `action: "REJECT"` atau `statusTo: "DRAFT"`).
   - **Interface:** `KPIEditorResponse` (properti: `editorStrictnessRate`).
4. **24-Hour Editorial Calendar / Backlog (Widget Jadwal)**
   - **Data:** Daftar artikel terjadwal terbit (`SCHEDULED`) dalam 24 jam ke depan.
   - **Collection:** `articles` (filter `status: "SCHEDULED"`).
   - **Interface:** `Article` (properti `scheduledAt`).

---

#### ─── D. ROLE: Content Writer (`writer`) ───

_Fokus Utama: Produktivitas pribadi, pemantauan target bulanan sendiri, performa pembaca artikelnya, dan revisi naskah._

1. **My Monthly Achievement Cards (Metrik Utama)**
   - **Data:** Artikel terbit bulan ini vs target (`ARTICLES_PUBLISHED`), artikel draf disubmit vs target (`ARTICLES_SUBMITTED`), revision rate pribadi bulan berjalan.
   - **Collection:** `articles`, `editor_activities`, `monthly_targets`.
   - **Interface:** `KPIWriterTeamResponse` (properti: `articlePublishedThisMonth`, `targetAchievementRate`, `monthlyRevisionRate`).
2. **Personal Pageview Trend (Widget Utama)**
   - **Data:** Grafik garis performa traffic harian khusus untuk seluruh artikel karya penulis tersebut selama 30 hari terakhir.
   - **Collection:** `article_views` join `articles` (filter `authorId === loggedInUserId`).
   - **Interface:** `AuthorPerformance`.
3. **Rejection & Revision Feedback Inbox (Widget Aksi Instan)**
   - **Data:** Inbox berisi draf artikel milik penulis yang dikembalikan oleh editor dengan status `REJECTED` beserta alasan revisi.
   - **Collection:** `articles` (filter `authorId === loggedInUserId` dan `status: "REJECTED"`).
   - **Interface:** `Article` (properti `revisionHistory` -> `reason`).
4. **My Top Performing Stories (Widget Ranking)**
   - **Data:** Daftar artikel terbaik milik penulis terurut berdasarkan jumlah pembaca.
   - **Collection:** `articles` (filter `authorId === loggedInUserId` sort `viewCount DESC`).
   - **Interface:** `ArticlesAuthorSummary` (dari `authorAnalytics.ts`).

---

#### ─── E. ROLE: Account Executive (`account-executive`) ───

_Fokus Utama: Kampanye iklan komersial, target konversi/klik, direktori sponsor aktif, dan sisa inventaris berbayar._

1. **AE Target & Conversion Cards (Metrik Utama)**
   - **Data:** Total klik iklan terhitung bulan ini vs target klik minimum (`AD_CLICKS_MIN`), jumlah sponsor aktif, total pageviews artikel bersponsor.
   - **Collection:** `monthly_targets`, `ads_*`, `sponsors`.
   - **Interface:** `MonthlyTarget` (key: `AD_CLICKS_MIN`), `SponsorItem`.
2. **Ad Banner CTR & Performance Grid (Widget Utama)**
   - **Data:** Grid monitoring performa seluruh iklan homepage/artikel yang sedang tayang (CTR = Klik / Impresi jika dicatat, atau raw `clicks` counter).
   - **Collection:** Koleksi iklan (`ads_homepage`, `ads_article` filter `isActive: true`).
   - **Interface:** `Ads` (dari `ads.ts` properti: `clicks`, `startedAt`, `endedAt`, `linkUrl`).
3. **Active Placements Inventory Map (Widget Status Slot)**
   - **Data:** Visualisasi layout penempatan iklan homepage & artikel: mana slot yang aktif (`isActive`) vs slot kosong (expired/siap dijual kembali).
   - **Collection:** Koleksi iklan filter by `AdsPosition` dan `AdsSingleArticlePlacement`.
   - **Interface:** `AdsPosition`, `AdsSingleArticlePlacement`.
4. **Expiring Campaigns Alert (Widget Pengingat)**
   - **Data:** Daftar iklan dan kerja sama sponsor yang akan selesai dalam waktu ≤ 7 hari.
   - **Collection:** Koleksi iklan & sponsor (filter `endedAt` antara `hari ini` s.d `7 hari ke depan`).
   - **Interface:** `Ads` (properti `endedAt`, `name`).

---

### Halaman 2: Audience Analytics & Traffic

_Tujuan: Analisis mendalam mengenai pembaca, tren, dan perilaku audiens._

1. **Tren Tayangan Situs (Time-Series Chart)**
   - **Data:** Grafik line/bar jumlah views per hari/minggu/bulan.
   - **Collection:** `article_views`.
2. **Sumber Traffic & Perangkat**
   - **Data:** Proporsi asal pembaca (Referrer: Google, Socmed, Direct) dan perangkat (UserAgent).
   - **Collection:** `article_views`.
3. **Engagement per Artikel (Deep Dive)**
   - **Data:** Perbandingan `totalViews` vs `viewsLast30Days`.
   - **Collection:** Gabungan `articles` dan `article_views`.
   - **Interface:** `ArticleEngagementReport`.
4. **Distribusi Kategori & Format (Gen Z Focus)**
   - **Data:** Proporsi traffic dari artikel format `STANDARD` vs `GALLERY`.
   - **Collection:** `articles` (group by `format` dan `categoryId`).
   - **Interface:** `GalleryArticle`, `StandardArticle`.

### Halaman 3: Editorial Workflow & Production

_Tujuan: Memantau kelancaran "pabrik" berita (pipeline produksi) harian._

1. **Pipeline Status Artikel (Kanban/Histogram)**
   - **Data:** Jumlah artikel di tahap `DRAFT`, `PENDING_REVIEW`, `SCHEDULED`, `PUBLISHED`.
   - **Collection:** `articles` (group by `status`).
   - **Interface:** `ArticleStatus`.
2. **Backlog & Jadwal Tayang (Scheduled)**
   - **Data:** Daftar artikel yang akan tayang (`SCHEDULED`).
   - **Collection:** `articles` (filter `status: "SCHEDULED"`).
   - **Interface:** `Article` (field `scheduledAt`).
3. **Volume Aktivitas Editor (Log Aksi)**
   - **Data:** Jumlah publish, reject, takedown per waktu.
   - **Collection:** `editor_activities`.
   - **Interface:** `EditorActivity` (jika ada).
4. **Waktu Turnaround (SLA Review-to-Publish)**
   - **Data:** Durasi dari `SUBMITTED` hingga `PUBLISHED`.
   - **Collection:** `articles` (hitung dari `submittedAt` ke `publishedAt`).

### Halaman 4: Team KPI & Performance

_Tujuan: Rapor kinerja individu dan tim secara transparan berdasarkan jenjang._

1. **KPI Penulis (Reporter / Writer / Contributor)**
   - **Data:** Artikel diajukan, artikel terbit, tingkat revisi (Revision Rate), Pageviews per penulis.
   - **Collection:** `articles`, `editor_activities`, `monthly_targets`.
   - **Interface:** `KPIWriterTeamResponse`, `AuthorPerformance`.
2. **KPI Editor**
   - **Data:** Volume artikel diproses, ketat/longgarnya review (Strictness Rate), kepatuhan waktu SLA.
   - **Collection:** `articles`, `editor_activities`, `monthly_targets`.
   - **Interface:** `KPIEditorResponse`.

### Halaman 5: Monetization & Commercial (Tim Bisnis)

_Tujuan: Memantau target komersial, inventaris iklan, dan sponsor (Untuk Account Executive)._

1. **Target Account Executive (Klik Iklan & Sponsor)**
   - **Data:** Pemenuhan target klik iklan dan performa artikel sponsor.
   - **Collection:** `monthly_targets`, `ads_*`, log event klik.
   - **Interface:** `MonthlyTargetKey.AD_CLICKS_MIN`.
2. **Inventaris Slot Iklan Aktif**
   - **Data:** Daftar iklan yang tayang vs slot kosong per `AdsPosition`.
   - **Collection:** Koleksi ads (mis. `ads_homepage`, `ads_article`).
   - **Interface:** `Ads` (dari `ads.ts`).
3. **Direktori Sponsor**
   - **Data:** Daftar kampanye dan sponsor aktif.
   - **Collection:** `sponsors`.
   - **Interface:** `SponsorItem` (dari `sponsor.ts`).

### Halaman 6: System Audit, Media & SEO

_Tujuan: Kontrol kualitas sistem, keamanan, aset, dan mesin pencari (Admin/Dev)._

1. **Penggunaan Media & Galeri**
   - **Data:** Rasio penggunaan `GalleryItem` vs text image, mendeteksi media tidak terpakai (orphan).
   - **Collection:** `media`, `articles`.
   - **Interface:** `ArticleMedia`, `GalleryItem`.
2. **Audit Trail (Jejak Rekam)**
   - **Data:** Log perubahan esensial oleh entitas CMS (mis. siapa menghapus artikel).
   - **Collection:** `audit_log`.
   - **Interface:** `SerializedAuditLog` (dari `auditLog.ts`).
3. **Performa Push Notification**
   - **Data:** Funnel notifikasi sukses dikirim vs dibaca.
   - **Collection:** `notifications`.
   - **Interface:** `NotificationPayload` (field `isPushSent`, `readAt`).
4. **Volume Indexing (Sitemap)**
   - **Data:** Kesiapan URL artikel publik untuk mesin pencari.
   - **Data Source:** Endpoint `/api/sitemap`.

---

## 4. Langkah Lanjutan (Next Steps)

1. **Validasi:** Silakan tinjau arsitektur pelaporan di atas. Apakah struktur 6 Halaman Dashboard ini sudah sesuai dengan ekspektasi UX CMS Anda?
2. **Eksekusi UI:** Jika disetujui, langkah berikutnya adalah memulai pembuatan komponen UI React/Next.js per halaman yang akan memanggil endpoint-endpoint agregasi sesuai desain di atas.
3. **Eksekusi API:** Menyesuaikan endpoint `/api/analytics/*` untuk melayani struktur _Source of Truth_ yang baru dikukuhkan.
