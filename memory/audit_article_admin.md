# Audit Report: Article Admin Flow
**Date:** 2026-08-18  
**Scope:** `/admin-xyz/articles`, `/admin-xyz/articles/new`, `/admin-xyz/articles/new/gallery`, dan API terkait

---

## Executive Summary

Ditemukan **11 bug/kejanggalan critical-to-medium** pada flow artikel admin:

- **3 Critical:** validasi hilang, race condition data integrity, inkonsistensi format-specific logic
- **5 High:** error handling lemah, missing user feedback, approval flow bypass
- **3 Medium:** UX inconsistency, misleading validation

---

## Critical Issues

### C1. **Gallery Article Validation Hilang di Client-Side**
**Location:** `src/components/admin/articles/ArticleEditorForm.tsx:1686-1708`

**Problem:**
Form hanya validasi `hasRequiredFeaturedImage()` sebelum submit. Tidak ada validasi untuk gallery articles bahwa `galleryItems.length > 0`.

```typescript
// Line 1686-1688: Hanya validasi featured image
if (!hasRequiredFeaturedImage()) {
  toast.error("Featured image wajib ditambahkan sebelum menyimpan.");
  return;
}
```

**Impact:**
- User bisa submit gallery article kosong (tanpa gallery items sama sekali)
- Validasi baru muncul di server (`route.ts:207` dan `coreWriteArticleService.ts:626,654`)
- Error server tidak user-friendly: "Invalid galleryItems: must be a non-empty array"
- Wasted API call + user harus scroll back ke form

**Expected:**
Client-side validation sebelum API call:
```typescript
if (format === "GALLERY" && galleryItems.length === 0) {
  toast.error("Gallery article memerlukan minimal 1 gambar.");
  return;
}
```

**Severity:** CRITICAL — data integrity & poor UX

---

### C2. **Race Condition: Format Immutable tapi Payload Tidak Difilter**
**Location:** `src/services/article/coreWriteArticleService.ts:1205-1215`

**Problem:**
`updateArticle` menolak perubahan format dengan throw error, tapi payload dari client **tetap mengirim `format`** setiap kali edit.

```typescript
// Line 1207-1214: Format immutable validation
const existingFormat = existing.format || "STANDARD";
if (payload.format && payload.format !== existingFormat) {
  throw Object.assign(
    new Error(`Article format cannot be changed. Current format: ${existingFormat}`),
    { status: 400 }
  );
}
```

Client (`ArticleEditorForm.tsx:1315`):
```typescript
const payload: Record<string, unknown> = {
  // ... fields
  format,  // ← SELALU dikirim, bahkan saat edit
```

**Impact:**
- Setiap edit article mengirim `format` yang tidak pernah dipakai (immutable field)
- Jika ada bug di client yang mengirim format berbeda → API reject dengan error 400
- Payload bloat (minor tapi tidak perlu)

**Expected:**
- Client: **jangan kirim `format` saat `isEditing === true`**
- Atau server: strip `format` dari payload update (defensive)

**Severity:** CRITICAL (potential data rejection) + MEDIUM (payload bloat)

---

### C3. **Inkonsistensi Validasi Gallery Items antara Create dan Update**
**Location:**
- Create: `src/app/api/articles/route.ts:206-214`
- Update: `src/services/article/coreWriteArticleService.ts:1266-1271`

**Problem Create:**
```typescript
// route.ts:206-214 — WAJIB non-empty array
if (format === "GALLERY") {
  if (!Array.isArray(body.galleryItems) || body.galleryItems.length === 0) {
    throw Object.assign(
      new Error(`Invalid galleryItems: must be a non-empty array`),
      { status: 400 }
    );
  }
  galleryItems = body.galleryItems;
}
```

**Problem Update:**
```typescript
// coreWriteArticleService.ts:1266-1271 — TIDAK validasi empty
let resolvedGalleryItems: GalleryItemStored[] | undefined = undefined;
if (payload.galleryItems !== undefined && existingFormat === "GALLERY") {
  const newGalleryItemsRaw = Array.isArray(payload.galleryItems) ? payload.galleryItems : [];
  resolvedGalleryItems = await resolveGalleryItemsForCreate(db, existingFormat, newGalleryItemsRaw);
}
```

`resolveGalleryItemsForCreate` return `[]` jika input kosong → **gallery article bisa di-update jadi kosong**.

**Impact:**
- Create: paksa minimal 1 gambar ✓
- Update: bisa kosong gallery items ✗
- Inkonsistensi business rule
- Database bisa punya gallery article tanpa gallery items (invalid state)

