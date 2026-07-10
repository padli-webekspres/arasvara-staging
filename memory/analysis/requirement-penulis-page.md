# Requirement: Migrasi Halaman Profil `/author` → `/penulis`

> **Dibuat:** 2026-06-30  
> **Status:** Draft requirement — belum diimplementasi  
> **Permintaan produk:** Ganti route publik profil penulis/editor dari `/author/[slug]` ke `/penulis/[slug]`; perluas daftar artikel ke `authorId` **atau** `editorId`; batasi profil publik ke role `writer` dan `editor`; `/author/*` menjadi **404 penuh** (tanpa redirect).

---

## Ringkasan Keputusan Produk

| #   | Keputusan                       | Detail                                                                                                                                |
| --- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Struktur URL: Opsi A**        | Hanya `/penulis/[slug]` — **tidak** ada halaman index `/penulis`                                                                      |
| 2   | **Daftar artikel profil**       | Tampilkan artikel where `authorId = user._id` **OR** `editorId = user._id` (gabung satu feed, tanpa tab)                              |
| 3   | **Role eligible profil publik** | Hanya `writer` dan `editor`                                                                                                           |
| 4   | **Internal linking**            | Semua link profil publik (byline penulis, blok editor, kartu artikel, menu mobile, admin preview link, dll.) menuju `/penulis/{slug}` |
| 5   | **Legacy `/author`**            | Route `/author/*` **404 sepenuhnya** — tidak ada 301/302 redirect ke `/penulis`                                                       |

---

## Konteks & Masalah Saat Ini

### Route & path helper

| Aspek                  | Saat ini                                                                          |
| ---------------------- | --------------------------------------------------------------------------------- |
| Route folder           | `src/app/(public)/author/[slug]/`                                                 |
| URL publik             | `/author/{slug}`                                                                  |
| Path helper            | `src/lib/author-public-path.ts` — prefix `/author`                                |
| Lookup profil          | `getPublicAuthorBySlug()` — **tanpa filter role**                                 |
| Filter artikel profil  | Hanya `authorId` via `fetchAuthorArticlesPage()` → `searchArticles({ authorId })` |
| Link editor di artikel | Nama editor **tidak** clickable (hanya penulis yang link ke profil)               |
| Sitemap                | URL `/author/{slug}`; lookup artikel sitemap hanya `authorId`                     |

### Dampak untuk editor

Editor dengan slug valid bisa punya halaman `/author/{slug}`, tetapi daftar artikel sering **kosong** karena artikel mereka tercatat di `editorId`, bukan `authorId`. Requirement ini menyelesaikan gap tersebut.

---

## Requirement Fungsional

### R1 — Routing publik

| ID   | Requirement                                                                                                                      |
| ---- | -------------------------------------------------------------------------------------------------------------------------------- |
| R1.1 | Route publik profil: **`/penulis/{slug}`**                                                                                       |
| R1.2 | Folder App Router: `src/app/(public)/penulis/[slug]/`                                                                            |
| R1.3 | Param `slug`: decode URI, trim, lowercase (selaras implementasi saat ini)                                                        |
| R1.4 | Slug tidak ditemukan → **404** (`notFound()`)                                                                                    |
| R1.5 | User soft-deleted / `isActive: false` → **404**                                                                                  |
| R1.6 | User role **bukan** `writer` atau `editor` → **404**                                                                             |
| R1.7 | User tanpa `slug` valid → **404**                                                                                                |
| R1.8 | **Tidak** dibuat halaman `/penulis` (index/direktori)                                                                            |
| R1.9 | Folder/route lama `src/app/(public)/author/` **dihapus** atau tidak lagi melayani request — semua path `/author/*` harus **404** |

### R2 — Eligibility profil publik (role)

