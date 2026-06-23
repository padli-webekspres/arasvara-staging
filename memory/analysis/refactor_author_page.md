# Plan Implementasi: Halaman Author Berbasis Slug + Nama Unik

> **Dibuat:** 2026-06-23  
> **Status:** Fase A–F selesai (kode); Fase G (QA deploy prod) belum  
> **Permintaan produk:** URL publik penulis memakai **slug** (bukan `_id`); pada create/edit user, **nama tidak boleh duplikat** agar setiap slug unik.

---

## Ringkasan Perubahan

### Format URL

| Aspek | Saat ini | Target |
|-------|----------|--------|
| Route folder | `src/app/(public)/author/[id]/` | `src/app/(public)/author/[slug]/` |
| URL contoh | `/author/674a1b2c3d4e5f6789012345` | `/author/andi-pratama` |
| Lookup halaman | `getUserByIdOrEmail(db, id)` | `getUserBySlug(db, slug)` (+ fallback opsional, lihat R3) |
| Link di kartu artikel | `href={/author/${article.author._id}}` | `href={/author/${article.author.slug}}` |

### Kebijakan data

| Aspek | Keputusan |
|-------|-----------|
| Sumber slug | `slugify(name, { lower: true, strict: true })` — pola sama dengan kategori |
| Unik nama | **Wajib unik** di seluruh user aktif (`deletedAt` null/kosong), bukan hanya role penulis |
| Normalisasi nama | `trim` + lowercase + NFKD + hapus tanda baca + collapse whitespace (konsisten dengan `article-validation.ts`) |
| Unik slug | Index unique sparse pada field `slug` |
| Ubah nama | Slug di-regenerate; URL lama **404** (tanpa redirect, selaras refactor URL artikel) |
| Field internal `authorId` di artikel | **Tetap** ObjectId — tidak diubah |

---

## Audit Codebase (Kondisi Saat Ini)

### Routing & halaman publik

| File | Keterangan |
|------|------------|
| `src/app/(public)/author/[id]/page.tsx` | Server component; param `id`; lookup via `getUserByIdOrEmail` |
| `src/app/(public)/author/[id]/AuthorClient.tsx` | Client; fetch artikel via `/search?authorId=...` (ObjectId) |

### Tipe & model user

| File | Keterangan |
|------|------------|
| `src/types/user.ts` | `User` / `UserProfile` — **belum ada** field `slug` atau `nameNormalized` |
| `src/services/userService.ts` | `createUser`, `editUser`, `getUserByIdOrEmail`, `getAllAuthors`, `mapDocToUser` — hanya cek email unik |

### API

| File | Keterangan |
|------|------------|
| `src/app/api/users/route.ts` | POST create user — tidak validasi nama duplikat |
| `src/app/api/users/[idOrSlug]/route.ts` | Nama param `idOrSlug`, tetapi service hanya resolve `_id` atau `email` |
| `src/app/api/users/author/route.ts` | Daftar penulis untuk picker CMS |
| `src/app/api/search/route.ts` | Filter `authorId` (ObjectId hex) — dipakai halaman author |

### Link publik ke `/author/...` (perlu diubah ke slug)

| File | Baris (approx) |
|------|----------------|
| `src/components/news/NewsCard.tsx` | `href={/author/${article.author._id}}` |
| `src/components/news/SecondaryNewsCard.tsx` | sama |
| `src/components/news/ArticleUi.tsx` | sama |
| `src/components/navigation/MobileMenu.tsx` | `href={"/author/" + userAuthed._id}` |
| `src/app/admin-xyz/analytics/editor-activity/page.tsx` | `href={/author/${row.user._id}}` |

### Populate & denormalisasi author di artikel

| File | Keterangan |
|------|------------|
| `src/services/searchService.ts` | `USER_POPULATE_PROJECTION` — `_id, name, email, avatar, role` (tanpa slug) |
| `src/services/article/getArticleService.ts` | Map `author._id`, `author.name` |
| `src/services/article/coreWriteArticleService.ts` | `mongoUserToProfile()` — tanpa slug |
| `src/app/api/refactoring-articles/denormalization/route.ts` | Sync `author.name`, `author.role` — belum `author.slug` |

### CMS create/edit user

| File | Keterangan |
|------|------------|
| `src/components/users/CreateUserDialog.tsx` | Zod: `name` min 1 — tidak cek duplikat |
| `src/components/users/EditUserDialog.tsx` | PATCH ke `/api/users/${user._id}` |
| `src/components/users/FormUserDialogUi.tsx` | UI form bersama |

### Referensi pola validasi unik (bisa diadaptasi)

