# Audit: Log Data Artikel Mentah di Console Server

**Tanggal:** 2026-06-24  
**Konteks:** Console dev server (`next dev`) dipenuhi objek artikel lengkap (`_id`, `title`, `slug`, `category`, `author`, `featuredImage`, `tags`, dll.).

---

## Kesimpulan utama

| Hipotesis | Hasil |
|-----------|-------|
| `logger.info` di server mencetak artikel mentah | **Tidak terbukti** — semua `logger.info` terkait artikel hanya log metadata (`count`, `articleId`, `title` singkat). |
| `console.log` di komponen React | **Penyebab utama** — terutama di dalam `.map()` atau body render komponen client. Di Next.js, client component tetap di-SSR; `console.log` muncul di terminal server dev. |

**Root cause paling mungkin untuk spam di halaman publik:** `src/components/news/ArticleUi.tsx` baris 521 — `console.log(article)` untuk setiap artikel terkait.

**Root cause untuk spam di CMS admin:** beberapa halaman `admin-xyz/articles/*` yang log array artikel penuh, termasuk log di body render (setiap re-render).

---

## Mengapa bukan `logger.info`?

Logger memakai Pino (`src/lib/logger.ts`) dengan pola aman:

```ts
logger.info({ count: popularArticles.length }, "Popular articles fetched successfully");
```

Audit `src/services/` dan `src/app/api/` tidak menemukan:

- `logger.info(article)`
- `logger.info(articles)`
- `logger.info({ article: fullObject })`
- `console.log` di layer service

Contoh aman di service:

| File | Pola log |
|------|----------|
| `sectionArticleService.ts` | `{ type, count }` |
| `categoryService.ts` | `{ count: result.length }` |
| `coreWriteArticleService.ts` | `{ articleId }`, `{ titlePreview: slice(0,120) }` |
| `relatedArticlesService.ts` | `{ articleId, userId, count }` |
| `writeArticleService.ts` | string jumlah artikel terjadwal saja |

API routes (`popular`, `headline`, `editor-choice`, `grid-section`, `carousel-section`) mengikuti pola `{ count }` yang sama.

---

## Temuan kritis — `console.log` data artikel penuh

### 1. Halaman publik (prioritas tertinggi)

#### `src/components/news/ArticleUi.tsx` — baris 521

```tsx
{related?.map((article) => {
  console.log(article);
  return (
    <SecondaryNewsCard key={article._id} article={article} />
  );
})}
```

| Aspek | Detail |
|-------|--------|
| **Trigger** | Setiap render halaman detail artikel (`NewsDetailClient` → `ArticleUi`) |
| **Frekuensi** | 1 log per artikel terkait × setiap SSR + re-render |
| **Bentuk output** | Objek `ArticleListResponse` — cocok dengan sample log user (`publicPath`, `urlFormat`, `excerpt`, `category`, `author`, `editor`, `featuredImage`, `tags`, `viewCount`, `publishedAt`) |
| **Severity** | **Kritis** pada traffic publik |

**Perbaikan:** Hapus baris 521. Tidak ada nilai debug yang sah di production maupun dev.

---

### 2. CMS admin — artikel section

#### `src/app/admin-xyz/articles/editor-choice/page.tsx`

| Baris | Kode | Trigger | Severity |
|-------|------|---------|----------|
| 40 | `console.log("Fetched editor choices:", data)` | Mount / fetch | Tinggi |
| 228 | `console.log("Editor choices saved:", response.data.data)` | Setelah save | Tinggi |
| 235 | `console.log("Render EditorChoicePage with editorChoices:", editorChoices)` | **Setiap render** | **Kritis** |

#### `src/app/admin-xyz/articles/featured/page.tsx`

| Baris | Kode | Trigger | Severity |
|-------|------|---------|----------|
| 40 | `console.log("Fetched grid section:", data)` | Mount / fetch | Tinggi |
| 228 | `console.log("Grid section saved:", response.data.data)` | Setelah save | Tinggi |
| 235 | `console.log("Render GridSectionPage with gridSection:", gridSection)` | **Setiap render** | **Kritis** |

Data = `SectionArticleItem[]` dengan nested `article` penuh.

#### `src/app/admin-xyz/articles/popular/page.tsx` — baris 83

```ts
console.log(filteredArticles);
```

Log `ArticleListResponse[]` pada setiap pencarian/pagination.

#### `src/components/admin/articles/SortableArticleCard.tsx` — baris 25–28

```ts
console.log(
  "Rendering SortableArticleCard for article:",
  editorChoice.article,
);
```

Log artikel penuh **per kartu** × setiap render drag-and-drop.