| ID   | Requirement                                                                                                                |
| ---- | -------------------------------------------------------------------------------------------------------------------------- |
| R2.1 | Hanya user dengan `role === "writer"` atau `role === "editor"` yang boleh diakses publik                                   |
| R2.2 | Role lain (`admin`, `editor-in-chief`, `reporter`, `contributor`, `account-executive`, dll.) → **404** meskipun punya slug |
| R2.3 | Filter role diterapkan di **server-side lookup** profil (bukan hanya di UI)                                                |
| R2.4 | Sitemap profil hanya memuat user `writer` + `editor` yang aktif dan punya slug                                             |

**Catatan:** Endpoint admin internal `/api/users/author` **tidak** diubah URL-nya (tetap API CMS). Hanya path **publik** yang migrasi ke `/penulis`.

### R3 — Daftar artikel di halaman profil

| ID   | Requirement                                                                                                 |
| ---- | ----------------------------------------------------------------------------------------------------------- |
| R3.1 | Satu feed artikel per profil — **tanpa tab** "Ditulis" / "Diedit"                                           |
| R3.2 | Query: artikel `status: published` where **`authorId = userId` OR `editorId = userId`**                     |
| R3.3 | Sort default: `publishedAt` descending (selaras halaman author saat ini)                                    |
| R3.4 | Paginasi infinite scroll / "lihat berita lainnya" tetap berfungsi                                           |
| R3.5 | Artikel yang diedit editor **tetap ditampilkan** meskipun `authorId`-nya orang lain — **accepted behavior** |
| R3.6 | Total count di metadata SEO (`meta.total`) harus reflect jumlah gabungan (author + editor)                  |
| R3.7 | Dedupe: jika satu artikel somehow match keduanya (edge case), **hanya muncul sekali**                       |

### R4 — Path helper & internal linking

| ID   | Requirement                                                                                                     |
| ---- | --------------------------------------------------------------------------------------------------------------- |
| R4.1 | Prefix publik: **`/penulis`** (ganti `/author`)                                                                 |
| R4.2 | Helper path (`buildPenulisPublicPath`, `resolvePenulisPublicHref`, dll.) menjadi single source of truth         |
| R4.3 | Semua link profil publik di frontend memakai helper — **tidak** hardcode `/author/`                             |
| R4.4 | Link **penulis** (byline, NewsCard, ArticleUi, NewsDetailClient, SecondaryNewsCard) → `/penulis/{slug}`         |
| R4.5 | Link **editor** (blok editor di `ArticleUi`, `AttributionPersonRow`) → `/penulis/{slug}` jika editor punya slug |
| R4.6 | Mobile menu profil user login → `/penulis/{slug}`                                                               |
| R4.7 | Admin analytics editor-activity (link ke profil publik) → `/penulis/{slug}`                                     |
| R4.8 | Form CMS user (`FormUserDialogUi`) — teks preview URL: **`/penulis/{slug}`**                                    |

### R5 — Legacy `/author` → 404

| ID   | Requirement                                                                                                         |
| ---- | ------------------------------------------------------------------------------------------------------------------- |
| R5.1 | **Tidak ada redirect** (301/302) dari `/author/*` ke `/penulis/*`                                                   |
| R5.2 | Semua request `/author` dan `/author/{slug}` mengembalikan **404**                                                  |
| R5.3 | Canonical URL, Open Graph, JSON-LD, sitemap — **hanya** `/penulis/{slug}`                                           |
| R5.4 | Bookmark / backlink lama ke `/author/*` akan 404 — **accepted** (selaras kebijakan refactor URL artikel sebelumnya) |

### R6 — SEO & metadata

| ID   | Requirement                                                                                    |
| ---- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| R6.1 | Title tag: tetap format \*\*`Arasvara                                                          | Profil penulis {nama}`** (atau disesuaikan jika nanti ingin label dinamis editor — **out of scope v1\*\*) |
| R6.2 | Meta description: bio user jika ada; fallback generik portal                                   |
| R6.3 | `robots`: `index: true`, `follow: true` (selaras implementasi author page saat ini)            |
| R6.4 | Canonical: `https://arasvara.id/penulis/{slug}`                                                |
| R6.5 | JSON-LD `ProfilePage` / `Person` — URL profil ke `/penulis/{slug}`                             |
| R6.6 | Sitemap XML: ganti entri `/author/` → `/penulis/`; filter role writer/editor                   |
| R6.7 | `lastmod` sitemap: pertimbangkan `latestArticleAt` dari artikel sebagai author **atau** editor |

