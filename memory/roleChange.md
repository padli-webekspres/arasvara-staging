aku hilangkan beberapa role. jadi hanya menyisakan:

- admin: untuk kelola tingkat tertinggi
- Editor-in-Chief (Pemimpin Redaksi): dashboard analytics, takedown konten, management user, serta master data seperti category (channel)
- editor: mengelola bagian konten headline, featured dll. approval berita
- writer: membuat artikel (hanya sampai submit. perlu editor untuk publish)
- Account Executive: fokus pada modul ads

---

### 1. **Admin (System Administrator)**

Fokus pada aspek teknis dan stabilitas _platform_.

- **Otoritas:** Mengelola konfigurasi server, izin akses LAN/CORS, serta pemeliharaan infrastruktur _database_ dan _storage_ (MongoDB & MinIO).
- **Fungsi Utama:** Melakukan pembaruan sistem, mengelola keamanan _dashboard-cms_ melalui variabel lingkungan (`.env`), dan menangani masalah teknis tingkat tinggi.

### 2. **Editor-in-Chief (Pemimpin Redaksi)**

Mengambil alih fungsi strategis dan manajemen data.

- **Akses Sistem:** Memegang kendali atas modul _Analytics_ untuk melihat performa seluruh konten.
- **Fungsi Utama:**
- **User Management:** Menentukan siapa yang menjadi Editor atau Writer.
- **Master Data:** Mengelola kategori (_Channel_) yang menjadi fondasi navigasi situs.
- **Kontrol Konten:** Memiliki wewenang absolut untuk mencabut berita (_takedown_) jika melanggar hukum atau kode etik.

### 3. **Editor**

Menjadi pusat operasional harian (_The Daily Engine_).

- **Akses Sistem:** Memiliki akses penuh ke modul `articles`, `approval`, dan semua seksi kurasi (`headline`, `featured`, `editor-choice`, `popular`).
- **Fungsi Utama:**
- **Gatekeeper:** Melakukan verifikasi dan keberimbangan berita sebelum diterbitkan.
- **Curator:** Bertanggung jawab langsung mengatur tata letak _homepage_ (memasukkan berita ke slot _Headline_, _Featured_, atau _Carousel_).
- **Publisher:** Mengubah status artikel dari _Submit_ menjadi _Published_.

### 4. **Writer (Penulis)**

Fokus murni pada produksi konten.

- **Akses Sistem:** Terbatas pada modul pembuatan artikel harian.
- **Fungsi Utama:** Menulis artikel sesuai standar jurnalistik dan mengirimkannya ke sistem untuk ditinjau oleh Editor.
- **Otoritas:** Tidak bisa menerbitkan berita secara mandiri ke halaman publik.

### 5. **Account Executive (AE)**

Manajer pendapatan dan kemitraan.

- **Akses Sistem:** Fokus pada modul `ads` (Iklan).
- **Fungsi Utama:** Mengelola materi iklan, menentukan posisi _ads banner_, serta memastikan konten berbayar ditandai dengan label "Advertorial" atau "Sponsored" sesuai aturan.

---

## Alur Pembuatan Artikel

### Happy Path:

- ditulis oleh writer
- submit ke editor
- editor review
- editor approve
- editor publish

### Path Revisi:

- writer submit ke editor
- editor review
- editor reject, berikan alasan
- writer revise, submit ke editor
- editor review
- editor approve
- editor publish

### Path Takedown:

- editor publish
- editor / editor-in-chief takedown
- article archived