| File | Pola |
|------|------|
| `src/lib/article-validation.ts` | `normalizeArticleTitle`, `ArticleValidationError`, conflict check di DB |
| `src/services/categoryService.ts` | `slugify(name)` + cek slug exists saat create |

### Tidak terdampak langsung (tetap pakai `_id` internal)

- `authorId` di `articles`, CMS filter, analytics, KPI, scheduled publish, GA tracking
- `src/app/admin-xyz/profile/[id]/page.tsx` — admin internal, boleh tetap `_id`

---

## Requirement

### R1 — URL publik berbasis slug

| ID | Requirement |
|----|-------------|
| R1.1 | Route: `/author/{slug}` |
| R1.2 | `slug` URL-safe, lowercase, dari `slugify` |
| R1.3 | Halaman 404 jika slug tidak ditemukan / user soft-deleted |
| R1.4 | Metadata OG/title tetap memakai `user.name` |

### R2 — Nama unik

| ID | Requirement |
|----|-------------|
| R2.1 | Create user: tolak jika `nameNormalized` sudah dipakai user aktif lain |
| R2.2 | Edit user: sama, exclude `_id` user yang sedang diedit |
| R2.3 | Pesan error jelas (HTTP 409): `"Nama penulis sudah digunakan"` |
| R2.4 | Placeholder/kosong tetap ditolak (min 1 karakter setelah trim) |

### R3 — Slug unik & regenerasi

| ID | Requirement |
|----|-------------|
| R3.1 | `slug` disimpan eksplisit di dokumen `users` |
| R3.2 | Index unique sparse: `{ slug: 1 }` dengan filter `deletedAt` null/kosong |
| R3.3 | Saat nama berubah → hitung slug baru |
| R3.4 | Jika `slugify(name)` bentrok (edge case karakter khusus) → suffix numerik `-2`, `-3`, … |
| R3.5 | URL `/author/{slug-lama}` → 404 setelah rename (no redirect) |
| R3.6 | *(Opsional transisi)* Lookup halaman boleh terima ObjectId valid sebagai fallback tanpa redirect — hanya untuk bookmark lama; **tidak** dipublikasikan di link baru |

### R4 — Konsistensi data di artikel

| ID | Requirement |
|----|-------------|
| R4.1 | Tambah `author.slug` pada denormalisasi artikel (write + update user) |
| R4.2 | Populate search/API mengembalikan `author.slug` untuk komponen kartu |
| R4.3 | Saat `editUser` mengubah nama/slug → batch update `articles` where `authorId` |

### R5 — Helper terpusat

| ID | Requirement |
|----|-------------|
| R5.1 | `buildAuthorPublicPath(slug)` → `/author/{slug}` |
| R5.2 | Semua link publik memakai helper ini (hindari string concat tersebar) |

---

## Fase Implementasi

### Fase A — Fondasi schema & validasi

**Tujuan:** Siapkan kontrak data dan utilitas sebelum ubah routing.

| # | Task | File utama |
|---|------|------------|
| A1 | Tambah field `slug: string` dan `nameNormalized: string` pada `User`, `UserProfile` | `src/types/user.ts` |
| A2 | Buat `src/lib/user-validation.ts`: `normalizeUserName`, `generateUserSlug`, `findUserNameConflict`, `UserValidationError` | baru |
| A3 | Unit test normalisasi & slug generation | `src/lib/user-validation.test.ts` (opsional tapi disarankan) |
| A4 | Dokumentasi index MongoDB yang diperlukan | bagian Deploy di dokumen ini |

**Index MongoDB (jalankan manual / migration script):**

```js
// users — nama unik (aktif saja)
db.users.createIndex(
  { nameNormalized: 1 },
  {
    unique: true,
    partialFilterExpression: { deletedAt: { $in: [null, ""] } },
    name: "users_nameNormalized_unique_active",
  }
);

// users — slug unik (aktif saja)
db.users.createIndex(
  { slug: 1 },
  {
    unique: true,
    partialFilterExpression: { deletedAt: { $in: [null, ""] } },
    name: "users_slug_unique_active",
  }
);
```

**Exit criteria Fase A:** Tipe + helper validasi + test lulus; index terdokumentasi.

---

### Fase B — Service layer & API

**Tujuan:** Create/edit/lookup user mendukung slug dan validasi nama.