### R7 — Analytics (GA4)

| ID   | Requirement                                                                                                                 |
| ---- | --------------------------------------------------------------------------------------------------------------------------- |
| R7.1 | Event `author_profile_view` tetap fire on mount halaman profil (nama event boleh dipertahankan untuk kontinuitas dashboard) |
| R7.2 | Parameter event: `author_id`, `author_slug`, `author_name` — isi tetap valid untuk editor                                   |
| R7.3 | _(Opsional v2)_ Rename event ke `penulis_profile_view` — **bukan scope v1** kecuali diminta terpisah                        |

---

## Requirement Teknis (Backend & API)

### R8 — Search service

| ID   | Requirement                                                                                                      |
| ---- | ---------------------------------------------------------------------------------------------------------------- |
| R8.1 | Tambah parameter query profil, mis. `profileUserId` atau kombinasi `authorId` + `editorId` dengan mode OR        |
| R8.2 | Implementasi di `searchArticles()` — MongoDB `$or` pada `authorId` dan `editorId`                                |
| R8.3 | Extend `ArticleSearchParams` di `src/types/search.ts`                                                            |
| R8.4 | Extend `GET /api/search` — dokumentasi query param baru                                                          |
| R8.5 | Filter `authorId` existing untuk CMS **tetap** berfungsi (backward compat) — jangan break admin/writer dashboard |
| R8.6 | Count total (`meta.total`) akurat untuk query OR                                                                 |

**Contoh query MongoDB (referensi implementasi):**

```js
{
  status: "PUBLISHED",
  $or: [
    { authorId: ObjectId(userId) },
    { editorId: ObjectId(userId) },
  ],
  // + soft-delete filter artikel
}
```

### R9 — User service

| ID   | Requirement                                                                                         |
| ---- | --------------------------------------------------------------------------------------------------- |
| R9.1 | `getPublicAuthorBySlug()` → rename/refactor ke fungsi profil publik (mis. `getPublicPenulisBySlug`) |
| R9.2 | Tambah validasi role `writer` \| `editor` sebelum return user                                       |
| R9.3 | Return `null` → page `notFound()`                                                                   |

### R10 — Sitemap service

| ID    | Requirement                                                                   |
| ----- | ----------------------------------------------------------------------------- |
| R10.1 | `getSitemapAuthors()` → filter `$match.role: { $in: ["writer", "editor"] }`   |
| R10.2 | `$lookup` artikel: match `authorId` **OR** `editorId` untuk `latestArticleAt` |
| R10.3 | Output URL: `/penulis/{slug}` via path helper                                 |

---

## Audit File — Perlu Diubah

### Routing & server logic

| File                                              | Perubahan                                                                                  |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `src/app/(public)/author/[slug]/page.tsx`         | **Pindah** → `src/app/(public)/penulis/[slug]/page.tsx`                                    |
| `src/app/(public)/author/[slug]/AuthorClient.tsx` | **Pindah/rename** → `PenulisClient.tsx` (opsional rename)                                  |
| `src/lib/author-public-path.ts`                   | Ganti prefix `/author` → `/penulis`; rename file (disarankan `penulis-public-path.ts`)     |
| `src/lib/server/author-page.ts`                   | Update canonical path; query artikel OR author/editor; rename (opsional `penulis-page.ts`) |
| `src/lib/server/author-page.test.ts`              | Update test path & query                                                                   |
| `src/lib/user-validation.ts`                      | Update komentar + helper visibility jika perlu                                             |
| `src/lib/user-validation.test.ts`                 | Expect path `/penulis/...`                                                                 |
| `src/services/userService.ts`                     | Role filter di lookup publik                                                               |
| `src/services/searchService.ts`                   | Filter OR `authorId` / `editorId`                                                          |
| `src/services/sitemapService.ts`                  | Role filter + lookup editor + URL `/penulis`                                               |
| `src/lib/sitemap-xml.ts`                          | URL template `/penulis/`                                                                   |
| `src/lib/sitemap-xml.test.ts`                     | Expect `/penulis/`                                                                         |

