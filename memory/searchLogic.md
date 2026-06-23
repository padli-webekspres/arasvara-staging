Tentu, mari kita susun dokumentasi logika pencariannya agar terstruktur rapi dan mudah dipahami. Ini akan sangat berguna sebagai panduan teknis saat kamu atau tim meracik logika _backend_ maupun _state management_ di _frontend_.

Sesuai diskusi kita sebelumnya, arsitektur pencarian ini menggunakan sistem **Pemisahan Mode Eksklusif** (Mode Artikel vs. Mode Video) untuk menjamin performa _database_ yang efisien dan logika yang tidak saling bentrok.

Berikut adalah penjelasan lengkap logika _filter_ dan kombinasinya:

---

### 1. Aturan Emas Kombinasi (Inter-Filter vs Intra-Filter)

Sebelum masuk ke detail, penting untuk memahami hukum dasar kombinasi _filter_ dalam pencarian ini:

- **Intra-Filter (Di dalam satu jenis filter):** Menggunakan logika **OR**. Artinya, jika pengguna memilih Kategori A dan Kategori B, maka artikel yang muncul cukup memiliki Kategori A _ataupun_ Kategori B.
- **Inter-Filter (Antar jenis filter berbeda):** Menggunakan logika **AND**. Artinya, jika pengguna mengetik kata kunci "Tim" dan memilih Kategori A, maka artikel yang muncul **wajib** mengandung kata "Tim" _dan_ berada di Kategori A.

---

### 2. Logika Mode 1: Pencarian "Artikel"

Jika pengguna berada di tab/mode Artikel, sistem akan melakukan _query_ ke _collection_ `articles`.

**Filter yang Aktif & Logikanya:**

- **Pencarian Teks Bebas (Search Bar)**
  - **Kondisi:** Mencari kecocokan sebagian kata (LIKE / Regex Case-Insensitive).
  - **Target (Logika OR):** Mencari di dalam `title`, `metaDescription`, `tags.name`, `category.name`, atau `author.name`. Cukup salah satu dari kolom tersebut cocok dengan kata kunci, artikel akan ditarik.
- **Kategori (Checkbox Multiple)**
  - **Kondisi:** Jika _user_ mencentang [Tech, Food].
  - **Logika:** Mencari artikel yang _categoryId_-nya adalah Tech **OR** Food.
- **Tags (Checkbox Multiple)**
  - **Kondisi:** Jika _user_ mencentang [Gadget, Kuliner].
  - **Logika:** Mencari artikel yang _tags.name_-nya memiliki elemen Gadget **OR** Kuliner.
- **Tipe Artikel (Checkbox Multiple)**
  - **Kondisi:** Pilihan yang tersedia hanya "Standard" dan "Fotografi" (Gallery). Pilihan "Social Media" disembunyikan.
  - **Logika:** Mencari artikel dengan `format` = "STANDARD" **OR** "GALLERY".
- **Status Khusus / Flags (Checkbox Multiple)**
  - **Kondisi:** Jika _user_ mencentang [Popular, Pilihan Editor, Headline].
  - **Logika:** Mencari artikel yang berada di tabel _articles_popular_ **OR** _editor_choices_ **OR** memiliki `isHeadline: true`.
- **Rentang Tanggal (Date Picker)**
  - **Kondisi:** Filter berdasarkan `published_at`.
  - **Logika:** Memiliki nilai `start_date` (Lebih besar dari / `$gte`) **AND** `end_date` (Lebih kecil dari / `$lte`). Rentang tanggal ini bersifat absolut dan menimpa _filter_ lain dengan logika **AND**.
- **Sorting (Pengurutan)**
  - **Pilihan:** Tanggal (`published_at`), Total View (`viewCount`), dan Judul (`title`).
  - **Arah:** Ascending (Asc) atau Descending (Desc).

---

### 3. Logika Mode 2: Pencarian "Sosial Media" (Video)

Jika pengguna berpindah ke tab/mode Video, sistem akan membuang _state filter_ artikel dan murni melakukan _query_ ke _collection_ `video_section`.

**Filter yang Aktif & Logikanya:**

- **Pencarian Teks Bebas (Search Bar)**
  - **Kondisi:** Hanya melakukan pencarian teks LIKE / Regex pada `title`. (Karena _collection_ video tidak memiliki atribut _author name_ atau _tags_).
- **Platform Video (Checkbox Multiple)**
  - **Kondisi:** Menggantikan _filter_ Tipe Artikel. Pilihan yang tersedia: [TikTok, Instagram, YouTube].
  - **Logika:** Mencari video dengan atribut `type` = "tiktok" **OR** "instagram" **OR** "youtube".
- **Rentang Tanggal (Date Picker)**
  - **Kondisi:** Filter berdasarkan `createdAt` (karena _video_section_ tidak menggunakan `published_at`).
  - **Logika:** `$gte` start_date **AND** `$lte` end_date.
- **Sorting (Pengurutan)**
  - **Pilihan:** Hanya berdasarkan Tanggal (`createdAt`) secara Asc/Desc. Pengurutan _View Count_ disembunyikan karena skema database video tidak memilikinya.

**Filter yang Di-Disable / Disembunyikan:**
Kategori, Tags, Tipe Artikel (Standard/Fotografi), dan Status Khusus (Populer/Editor/Headline) dinonaktifkan sepenuhnya.

---

### 4. Contoh Skenario Kombinasi Logika (Use Case)

**Skenario:** Pengguna mengetik **"Nasi Goreng"**, mencentang Kategori **"Food"**, mencentang Tags **"Legendaris"** dan **"Pedas"**, serta mencentang **"Pilihan Editor"**.

**Mesin _Backend_ akan menerjemahkan logikanya menjadi:**
Ambil data dari `articles` **YANG MANA**:

1. (`title` LIKE "Nasi Goreng" **OR** `metaDescription` LIKE "Nasi Goreng" **OR** `author` LIKE "Nasi Goreng")
   **AND**
2. (`category` = "Food")
   **AND**
3. (`tags` = "Legendaris" **OR** `tags` = "Pedas")
   **AND**
4. (`id` TERMASUK DALAM _editor_choices_)

Dengan mendokumentasikan logika ini, proses pembuatan UI di _frontend_ (pengiriman parameter API) dan pengolahan _query_ di _backend_ (MongoDB aggregation/find) akan memiliki pedoman yang sangat tegas dan tidak ambigu.
