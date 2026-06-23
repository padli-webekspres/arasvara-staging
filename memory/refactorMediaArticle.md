# Refactor Relasi Media pada Article

## Goals

- Menjadikan `featuredImage` pada koleksi Article sebagai relasi ke koleksi Media (menyimpan ObjectId media, bukan url langsung).
- Menjadikan image pada field `content` Article juga sebagai relasi ke koleksi Media (bukan url/file langsung), sehingga setiap gambar di content mengacu ke id media.
- Memastikan satu media bisa dipakai di banyak article (featuredImage) dan banyak content, serta satu content bisa mengandung banyak media.
- Menyiapkan struktur data dan logika agar scalable, maintainable, dan mudah di-query.

## Logika Article & Media

- **featuredImage**: Menyimpan ObjectId dari koleksi Media. Saat render, ambil data media berdasarkan id ini.
- **content**:
  - Jika masih HTML, gambar di content harus menggunakan tag khusus, misal: `<img data-media-id="xxx" />`.
  - Jika menggunakan editor blok (misal Tiptap), blok image harus menyimpan `mediaId`.
  - Saat render, resolve mediaId menjadi url/media data.
- **Relasi**:
  - 1 Media bisa dipakai di banyak Article (featuredImage) dan banyak content.
  - 1 featuredImage hanya 1 Media.
  - 1 content bisa mengandung banyak media.

## Struktur Data (Draft)

### Media

```ts
interface Media {
  _id: string;
  url: string;
  filename: string;
  mimetype: string;
  size: number;
  caption?: string;
  takenBy?: string;
  watermark?: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### Article

```ts
interface Article {
  _id: string;
  title: string;
  // ...existing fields
  featuredImage: string; // ObjectId media
  content: string; // HTML dengan <img data-media-id="xxx" /> atau blok dengan mediaId
  // ...existing fields
}
```

## File yang Perlu Ditinjau & Diubah

1. **src/types/article.ts** — Update tipe Article, featuredImage, dan content.
2. **src/types/media.ts** — Pastikan tipe Media sudah sesuai.
3. **src/services/articleService.ts** — Logic CRUD article, simpan & fetch featuredImage dan content sebagai relasi.
4. **src/services/mediaService.ts** — Logic fetch media by id.
5. **src/app/api/article/route.ts** — Endpoint API article, simpan & populate relasi media.
6. **src/app/api/media/route.ts** — Endpoint API media (jika perlu populate reverse relasi).
7. **src/components/media/CardMedia.tsx** — Komponen render media.
8. **src/components/article/** (jika ada) — Komponen render article & content, resolve mediaId di content.
9. **src/lib/db/** — Logic query ke MongoDB, populate relasi.
10. **Editor (Tiptap/dll)** — Logic insert image harus menyimpan mediaId, bukan url.
11. **Migrasi Data** — Script migrasi url lama ke id media (opsional, jika ada data lama).

## Catatan

- Semua logic upload, edit, dan render article harus diupdate agar konsisten menggunakan id media.
- Perlu konversi data lama jika sudah ada article yang menyimpan url langsung.
- Perlu testing pada proses create, update, dan render article.

---

## Urutan & Logika Implementasi (Frontend & Backend)

### 1. Isi Form & Simpan ke LocalStorage/IndexedDB

- Semua field form (termasuk featuredImage dan content) disimpan ke localStorage (atau IndexedDB untuk autosave/draft).
- Jika user memilih gambar dari galeri media (sudah ada di DB), simpan ID media ke localStorage.
- Jika user upload gambar baru (featured/content), simpan file sementara di IndexedDB, dan url blob-nya di localStorage untuk preview.

### 2. Submit (Publish/Save)

- Untuk setiap gambar yang belum ada di server (masih blob):
  - Upload ke endpoint POST `/media` (kirim file).
  - Ambil response object media, gunakan `_id` dari media sebagai relasi.
  - Ganti url blob di localStorage/draft dengan ID media yang baru.
- Untuk gambar yang sudah ada (dipilih dari galeri), langsung gunakan ID media-nya.
- Lakukan hal yang sama untuk semua gambar di content (replace semua url blob dengan ID media).

### 3. Kirim Article ke Backend

- Payload POST `/article`:
  - Semua field artikel (title, content, dsb).
  - `featuredImage` berisi ID media (bukan url/blob).
  - Untuk content, pastikan semua gambar sudah pakai ID media (misal: `<img data-media-id="xxx" />` atau format blok dengan mediaId).
- Backend menyimpan article dengan relasi ke koleksi media.

### Ringkasan Urutan

1. Isi form → simpan ke localStorage/IndexedDB (autosave/draft).
2. Pilih/upload gambar (featured/content) → simpan ID media (jika sudah ada) atau url blob (jika baru).
3. Submit:
   - Upload semua gambar baru ke `/media`, dapatkan ID media.
   - Replace semua url blob dengan ID media.
   - Kirim payload ke `/article` dengan relasi ID media.
4. Backend menyimpan article dengan relasi ke media.

### Catatan

- Untuk UX terbaik, lakukan upload gambar ke `/media` secara otomatis saat user memilih/upload gambar, sehingga ID media sudah siap saat submit.
- Untuk content, parsing dan replace url blob ke ID media bisa dilakukan sebelum submit.

---

> **Dokumen ini menjadi acuan utama refactor relasi media pada article. Semua perubahan harus mengacu pada struktur dan logika di atas.**