| # | Task | File utama |
|---|------|------------|
| B1 | `mapDocToUser` baca `slug`, `nameNormalized` | `userService.ts` |
| B2 | `createUser`: hitung `nameNormalized` + `slug`, cek konflik, simpan | `userService.ts` |
| B3 | `editUser`: jika `name` berubah → validasi unik + regenerate slug | `userService.ts` |
| B4 | Tambah `getUserBySlug(db, slug)` | `userService.ts` |
| B5 | Perluas `getUserByIdOrEmail` → `getUserByIdOrEmailOrSlug` (prioritas: ObjectId → slug → email) | `userService.ts` |
| B6 | `userDocAuditSnapshot` sertakan `slug` | `userService.ts` |
| B7 | API POST/PATCH map `UserValidationError` → HTTP 409 + kode `DUPLICATE_NAME` | `api/users/route.ts`, `api/users/[idOrSlug]/route.ts` |
| B8 | Buat `src/lib/author-public-path.ts` dengan `buildAuthorPublicPath(slug)` | baru |

**Exit criteria Fase B:** Create/edit user gagal dengan 409 jika nama duplikat; GET user by slug berfungsi via API.

---

### Fase C — Migrasi data existing

**Tujuan:** Backfill slug untuk user lama; selesaikan konflik nama sebelum index unique.

| # | Task | File utama |
|---|------|------------|
| C1 | Script audit: daftar nama duplikat (normalized) & slug bentrok | `scripts/audit-user-names-slugs.ts` |
| C2 | Script backfill: set `nameNormalized` + `slug` untuk semua user aktif | `scripts/backfill-user-slugs.ts` |
| C3 | Strategi resolve duplikat nama existing (manual): rename di DB atau suffix ` (2)` pada `name` | runbook di bawah |
| C4 | NPM scripts: `audit:user-slugs`, `backfill:user-slugs` (+ varian `:prod` jika perlu) | `package.json` |
| C5 | Jalankan index unique **setelah** backfill bersih | MongoDB |

**Runbook duplikat nama (existing data):**

1. Jalankan audit → export CSV konflik.
2. Koordinasi redaksi: ubah nama tampilan (mis. tambah inisial tim) hingga unik.
3. Re-run backfill dry-run sampai 0 konflik.
4. Execute backfill + create index.

**Exit criteria Fase C:** Semua user aktif punya `slug` unik; audit 0 duplikat; index terpasang.

---

### Fase D — Routing halaman publik

**Tujuan:** URL `/author/{slug}` hidup.

| # | Task | File utama |
|---|------|------------|
| D1 | Pindah/rename `author/[id]/` → `author/[slug]/` | `src/app/(public)/author/` |
| D2 | `page.tsx`: param `slug`, lookup `getUserBySlug` (+ fallback ObjectId opsional R3.6) | `page.tsx` |
| D3 | `AuthorClient`: terima `authorId` (internal) + `authorSlug` (display/cache key); query search tetap `authorId` | `AuthorClient.tsx` |
| D4 | `generateMetadata` pakai slug lookup | `page.tsx` |

**Catatan:** Search API **tidak wajib** tambah `authorSlug` di fase ini — server sudah resolve slug → `_id`.

**Exit criteria Fase D:** `/author/{slug}` menampilkan profil & artikel; `/author/{invalid}` → 404.

---

### Fase E — Update consumer & denormalisasi

**Tujuan:** Semua link publik dan data artikel konsisten.

| # | Task | File utama |
|---|------|------------|
| E1 | `USER_POPULATE_PROJECTION` + map author tambah `slug` | `searchService.ts` |
| E2 | `mongoUserToProfile` tambah `slug` | `coreWriteArticleService.ts` |
| E3 | `getArticleService` map `author.slug` | `getArticleService.ts` |
| E4 | `editUser`: setelah slug berubah → `updateMany` artikel (`author.slug`, `author.name`) | `userService.ts` atau service terpisah |
| E5 | Perluas endpoint denormalization sync `author.slug` | `api/refactoring-articles/denormalization/route.ts` |
| E6 | Ganti semua `href` `/author/${_id}` → `buildAuthorPublicPath(slug)` | 5 file di audit |
| E7 | `MobileMenu`: pakai `userAuthed.slug` (wajib ada setelah backfill) | `MobileMenu.tsx` |
| E8 | `getAllAuthors` projection sertakan `slug` | `userService.ts` |

**Exit criteria Fase E:** Klik nama penulis di artikel/menu menuju `/author/{slug}`; artikel terdenormalisasi benar.

---

### Fase F — UX CMS

**Tujuan:** Admin/penulis mendapat feedback saat nama bentrok.

| # | Task | File utama |
|---|------|------------|
| F1 | `CreateUserDialog` / `EditUserDialog`: tangkap error 409, toast pesan Indonesia | dialog user |
| F2 | *(Opsional)* Preview slug read-only saat mengetik nama | `FormUserDialogUi.tsx` |
| F3 | `map-user-write-error.ts` (mirip artikel) untuk kode error konsisten | baru / `lib/api-error.ts` |
| F4 | Validasi client-side debounce cek nama (GET search users) — nice-to-have | opsional |