**Expected:**
Update harus reject gallery kosong setelah resolve:
```typescript
if (resolvedGalleryItems !== undefined && resolvedGalleryItems.length === 0 && existingFormat === "GALLERY") {
  throw Object.assign(
    new Error("Gallery article harus memiliki minimal 1 gambar"),
    { status: 400 }
  );
}
```

**Severity:** CRITICAL — data integrity violation

---

## High Issues

### H1. **Featured Image Caption/Credit Tidak Ter-save Saat Upload Baru di Edit Mode**
**Location:** `src/components/admin/articles/ArticleEditorForm.tsx:1274-1282`

**Problem:**
Saat edit article, user bisa ubah caption/credit featured image via form field (`featuredImageAttribution`). Tapi saat submit:

```typescript
// Line 1274-1282
const featuredImagePayload = resolvedFeaturedImageId
  ? {
      mediaId: resolvedFeaturedImageId,
      caption: (fd.featuredImageAttribution?.caption ?? "").trim(),
      credit: (fd.featuredImageAttribution?.credit ?? "").trim(),
    }
  : null;
```

Ini hanya jalan saat `resolvedFeaturedImageId` ada (upload baru). Tapi saat **edit existing featured image attribution tanpa ganti gambar**, `resolvedFeaturedImageId = null` → payload jadi `null` → caption/credit tidak ter-update.

Server-side (`coreWriteArticleService.ts:1246-1256`):
```typescript
const resImg = await resolveFeaturedImageForCreate(db, payload.featuredImage);
if (resImg) {
  if (resImg.mediaId !== oldIdStr || (resImg.caption !== existing.featuredImage?.caption) || (resImg.credit !== existing.featuredImage?.credit)) {
     resolvedFeaturedImage = resImg;
     shouldUpdateFeaturedImage = true;
  }
}
```

Comparison benar, tapi **client tidak mengirim object lengkap saat edit attribution only**.

**Impact:**
- User edit caption/credit di form → klik save → perubahan hilang
- Tidak ada error message → silent failure
- User tidak tahu kenapa perubahan tidak tersimpan

**Expected:**
Saat edit mode dan user edit attribution, kirim object lengkap:
```typescript
featuredImage: {
  mediaId: existingMediaId,
  caption: fd.featuredImageAttribution.caption,
  credit: fd.featuredImageAttribution.credit
}
```

**Severity:** HIGH — silent data loss

---

### H2. **Autosave Tidak Disabled Saat Media Upload In-Progress**
**Location:** `src/components/admin/articles/ArticleEditorForm.tsx:943-973`

**Problem:**
Autosave berjalan setiap 3 detik (line 1019-1036). Tapi saat user sedang upload/crop gambar featured/gallery, autosave tetap jalan dan bisa save state intermediate (misalnya: featured image pending tapi belum di-set ke form).

```typescript
// Line 943-950: Guard condition tidak cek upload in-progress
const performAutoSave = useCallback(async () => {
  if (
    isEditing ||
    !isDraftHydrated ||
    suppressDraftPersistRef.current ||
    isPublishing  // ← hanya cek publishing, tidak cek uploading
  ) {
    return;
  }
```

**Impact:**
- Autosave bisa simpan draft dengan state inconsistent (gambar setengah ter-upload)
- Saat restore draft, user bingung karena gambar pending hilang atau state aneh

**Expected:**
Track upload state dan disable autosave saat upload in-progress:
```typescript
const [isUploading, setIsUploading] = useState(false);

// Di performAutoSave:
if (isEditing || !isDraftHydrated || suppressDraftPersistRef.current || isPublishing || isUploading) {
  return;
}
```

**Severity:** HIGH — draft corruption risk

---

### H3. **Error Rollback Media Cleanup Tidak Atomic**
**Location:** `src/components/admin/articles/ArticleEditorForm.tsx:1371-1387`

**Problem:**
Saat submit gagal setelah beberapa media ter-upload, rollback cleanup dipanggil via fire-and-forget POST:

```typescript
// Line 1372-1377: Fire-and-forget cleanup
if (uploadedFileKeys.length > 0) {
  api
    .post("/media/cleanup", { fileKeys: uploadedFileKeys })
    .catch(() => {});  // ← swallow error, no retry, no log
}
```

**Impact:**
- Jika cleanup gagal (network issue, server error) → orphaned files di S3
- Tidak ada retry mechanism
- Tidak ada logging (console atau user notification)
- Storage leak over time

**Expected:**
- Log cleanup failure
- Optionally: retry 1x atau background job untuk cleanup orphaned files
- Notify user jika cleanup gagal (warning, bukan error blocking)