#### `src/app/admin-xyz/articles/carousel-section/page-notused.tsx`

Pola sama (baris 42, 230, 237) — file tidak aktif (`page-notused.tsx`) tapi masih ada di repo.

---

### 3. CMS admin — severity menengah/rendah

| File | Baris | Kode | Catatan |
|------|-------|------|---------|
| `articles/preview/page.tsx` | 474 | `console.log("Previewing article:", pagedArticle?.author)` | Author saja, tapi setiap render |
| `articles/[idOrSlug]/approval/page.tsx` | 141 | `console.log("published", article.publishedAt)` | Satu field |
| `articles/[idOrSlug]/page.tsx` | 17 | `console.log("EditArticlePage")` | String saja |
| `components/admin/articles/VideoSocmedForm.tsx` | 129 | `console.log("Loaded items with thumbnails:", ...)` | Bukan artikel berita |

---

## Temuan rendah / out of scope

| File | Catatan |
|------|---------|
| `src/components/news/NewsDetailClient.tsx:52` | Log error view tracking — bukan dump artikel |
| `src/lib/db/seed.ts` | Script seed — tidak jalan di runtime web |
| `src/app/api/articles/[idOrSlug]/route.ts:143–148` | `console.log` dikomentari — hapus agar tidak ter-uncomment |

---

## Mekanisme: kenapa muncul di terminal server?

1. Next.js App Router me-render client component di server (SSR) untuk HTML awal.
2. `console.log` di body function component atau di `.map()` dieksekusi saat SSR.
3. Output dialihkan ke stdout proses `next dev` — terlihat seperti log server.
4. User mengira ini `logger.info` karena format objek mirip output Pino-pretty di dev, padahal sumbernya `console.log` React.

Log di body render (bukan di `useEffect`) memicu spam ekstra karena setiap state update = render ulang = log ulang.

---

## Urutan remediasi

1. **Segera** — hapus `console.log(article)` di `ArticleUi.tsx:521` (dampak publik terbesar).
2. **Segera** — hapus log di body render: `editor-choice/page.tsx:235`, `featured/page.tsx:235`.
3. **Tinggi** — hapus fetch/save log di editor-choice, featured, popular.
4. **Tinggi** — hapus log di `SortableArticleCard.tsx`.
5. **Bersih-bersih** — hapus atau delete `page-notused.tsx`; hapus debug preview/approval.
6. **Pencegahan** — tambah ESLint rule `no-console` (allow `warn`/`error` saja) atau `eslint-plugin-no-console` di `src/`.

---

## Pola log yang benar (referensi)

```ts
// Server (Pino) — metadata saja
logger.info({ count: articles.length, articleIds: articles.map(a => a._id) }, "Articles fetched");

// Client debug (jika benar-benar perlu, dev only)
if (process.env.NODE_ENV === "development") {
  console.debug("[EditorChoice] loaded", { count: data.length });
}
```

Jangan pernah:

```ts
console.log(articles);
console.log(article);
logger.info(article); // anti-pattern
```

---

## Layer `src/services/` — temuan tambahan

[Audit services](22f80c09-752d-4a4d-bd94-bf05d8b30af4) mengonfirmasi: **tidak ada `console.log`** dan **tidak ada `logger.info` yang dump artikel penuh** di success path. Hasil mapping/denorm (`mapToArticleListResponse`, search, indeks, kategori) dikembalikan ke caller tanpa di-log.

**Risiko residual (bukan penyebab spam console saat ini):**

| File | Baris | Masalah |
|------|-------|---------|
| `relatedArticlesService.ts` | 325–335 | `logger.error` mencatat `payload` utuh; client bisa mengirim nested `article` di `SectionArticleItem` |
| `kpiUserService.ts` | 76–78 | `logger.info({ userCount: users })` — field bernama `userCount` tapi isinya array user (PII), bukan artikel |

Perbaikan disarankan: sanitasi payload error (`relatedCount`, `articleIds` saja) dan ganti ke `{ userCount: users.length }`.

---

## Sumber audit

| Area | Agent | Hasil |
|------|-------|-------|
| `src/app/` | [Audit app routes](8e15afd8-b590-4801-b301-0408b9ae66fc) | API `logger.info` aman; spam dari `console.log` admin |
| `src/services/` | [Audit services](22f80c09-752d-4a4d-bd94-bf05d8b30af4) | Success path bersih; risiko di error-path `relatedArticlesService` |
| `src/lib/`, `src/hooks/`, `src/components/` | [Audit lib/hooks](a73d7dcc-a389-4b9e-8bf5-59404c2666c6) | Temuan utama: `ArticleUi.tsx`, `SortableArticleCard.tsx` |
