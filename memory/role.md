---
# Rekap Role & Hak Akses Project Arasvara

Berikut adalah daftar role (peran) yang digunakan dalam project ini beserta hak akses/kemampuan (permissions) masing-masing. Data diambil dari file `src/lib/auth.ts` dan menu Sidebar admin (`src/components/navigation/Sidebar.tsx`).
---

## Daftar Role

1. **Admin / Administrator**
   - Mengelola seluruh sistem, user, pengaturan, dan editorial. Memiliki akses penuh untuk pengawasan, pengaturan, dan troubleshooting seluruh proses bisnis berita.
2. **Editor-in-Chief / Pemimpin Redaksi**
   - Penanggung jawab utama redaksi. Menetapkan kebijakan editorial, memutuskan kelayakan terbit, mengawasi kualitas dan arah pemberitaan.
3. **Managing Editor / Redaktur Pelaksana**
   - Mengelola operasional harian redaksi, mengatur alur kerja tim redaksi, memastikan naskah siap terbit sesuai standar dan deadline.
4. **Head of / Kepala Bidang**
   - Memimpin desk/liputan tertentu (misal: politik, ekonomi). Bertanggung jawab atas hasil kerja tim di bidangnya, melakukan supervisi dan persetujuan konten.
5. **Editor / Editor**
   - Mengedit, memperbaiki, dan menyunting naskah dari reporter/penulis. Menjamin kualitas, akurasi, dan kepatuhan pada kebijakan redaksi.
6. **Reporter / Reporter**
   - Melakukan peliputan, wawancara, dan penulisan berita di lapangan. Bertanggung jawab atas keakuratan dan kelengkapan data berita.
7. **Writer / Penulis**
   - Menulis artikel, opini, atau feature berdasarkan riset atau penugasan. Fokus pada kualitas penulisan dan orisinalitas konten.
8. **Contributor / Kontributor**
   - Menyumbang artikel secara lepas (freelance/guest). Tidak terikat struktur redaksi, namun tetap mengikuti standar editorial.
9. **Account Executive / Eksekutif Akun**
   - Mengelola penjualan dan pemasangan iklan/banner. Berkoordinasi dengan tim bisnis dan klien, tidak terlibat dalam proses editorial.
10. **Subscriber / Pelanggan**
    - Konsumen/pembaca berita. Dapat mengakses konten, berkomentar, dan berinteraksi, namun tidak terlibat dalam proses produksi berita.

---

## Hak Akses / Kemampuan per Role

### 1. **Admin / Administrator**

- Semua akses penuh ("all")
- Kelola sistem, user, pengaturan, iklan
- Lihat analytics
- Kelola editorial (artikel, publish, takedown, approve, edit, create, delete permanent)
- Akses menu: Dashboard, Articles, Create Article, Categories, Users, Analytics, Editor Activity, Push Notifications, Selected Topics, Settings

### 2. **Editor-in-Chief / Pemimpin Redaksi**

- Kelola editorial
- Publish, takedown, approve artikel
- Edit semua artikel, create artikel
- Lihat semua KPI
- Akses menu: Dashboard, Articles, Create Article, Categories, Users, Analytics

### 3. **Managing Editor / Redaktur Pelaksana**

- Publish, takedown, approve artikel
- Edit semua artikel, create artikel
- Lihat KPI penulis
- Akses menu: Dashboard, Articles, Create Article, Categories, Analytics

### 4. **Head of / Kepala Bidang**

- Approve kategori
- Edit semua artikel, create artikel
- Lihat KPI tim
- Akses menu: Dashboard, Articles, Create Article, Categories, Analytics

### 5. **Editor / Editor**

- Edit semua artikel, create artikel
- Reject, submit to head
- Akses menu: Dashboard, Articles, Create Article, Categories, Analytics

### 6. **Reporter / Reporter**

- Create artikel, edit artikel sendiri
- Lihat KPI sendiri
- Submit draft, upload media mobile
- Akses menu: Dashboard, Articles, Create Article, Categories, Analytics

### 7. **Writer / Penulis**

- Create artikel, edit artikel sendiri
- Lihat KPI sendiri
- Submit draft
- Akses menu: Dashboard, Articles, Create Article, Categories, Analytics

### 8. **Contributor / Kontributor**

- Create artikel, edit artikel sendiri
- Submit draft
- Akses menu: Dashboard, Articles, Create Article, Categories, Analytics

### 9. **Account Executive / Eksekutif Akun**

- Kelola iklan/banner (CRUD)
- Lihat statistik klik iklan
- Lihat konten/preview website (cek posisi iklan)
- Tidak bisa create/edit/publish artikel
- Akses menu: Dashboard, Analytics (khusus iklan)

### 10. **Subscriber / Pelanggan**

- Lihat konten
- Komentar
- Tidak ada akses ke admin

---

## Catatan Sidebar (Menu Admin)

- Menu **Users** hanya untuk `admin` & `editor-in-chief`
- Menu **Editor Activity**, **Push Notifications**, **Selected Topics**, **Settings** hanya untuk `admin`
- Role lain hanya melihat menu yang relevan sesuai hak aksesnya

---

## Alur Kerja Artikel

Berikut adalah alur proses artikel dari penulisan hingga artikel dipublikasikan dan dibaca, beserta role yang terlibat dan tanggung jawabnya pada setiap tahap:

### 1. Penulisan Artikel

- **Writer / Penulis**, **Reporter / Reporter**, **Contributor / Kontributor**
  - Menulis draft artikel, opini, feature, atau berita berdasarkan riset, penugasan, atau peliputan lapangan.
  - Bertanggung jawab atas orisinalitas, kelengkapan, dan keakuratan data.

### 2. Pengajuan Draft

- **Writer / Penulis**, **Reporter / Reporter**, **Contributor / Kontributor**
  - Mengajukan draft artikel ke sistem untuk direview oleh editor.

### 3. Penyuntingan & Review

- **Editor / Editor**
  - Memeriksa, menyunting, dan memperbaiki draft artikel.
  - Menjamin kualitas, akurasi, dan kepatuhan pada kebijakan redaksi.
  - Dapat mengembalikan draft ke penulis untuk revisi jika diperlukan.

### 4. Persetujuan Desk / Bidang

- **Head of / Kepala Bidang**
  - Melakukan supervisi dan persetujuan konten di bidang/liputan masing-masing.
  - Memastikan artikel sesuai dengan standar desk sebelum naik ke tahap berikutnya.

### 5. Finalisasi & Approval Redaksi

- **Managing Editor / Redaktur Pelaksana**, **Editor-in-Chief / Pemimpin Redaksi**
  - Melakukan review akhir, approval, dan penjadwalan publish.
  - Menetapkan kelayakan terbit dan memastikan artikel sesuai kebijakan editorial.

### 6. Publikasi Artikel

- **Admin / Administrator**, **Editor-in-Chief / Pemimpin Redaksi**, **Managing Editor / Redaktur Pelaksana**
  - Melakukan aksi publish (terbit) artikel ke website.
  - Bertanggung jawab atas kontrol akhir dan troubleshooting jika ada kendala teknis.

### 7. Distribusi & Notifikasi

- **Admin / Administrator**
  - Mengelola distribusi artikel (misal: push notification, media sosial, dsb).

### 8. Konsumsi / Pembacaan

- **Subscriber / Pelanggan**
  - Mengakses, membaca, dan berinteraksi dengan artikel yang telah dipublikasikan.