```typescript
api.post("/media/cleanup", { fileKeys: uploadedFileKeys })
  .catch((err) => {
    console.error("Media cleanup failed:", err);
    // Optional: notify user atau queue retry
  });
```

**Severity:** HIGH — resource leak

---

### H4. **Approval Flow Tidak Validasi Format-Specific Requirements**
**Location:** `src/app/api/articles/[idOrSlug]/approval/route.ts` + `src/services/article/writeArticleService.ts:822-975`

**Problem:**
Approval endpoint (`approveArticleStatus`) hanya ubah status/schedule tanpa validasi business rules per-format:

```typescript
// approval/route.ts:35-49 — langsung approve tanpa validasi content
const article = await approveArticleStatus(
  db,
  idOrSlug,
  { status, scheduledAt, reason, authorId, editorId, contributorIds },
  user,
);
```

`approveArticleStatus` tidak cek:
- Gallery article harus punya `galleryItems.length > 0`
- Standard article harus punya `content` non-empty
- Featured image wajib ada (requirement di form line 1686 tapi tidak di approval)

**Impact:**
- Editor bisa approve gallery article kosong menjadi PUBLISHED
- Article invalid state bisa masuk production
- Frontend crash jika render gallery article tanpa items

**Expected:**
Validation di `approveArticleStatus` sebelum ubah status ke PUBLISHED/SCHEDULED:
```typescript
if (article.format === "GALLERY" && (!article.galleryItems || article.galleryItems.length === 0)) {
  throw Object.assign(
    new Error("Gallery article harus memiliki minimal 1 gambar sebelum dipublikasikan"),
    { status: 400 }
  );
}
```

**Severity:** HIGH — approval bypass validation

---

### H5. **Missing Loading State Saat Promote Temp Media**
**Location:** `src/components/admin/articles/ArticleEditorForm.tsx:1039-1185`

**Problem:**
`uploadAllPendingMedia` bisa upload banyak gambar (featured + editor body + gallery items). Proses bisa lama (network jaringan lambat, banyak gambar). Tapi tidak ada loading indicator per-item atau progress bar.

```typescript
// Line 1060-1072: Featured upload — no loading feedback
if (pendingFeaturedMedia) {
  const result = await promoteOneTempMedia(
    pendingFeaturedMedia.tempMediaId,
    { caption: ..., credit: ..., watermark: ... },
    "featured",
  );
  uploadedFileKeys.push(result.fileKey);
  // ← user tidak tahu progress
}
```

User hanya lihat `isPublishing` spinner di button, tapi tidak tahu:
- Berapa banyak gambar yang sedang di-upload
- Yang mana yang sedang di-proses
- Estimasi waktu tersisa

**Impact:**
- User klik submit → loading lama → user klik lagi (double submit attempt)
- Tidak ada feedback jika upload stuck
- Bad UX di mobile / jaringan lambat

**Expected:**
- Progress indicator: "Uploading 2 of 5 images..."
- Per-item status (optional): featured ✓, gallery item 1 ⏳, gallery item 2 ⏳
- Disable submit button saat upload in-progress (sudah ada `isPublishing` tapi kurang granular)

**Severity:** HIGH — poor UX, potential double-submit

---

## Medium Issues

### M1. **List Page Tidak Menampilkan Format Column**
**Location:** `src/app/admin-xyz/articles/page.tsx:432-540`

**Problem:**
Table columns: Title, Channel, Author, Status, View Count, Updated, Published, Actions. Tidak ada kolom "Format" (STANDARD vs GALLERY).

```typescript
// Line 432-539: columns definition — no format column
const columns: ListTableColumn<Article>[] = [
  { key: "title", ... },
  { key: "category", ... },
  { key: "author", ... },
  { key: "status", ... },
  { key: "viewCount", ... },
  { key: "updatedAt", ... },
  { key: "publishedAt", ... },
  { key: "actions", ... },
  // ← no format column
];
```

Filter ada (`formatFilter` line 257), tapi user tidak bisa lihat format artikel di list tanpa klik edit.

**Impact:**
- User filter by format tapi tidak bisa konfirmasi format di list
- Harus klik "Edit" untuk cek format (extra click)
- Inconsistent: filter tersedia tapi tidak visible di result

**Expected:**
Tambah kolom format (hidden di mobile/tablet, visible di desktop):
```typescript
{
  key: "format",
  header: "Format",
  className: "hidden lg:table-cell whitespace-nowrap",
  render: (row) => (
    <Badge variant="outline">
      {row.format === "GALLERY" ? "Gallery" : "Standard"}
    </Badge>
  ),
}
```

