### TAHAP 1: Quick Wins & Kosmetik UI (Kompleksitas: Sangat Rendah)

*Fokus: Ubah teks, sembunyikan elemen, dan pergeseran *layout*. Ini bisa diselesaikan di Hari ke-1.*

1. **Ubah Teks Label (Frontend & CMS):**

- Ubah teks "Supported By" menjadi "Collaborated by".
- Ubah teks "Earlier Stories" menjadi "Berita Terupdate".
- Ubah teks "Arah Lensa" menjadi "Lensa Foto".
- **Status Draft -> Waiting:** _Saran Penting:_ Jangan ubah _enum_ `DRAFT` di _database_ karena akan merusak banyak _query_. Cukup ubah teks yang ditampilkan (Label UI) di _dashboard_ CMS dari "Draft" menjadi "Waiting".

2. **Sembunyikan Elemen (Frontend & CMS):**

- Sembunyikan _section_ YouTube di _homepage_ (bisa di-komen di kode atau matikan via _config_).
- Sembunyikan _section_ "Slide" yang memaksa membaca berita.
- Sembunyikan _Footer Sections_ dan _Channels_, sisakan tautan "More" saja.
- Sembunyikan kolom "Atribusi Artikel" pada form CMS.

3. **Pindah Posisi Tampilan (Frontend):**

- Pindahkan komponen _About Us_ ke posisi paling bawah (tepat di atas _footer_).

---

### TAHAP 2: Penyesuaian Fitur Ringan & Konfigurasi (Kompleksitas: Rendah)

_Fokus: Memperbaiki pengalaman pengguna (UX) dan konfigurasi yang sudah ada. Target Hari ke-2._

4. **Jumlah Karakter di TipTap Editor (CMS):**

- Tambahkan ekstensi `CharacterCount` bawaan dari TipTap. Ini sangat mudah diimplementasikan, cukup tambahkan `CharacterCount` di daftar `extensions` dan tampilkan angkanya di bawah _editor_ (`editor.storage.characterCount.characters()`).

5. **Konfigurasi Kanal / Kategori (Database/CMS):**

- Sinkronkan 6 kanal populer antara CMS dan Website.
- Tambahkan kategori baru di _database_: "Metropolitan", "Opini", dan "Sports".

6. **Perbaiki Kompresi Foto (CMS / Backend):**

- Jika kamu menggunakan _library_ seperti `sharp` di backend, naikkan parameter `quality` (misal dari `60` ke `80` atau `85`).
- Jika kompresi dilakukan di sisi _frontend_ (canvas) sebelum _upload_, sesuaikan tingkat kompresinya agar resolusi tidak terlalu pecah demi SEO.

7. **Perbaiki UX Input Tags (CMS):**

- Ubah _input text_ biasa yang menggunakan koma menjadi komponen _Tag Input_ sesungguhnya (bisa mendeteksi tombol `Enter` untuk membuat _badge/pill_ tag).

---

### TAHAP 3: Logika Data & Routing (Kompleksitas: Menengah)

_Fokus: Menghubungkan data yang sudah ada dengan antarmuka. Target Hari 3-4._

8. **Ganti Sumber Data Section (Frontend):**

- Ubah _query_ API untuk _section_ "Dilarang nyeker" agar mengambil (fetch) artikel dengan kategori "Style Z".
- Gabungkan aliran data (fetch) artikel TikTok dan Reels ke dalam satu komponen _section_ baru bernama "Sosmed".

9. **Logika Status Takedown (CMS & Backend):**

- Saat tombol "Hapus" ditekan, ubah logika fungsinya. Jangan memanggil `api.delete()` yang menghapus permanen di _database_.
- Ganti menjadi pemanggilan `api.patch()` untuk mengubah status artikel menjadi `TAKEN_DOWN` (yang sudah ada di _enum_ sistemmu). Pastikan _query_ di halaman publik memfilter status ini agar tidak tampil.

10. **Integrasi Halaman Tags (Frontend):**

- Buat _dynamic route_ baru di frontend (misal: `/tags/[slug]`).
- Buat halaman yang melakukan _fetch_ artikel berdasarkan tag yang diklik oleh _user_.

---

### TAHAP 4: Refactoring & Logika Kompleks (Kompleksitas: Tinggi)

_Fokus: Perubahan fundamental pada arsitektur data dan algoritma. Target Hari 5-6._

11. **Masalah Caption Gambar (CMS & Backend):**

- **Ini adalah implementasi dari rencana _refactoring_ yang baru saja kita bahas sebelumnya.**
- Masalah klien ini terjadi karena _caption_ masih terikat di koleksi fisik `media`. Kamu harus mengimplementasikan objek `ArticleMediaEmbed` (yang menyimpan _caption_ spesifik) ke dalam struktur `featuredImage` artikel, lalu memastikan UI form CMS mengirimkan _caption_ tersebut ke _payload_ artikel.

12. **Fitur Auto Page Break (CMS / Frontend):**

- Ini adalah yang paling rumit karena memengaruhi panjang teks dan HTML.
- Menghilangkan _manual page break_ berarti sistem harus menghitung jumlah kata, paragraf, atau karakter secara otomatis.
- **Strategi:** Jangan lakukan pembelahan (split) di _database_. Simpan HTML utuh di MongoDB. Lakukan logika _Auto Page Break_ di **Frontend (Sisi Klien/Server saat render)**. Buat fungsi _parser_ yang memecah HTML string menjadi beberapa bagian (halaman) setiap kali mendeteksi elemen `<p>` yang melewati ambang batas jumlah kata tertentu (misalnya per 300 kata).