### Komponen UI & linking

| File                                                   | Perubahan                                           |
| ------------------------------------------------------ | --------------------------------------------------- |
| `src/components/news/NewsCard.tsx`                     | Import path helper `/penulis`                       |
| `src/components/news/SecondaryNewsCard.tsx`            | sama                                                |
| `src/components/news/ArticleUi.tsx`                    | Penulis + **editor** clickable ke `/penulis/{slug}` |
| `src/components/news/NewsDetailClient.tsx`             | Path helper                                         |
| `src/components/navigation/MobileMenu.tsx`             | `/penulis/{slug}`                                   |
| `src/components/users/FormUserDialogUi.tsx`            | Teks "URL penulis: /penulis/"                       |
| `src/app/admin-xyz/analytics/editor-activity/page.tsx` | Link profil publik                                  |

### Types & API docs

| File                          | Perubahan                             |
| ----------------------------- | ------------------------------------- |
| `src/types/search.ts`         | Param query profil (OR author/editor) |
| `src/app/api/search/route.ts` | Parse param baru + JSDoc              |

### **Tidak diubah** (internal/admin — bukan URL publik)

| File                                              | Alasan                                                |
| ------------------------------------------------- | ----------------------------------------------------- |
| `src/app/api/users/author/route.ts`               | API CMS list penulis — path API, bukan halaman publik |
| `src/hooks/useAuthor.ts`                          | Konsumsi API admin                                    |
| `src/app/api/analytics/author/**`                 | Analytics admin dashboard                             |
| `src/services/analytics/authorAnalyticService.ts` | Analytics internal                                    |

---

## Requirement Non-Fungsional

| ID  | Requirement                                                                                         |
| --- | --------------------------------------------------------------------------------------------------- |
| NF1 | **ISR/revalidate** halaman profil: pertahankan `revalidate = 300` (5 menit) kecuali ada alasan ubah |
| NF2 | **Zero TypeScript errors** setelah migrasi (`npx tsc --noEmit`)                                     |
| NF3 | Unit test path helper & author/penulis page server logic di-update                                  |
| NF4 | Tidak expose profil user non-editorial meskipun slug-nya diketahui                                  |
| NF5 | Perubahan minimal — reuse komponen `NewsCard`, `LoadMoreButton`, dll.                               |

---

## Rencana Implementasi (Fase)

### Fase A — Path & routing

1. Buat/update path helper dengan prefix `/penulis`
2. Buat `src/app/(public)/penulis/[slug]/` (pindah dari `author/`)
3. Hapus `src/app/(public)/author/` — verifikasi `/author/*` → 404

### Fase B — Backend query & eligibility

1. Role filter di lookup profil publik
2. Extend `searchArticles` + `/api/search` untuk OR author/editor
3. Update `fetchAuthorArticlesPage` (atau successor) memakai query baru
4. Update `AuthorClient` / `PenulisClient` URL fetch ke param baru

### Fase C — Internal linking & CMS copy

1. Ganti semua import path helper di komponen news/navigation/admin
2. Tambah link editor di `ArticleUi` / `AttributionPersonRow`
3. Update teks CMS FormUserDialogUi

### Fase D — SEO & sitemap

1. Canonical, JSON-LD, OG URL ke `/penulis`
2. Sitemap role filter + editor lookup + URL baru
3. Update test sitemap

### Fase E — QA

Jalankan checklist QA di bawah.

---

## Checklist QA

