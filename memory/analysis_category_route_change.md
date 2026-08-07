# Laporan Analisis: Perubahan Format Route Kategori (`/category/[slug]` -> `/[slug]`)

**Tanggal**: 31 Juli 2026  
**Project**: Arasvara (`/home/padli/Projects/arasvara`)  
**Penulis**: Antigravity AI Assistant  

---

## 1. Ringkasan Eksekutif & Opini

Perubahan format URL kategori dari `/category/ekonomi` menjadi langsung `/ekonomi` **sangat direkomendasikan** dan **sangat memungkinkan untuk diimplementasikan secara bersih** pada project Arasvara.

### Keuntungan Utama:
1. **SEO & UX Lebih Bersih**: URL menjadi lebih singkat, elegan, mudah diingat, dan selaras dengan media digital modern.
2. **Kesesuaian Arsitektur**: Struktur artikel Arasvara saat ini sudah menggunakan format permalink `/[category]/[yyyy]/[mm]/[dd]/[slug]` (5 segmen). Menempatkan landing page kategori di `/[category]` (1 segmen) melengkapi hirarki rute publik secara alami.
3. **Dukungan Native Next.js App Router**: Next.js dapat membedakan rute 1 segmen (`/ekonomi`) dan 5 segmen (`/ekonomi/2026/07/31/judul-artikel`) secara otomatis tanpa ada konflik rute artikel.

---

## 2. Analisis Struktur Rute Saat Ini vs Usulan

| Komponen | Format Saat Ini | Format Usulan Baru |
| :--- | :--- | :--- |
| **Landing Page Kategori** | `/category/ekonomi` | `/ekonomi` |
| **Halaman Artikel** | `/ekonomi/2026/07/31/judul-artikel` | `/ekonomi/2026/07/31/judul-artikel` *(tetap sama)* |
| **Lokasi File Next.js** | `src/app/(public)/category/[category]/page.tsx` | `src/app/(public)/[category]/page.tsx` |

### Cara Kerja di Next.js App Router:
Di dalam folder `src/app/(public)/[category]`:
- `page.tsx` (1 segmen): Menangani URL `/ekonomi`, `/politik`, `/teknologi`, dll.
- `[yyyy]/[mm]/[dd]/[slug]/page.tsx` (5 segmen): Menangani rincian artikel.

Next.js secara cerdas membedakan jumlah segmen URL sehingga rute kategori dan rute artikel tidak saling mengganggu.

---

## 3. Analisis Dampak, Risiko & Hal Yang Perlu Diperhatikan

### A. Potensi Bentrokan Rute (Route Collision & Reserved Slugs)
Karena rute kategori berada di root level (`/`), Next.js akan mendahulukan **rute statis** daripada rute dinamis `[category]`.
- **Rute Statis Terproteksi**: `/indeks`, `/news`, `/penulis`, `/search`, `/login`, `/admin-xyz`, `/sitemap.xml`, `/robots.txt`, `/api`.
- **Risiko**: Jika admin membuat kategori baru bernama `"search"` atau `"news"` atau `"penulis"`, rute kategori tersebut tidak akan pernah bisa diakses karena tertimpa rute statis.
- **Solusi**:
  - Arasvara sudah memiliki `RESERVED_ROOT_SEGMENTS` di `src/lib/article-public-path.ts`.
  - Pastikan `"category"` tetap ada atau dihapus sesuai kebutuhan, dan tambahkan validasi di CMS admin saat pembuatan/pengubahan slug kategori agar tidak bisa memakai slug reserved.

### B. SEO & Backward Compatibility (Pengalihan 301 Redirect)
Tautan kategori lama (misal `/category/ekonomi`) yang sudah terindeks oleh Google/mesin pencari atau disimpan oleh pengguna dalam bookmark akan menghasilkan error 404 jika tidak ditangani.
- **Solusi**:
  - Pertahankan handler di `/category/[category]` atau tambahkan 301 Permanent Redirect di Next.js (`next.config.ts` atau middleware/redirect page) dari `/category/:slug` ke `/:slug`.

### C. Penanganan Error 404 (Halaman Tidak Ditemukan)
Jika pengunjung mengetik URL 1 segmen yang tidak ada di basis data (misal `/random-kategori-ngasal`), Next.js akan mencocokkannya ke `src/app/(public)/[category]/page.tsx`.
- **Solusi**: `CategoryClient` / `CategoryPage` harus memverifikasi keberadaan kategori. Jika slug kategori tidak valid/tidak ditemukan, panggil fungsi `notFound()` milik Next.js agar menampilkan halaman 404 secara konsisten.

---

## 4. Item Kode yang Perlu Diperbarui Saat Implementasi

Berdasarkan analisis repositori, berikut adalah daftar file yang terkena dampak jika perubahan ini dilakukan nanti:

1. **Routing App Router**:
   - Pindahkan `src/app/(public)/category/[category]` -> `src/app/(public)/[category]/page.tsx` & `CategoryClient.tsx`.
   - Tambahkan 301 redirect untuk rute lama `/category/[category]`.

2. **Komponen Navigasi & UI**:
   - [NavbarContainer.tsx](file:///home/padli/Projects/arasvara/src/components/navbar/NavbarContainer.tsx): Ubah `href={`/category/${cat.slug}`}` menjadi `href={`/${cat.slug}`}`.
   - [DrawerNavbar.tsx](file:///home/padli/Projects/arasvara/src/components/navbar/DrawerNavbar.tsx): Ubah return `/category/${slug}` menjadi `/${slug}`.
   - [Navbar.tsx](file:///home/padli/Projects/arasvara/src/components/navigation/Navbar.tsx): Ubah link kategori desktop & mobile.
   - [ArticleUi.tsx](file:///home/padli/Projects/arasvara/src/components/news/ArticleUi.tsx): Ubah badge link kategori artikel.

3. **Utility & Sitemap**:
   - [constants.ts](file:///home/padli/Projects/arasvara/src/lib/constants.ts): Ubah `href: "/category/international"` -> `href: "/international"`, dll.
   - [sitemap-xml.ts](file:///home/padli/Projects/arasvara/src/lib/sitemap-xml.ts): Ubah `/category/${category.slug}` -> `/${category.slug}`.
   - [article-public-path.ts](file:///home/padli/Projects/arasvara/src/lib/article-public-path.ts): Perbarui daftar `RESERVED_ROOT_SEGMENTS` jika diperlukan.

---

## 5. Kesimpulan & Langkah Selanjutnya

Rencana perubahan dari `/category/ekonomi` menjadi `/ekonomi` **sangat baik untuk dilakukan**. Tidak ada kendala arsitektural yang berarti, dan Next.js App Router sangat mendukung struktur ini.

**Langkah Selanjutnya**:
Laporan ini telah disimpan di `memory/analysis_category_route_change.md`. Apabila Anda menyetujui analisis ini, saya dapat melanjutkan untuk membuat Implementation Plan lengkap dan mengeksekusi perubahan kodenya.
