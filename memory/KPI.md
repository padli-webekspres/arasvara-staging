# Dokumentasi Fitur KPI & Laporan Tim Redaksi (Modul 10) - Arasvara

## Gambaran Umum

Modul 10 berfungsi sebagai pusat evaluasi performa (Key Performance Indicator / KPI) bagi tim redaksi dan bisnis di dalam CMS Arasvara. Halaman ini dirancang menggunakan **sistem 1 Halaman (Single Page)** yang dipisahkan oleh **Sistem Tabs**, guna menghindari _click-fatigue_ dan memudahkan proses ekspor data (PDF/Excel).

Karena setiap peran (_role_) memiliki metrik kesuksesan yang berbeda, tabel laporan dipisahkan per kategori peran.

---

## 🚫 Peran yang Dikecualikan dari Laporan KPI Individu

Sistem **tidak** menghitung skor KPI individual untuk peran berikut:

1. **`ADMIN`**: Bertugas menjaga infrastruktur teknis, bukan memproduksi konten.
2. **`EDITOR_IN_CHIEF` (Pemred)**: Merupakan pihak "penilai". Kinerja mereka diukur dari metrik makro perusahaan (Total Traffic Situs, Revenue) yang ada di Dashboard Utama (Modul 1), bukan dari produktivitas individual.
3. **`MANAGING_EDITOR` (Redpel)**: Sama seperti Pemred, fokus pada kelancaran operasional harian secara makro, bukan diukur sebagai eksekutor tunggal.
4. **`SUBSCRIBER`**: Konsumen/pembaca akhir.

---

## 📊 Struktur Tab & Parameter KPI per Role

Halaman laporan akan dibagi menjadi 4 Tab utama:

### Tab 1: Tim Penulis (`REPORTER`, `WRITER`, `CONTRIBUTOR`)

Fokus pada produktivitas, daya tarik tulisan, dan kebersihan draf.

- **Artikel Terbit (Article Output):** Kuantitas tulisan yang berhasil tayang dalam rentang waktu tertentu.
- **Total Pageviews:** Jumlah pembaca (_traffic_) spesifik dari artikel yang mencantumkan nama mereka.
- **Rasio Revisi (Revision Rate):** Persentase draf yang dikembalikan oleh Editor. _Semakin rendah persentasenya, semakin baik performanya._
- _(Khusus Reporter)_ **Berita Eksklusif:** Jumlah artikel liputan khusus/investigasi di lapangan.

### Tab 2: Tim Editor (`EDITOR`)

Fokus pada kecepatan pemrosesan dan penjagaan kualitas(_quality control_).

- **Artikel Diproses:** Jumlah draf dari penulis yang berhasil direview, diedit, dan dipublikasikan/dijadwalkan.
- **Draf Dikembalikan:** Jumlah tulisan yang ditolak kembali ke penulis karena tidak memenuhi standar (typo, misinformasi).
- **Rata-rata Waktu Edit (Average Processing Time):** Durasi waktu sejak draf dikirim (_submitted_) oleh penulis hingga disetujui (_published_) oleh editor.

### Tab 3: Kepala Desk (`HEAD_OF`)

Fokus pada performa makro per kategori/rubrik (misal: Kanal Politik, Tekno, Lifestyle).

- **Total Artikel Kanal:** Akumulasi produktivitas dari seluruh penulis di bawah naungan rubriknya.
- **Total Traffic Kanal:** Total _pageviews_ dari rubrik tersebut. Menentukan apakah strategi konten yang diterapkan berhasil menarik audiens.

### Tab 4: Tim Bisnis (`ACCOUNT_EXECUTIVE`)

Fokus pada performa konten komersial untuk kebutuhan pelaporan ke klien/pengiklan.

- **Artikel Sponsor Terbit:** Jumlah artikel advertorial/berbayar yang berhasil ditayangkan.
- **Traffic Konten Sponsor:** Total pembaca pada artikel advertorial untuk mengukur ROI (_Return of Investment_) klien.

---

## ⚙️ Persyaratan Teknis & Integrasi Database (MongoDB)

Untuk merealisasikan perhitungan KPI di atas, skema (_schema_) Mongoose untuk koleksi `Article` memerlukan penambahan beberapa _field_ pelacakan (Tracking Fields):

1. **`viewsCount` (Number):** Melacak total pembaca per artikel.
2. **`readTime` (Number):** Mengukur rata-rata waktu baca (opsional untuk skor kualitas konten).
3. **`revisionHistory` (Array):** Mencatat setiap kali status artikel berubah dari `submitted` kembali ke `draft`. Panjang array ini menentukan _Revision Rate_ penulis.
4. **`publishedBy` (ObjectId - ref 'User'):** Menyimpan ID Editor yang menekan tombol _Publish_, untuk menghitung beban kerja masing-masing Editor.
5. **`timestamps`:** Menggunakan `createdAt`, `submittedAt`, dan `publishedAt` untuk mengkalkulasi _Average Processing Time_ di meja Editor.

## 📝 Catatan UI/UX

- Gunakan filter rentang waktu (Bulan/Tahun) di level halaman (di atas komponen Tabs) agar berlaku global ke semua tabel.
- Saat melakukan _Data Fetching_ di Next.js, gunakan _Lazy Loading_ pada setiap Tab agar query ke MongoDB Atlas tidak memberatkan server pada saat inisialisasi halaman pertama kali.