| #   | Skenario                                 | Expected                                                    |
| --- | ---------------------------------------- | ----------------------------------------------------------- |
| Q1  | Buka `/penulis/{slug-writer-valid}`      | Profil + artikel sebagai author **dan** editor (jika ada)   |
| Q2  | Buka `/penulis/{slug-editor-valid}`      | Profil + artikel diedit (meski author orang lain)           |
| Q3  | Buka `/penulis/{slug-admin}`             | **404**                                                     |
| Q4  | Buka `/penulis/{slug-reporter}`          | **404**                                                     |
| Q5  | Buka `/penulis/{slug-tidak-ada}`         | **404**                                                     |
| Q6  | Buka `/author/{slug-valid}`              | **404** (bukan redirect)                                    |
| Q7  | Buka `/author`                           | **404**                                                     |
| Q8  | Klik nama penulis di artikel             | Navigasi ke `/penulis/{slug}`                               |
| Q9  | Klik nama editor di artikel (punya slug) | Navigasi ke `/penulis/{slug}`                               |
| Q10 | Editor tanpa slug                        | Nama editor plain text (no link)                            |
| Q11 | Load more artikel di profil              | Paginasi benar, tidak duplikat                              |
| Q12 | Sitemap                                  | Hanya `/penulis/` untuk writer/editor; tidak ada `/author/` |
| Q13 | View page source — canonical             | `https://arasvara.id/penulis/{slug}`                        |
| Q14 | GA debug — page load profil              | Event `author_profile_view` ter-fire                        |
| Q15 | CMS create user — preview URL            | Menampilkan `/penulis/`                                     |
| Q16 | `/api/search?authorId=...` (CMS)         | Tetap filter author saja — tidak regress                    |

---

## Out of Scope (v1)

| Item                                                               | Catatan                         |
| ------------------------------------------------------------------ | ------------------------------- |
| Halaman index `/penulis` (direktori tim editorial)                 | Ditolak — Opsi A                |
| Tab "Ditulis" / "Diedit"                                           | Ditolak — satu feed gabungan    |
| 301 redirect `/author` → `/penulis`                                | Ditolak — 404 penuh             |
| Role `reporter`, `contributor`, `editor-in-chief` di profil publik | Ditolak — hanya writer & editor |
| Rename event GA `author_profile_view`                              | Opsional v2                     |
| Label dinamis "Profil editor" vs "Profil penulis" di title/H1      | Opsional v2                     |
| Badge role di UI profil                                            | Opsional v2                     |
| Breadcrumb schema                                                  | Belum diminta                   |

---

## Risiko & Mitigasi

| Risiko                                                  | Mitigasi                                                                    |
| ------------------------------------------------------- | --------------------------------------------------------------------------- |
| Backlink Google ke `/author/*` hilang ranking sementara | Monitor GSC 404; accepted per keputusan produk (no redirect)                |
| Editor profile menampilkan artikel "bukan karyanya"     | Accepted — transparansi editorial; copy UI tidak perlu bedakan v1           |
| Query OR author/editor lebih berat                      | Index MongoDB pada `authorId` + `editorId` (verifikasi index existing)      |
| Regresi CMS filter `authorId` saja                      | Pisahkan param: CMS tetap `authorId`; profil pakai param OR dedicated       |
| User role `reporter` punya slug & sudah terindex        | Setelah deploy, profil mereka 404 — pastikan sitemap tidak lagi list mereka |

---

## Referensi Codebase (kondisi saat requirement ditulis)

```
src/app/(public)/author/[slug]/page.tsx     → lookup + fetchAuthorArticlesPage(authorId only)
src/lib/author-public-path.ts               → AUTHOR_PREFIX = "/author"
src/lib/server/author-page.ts               → fetchAuthorArticlesPage → searchArticles({ authorId })
src/services/searchService.ts               → filter authorId only (no editorId)
src/components/news/ArticleUi.tsx           → author linked; editor plain text
src/services/sitemapService.ts              → all active users with slug; lookup authorId only
src/services/userService.ts                 → getPublicAuthorBySlug — no role filter
```

---

## Changelog Dokumen

| Tanggal    | Perubahan                                                                                                                         |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 2026-06-30 | Draft awal — keputusan produk dari diskusi: Opsi A, OR author/editor, role writer+editor, 404 `/author`, semua link ke `/penulis` |