**Exit criteria Fase F:** Duplikat nama ditolak di UI dengan pesan jelas.

---

### Fase G — QA, deploy & monitoring

| # | Task |
|---|------|
| G1 | Matriks QA URL (lihat bawah) |
| G2 | Deploy **setelah** backfill DB di staging/prod |
| G3 | Spot-check artikel populer: link penulis benar |
| G4 | Monitor 404 pada `/author/*` pasca deploy |

**Matriks QA**

| # | Skenario | Ekspektasi |
|---|----------|------------|
| Q1 | Buka `/author/{slug-valid}` | Halaman penulis + daftar artikel |
| Q2 | Buka `/author/{slug-tidak-ada}` | 404 |
| Q3 | Buka `/author/{objectId-lama}` | 404 *(atau tampil jika R3.6 diaktifkan)* |
| Q4 | Klik "By {nama}" di NewsCard | Navigasi ke slug |
| Q5 | Menu mobile user login | Link profil pakai slug |
| Q6 | Create user nama duplikat | 409 + pesan error |
| Q7 | Edit user rename ke nama existing | 409 |
| Q8 | Edit user rename valid | Slug berubah, artikel ter-update, URL lama 404 |
| Q9 | User soft-deleted | `/author/{slug}` → 404 |
| Q10 | Penulis tanpa artikel | Halaman tampil, empty state |

---

## Urutan Deploy (Disarankan)

```
Fase A + B  →  merge code (belum wajib ganti route)
Fase C      →  audit + backfill + index di staging
Fase D + E  →  deploy bersamaan (route + link + data slug harus ada)
Fase F      →  bisa ikut batch yang sama
Fase G      →  QA sign-off
```

**Jangan** deploy Fase D/E ke production sebelum backfill Fase C selesai — link akan 404.

---

## Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|--------|--------|----------|
| Nama duplikat di DB lama | Index unique gagal | Audit + resolve manual sebelum index |
| Slug bentrok dari nama berbeda (`A.B` vs `A-B`) | 409 saat create | Suffix numerik pada slug; nama tetap unik |
| Bookmark `/author/{objectId}` | 404 | Fallback lookup ObjectId sementara (R3.6) atau terima 404 |
| Rename penulis | URL lama mati | Komunikasi ke redaksi; konsisten dengan kebijakan artikel |
| `author.slug` stale di artikel | Link salah | `editUser` batch update + script denormalization |

---

## Checklist File (Ringkas)

### Baru

- `src/lib/user-validation.ts`
- `src/lib/author-public-path.ts`
- `scripts/audit-user-names-slugs.ts`
- `scripts/backfill-user-slugs.ts`

### Ubah

- `src/types/user.ts`
- `src/services/userService.ts`
- `src/app/(public)/author/[slug]/page.tsx` *(rename dari `[id]`)*
- `src/app/(public)/author/[slug]/AuthorClient.tsx`
- `src/app/api/users/route.ts`
- `src/app/api/users/[idOrSlug]/route.ts`
- `src/services/searchService.ts`
- `src/services/article/coreWriteArticleService.ts`
- `src/services/article/getArticleService.ts`
- `src/components/news/NewsCard.tsx`
- `src/components/news/SecondaryNewsCard.tsx`
- `src/components/news/ArticleUi.tsx`
- `src/components/navigation/MobileMenu.tsx`
- `src/app/admin-xyz/analytics/editor-activity/page.tsx`
- `src/components/users/CreateUserDialog.tsx`
- `src/components/users/EditUserDialog.tsx`
- `package.json`

### Tidak diubah (internal tetap `_id`)

- Filter CMS `authorId`, analytics, scheduled publish, `articles.authorId`

---

## Status Fase

| Fase | Deskripsi | Status |
|------|-----------|--------|
| A | Schema & validasi | ✅ |
| B | Service & API | ✅ |
| C | Migrasi DB | 🟡 (script siap; lokal 12 user OK; prod belum) |
| D | Routing publik | ✅ |
| E | Consumer & denormalisasi | ✅ |
| F | UX CMS | ✅ |
| G | QA & deploy | ❌ |

---

## Keputusan Terbuka (Perlu Konfirmasi Produk)

1. **Fallback ObjectId di URL** — **Diputuskan: strict slug-only 404** (tanpa fallback R3.6).
2. **Scope unik nama** — Semua role user atau hanya role penulis (writer/reporter/contributor/editor)?
3. **Karakter nama** — Apakah `"Andi Pratama"` dan `"andi pratama"` dianggap duplikat? *(Rekomendasi: ya, via `nameNormalized`)*
4. **Slug preview di CMS** — **Ya** — preview read-only di `FormUserDialogUi` saat ketik nama.