**Severity:** MEDIUM — UX inconsistency

---

### M2. **Status Badge di List Page Salah Mapping untuk DRAFT**
**Location:** `src/app/admin-xyz/articles/page.tsx:386-413`

**Problem:**
```typescript
// Line 388-389
const statusConfig: StatusConfigType = {
  PUBLISHED: { variant: "default", icon: CheckCircle, label: "Published" },
  DRAFT: { variant: "secondary", icon: Clock, label: "Waiting" },  // ← WRONG label
```

Label "Waiting" untuk DRAFT tidak akurat:
- DRAFT = artikel belum disubmit, masih diedit penulis
- PENDING_REVIEW = artikel waiting review oleh editor
- Label "Waiting" di DRAFT membingungkan

**Impact:**
- User bingung: "Waiting for what?" (DRAFT seharusnya "Draft" saja)
- Misleading status representation

**Expected:**
```typescript
DRAFT: { variant: "secondary", icon: FileEdit, label: "Draft" },
```

**Severity:** MEDIUM — misleading UI

---

### M3. **Inconsistent Error Handling di Article POST vs PATCH**
**Location:**
- POST: `src/app/api/articles/route.ts:267-271`
- PATCH: `src/app/api/articles/[idOrSlug]/route.ts:161-164`

**POST error:**
```typescript
catch (error: unknown) {
  logger.error({ err: error }, "Error creating article");
  const { status, body } = mapArticleWriteError(error);
  return NextResponse.json(body, { status });
}
```

**PATCH error:**
```typescript
catch (error: unknown) {
  const { status, body } = mapArticleWriteError(error);
  return NextResponse.json(body, { status });
}
// ← no logger.error
```

**Impact:**
- PATCH error tidak ter-log di server → debugging sulit
- Inconsistent error observability

**Expected:**
Tambah logging di PATCH catch block:
```typescript
catch (error: unknown) {
  logger.error({ err: error }, "Error updating article");
  const { status, body } = mapArticleWriteError(error);
  return NextResponse.json(body, { status });
}
```

**Severity:** MEDIUM — observability gap

---

## Recommendations

### Priority 1 (Critical — fix sebelum production)
1. **C1:** Tambah client-side validation gallery items length
2. **C2:** Strip `format` dari payload saat edit mode
3. **C3:** Tambah validation gallery items di update service

### Priority 2 (High — fix dalam sprint ini)
4. **H1:** Fix featured image attribution update logic
5. **H2:** Disable autosave saat upload in-progress
6. **H3:** Log cleanup failures, add retry mechanism
7. **H4:** Add format-specific validation di approval flow
8. **H5:** Add upload progress indicator

### Priority 3 (Medium — technical debt backlog)
9. **M1:** Tambah format column di list page
10. **M2:** Fix DRAFT status badge label
11. **M3:** Add logging di PATCH error handler

---

## Testing Checklist

Setelah fix, validasi flow berikut:

### Gallery Article Flow
- [ ] Create gallery tanpa gallery items → client error (tidak sampai server)
- [ ] Create gallery dengan 1 item → sukses
- [ ] Edit gallery, hapus semua items → client error (tidak sampai server)
- [ ] Edit gallery, tambah item → sukses
- [ ] Approve gallery article kosong → server reject dengan error 400

### Edit Featured Image Attribution Flow
- [ ] Edit existing article
- [ ] Ubah caption featured image tanpa ganti gambar
- [ ] Save → caption ter-update di DB
- [ ] Refresh page → caption baru muncul

### Upload Progress Flow
- [ ] Create article dengan 5 gallery items
- [ ] Submit → progress indicator muncul "Uploading 1 of 5..."
- [ ] Semua items ter-upload → redirect ke list
- [ ] Cek DB: semua mediaId valid, tidak ada orphaned files

### Approval Flow Validation
- [ ] Buat gallery article kosong (bypass client validation via API)
- [ ] Submit for review
- [ ] Editor approve → server reject 400
- [ ] Editor fix article (tambah gallery items)
- [ ] Approve lagi → sukses published

---

## Notes

- **Root cause C1-C3:** validation split antara client (form) dan server (API/service) tidak consistent. Perlu single source of truth untuk business rules.
- **Root cause H1:** form state management complex (pending media vs existing media), perlu refactor attribution handling.
- **Root cause H2-H5:** missing state tracking untuk async operations (upload, cleanup).

**Estimated fix effort:** 3-5 developer days (termasuk testing).
