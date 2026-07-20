# Laporan Aktivitas Mingguan — Arasvara

**Periode:** Senin–Jumat, 6–10 Juli 2026  
**Repo:** `Webekspres/arasvara` (remote `arasvara`)  
**Scope:** semua branch remote (`main`, `dev`, `refactor-ga`, `refactor-cdn`, `migrate-16`, `testing-ui`, `versi14`, `Animation`)  
**Author:** semua author (minggu ini hanya `padli-webekspres` / `Padli Webekspres` — `mp.webekspres@gmail.com`)  
**Dibuat:** 10 Juli 2026

---

## Ringkasan eksekutif

| Metrik | Nilai |
|--------|--------|
| Commit unik (feature/fix, non-merge) | **9** |
| Merge PR ke `main` | **5** (`#59`–`#63`) |
| Branch dengan aktivitas | `refactor-ga`, `main` (via merge) |
| Branch tanpa commit minggu ini | `dev`, `refactor-cdn`, `migrate-16`, `testing-ui`, `versi14`, `Animation` |
| Senin 6 Jul | tidak ada commit |
| Status tip | `main` = `01281f4` (PR #63); `refactor-ga` = `cd48f36` (**4 commit belum di-merge ke main**) |

---

## Rekap per tema

### 1. Profil publik & iklan homepage

- **`d771228` (7 Jul)** — `feat(public): migrasi profil penulis dan iklan homepage`
  - Rute profil publik: `/author` → `/penulis` (writer/editor)
  - Artikel berdasarkan `authorId` / `editorId`; tautan terkait dirapikan
  - Section iklan homepage berbasis rasio (termasuk `above_photography`)
  - Perbaikan UI slider/hero, alur push notification, fallback bio penulis
  - Migrasi aset logo PNG → WebP (kemudian diganti lagi ke PNG di Jumat — lihat tema Brand)

**Masuk `main`:** lewat PR **#59** (`b0df628`, 7 Jul)

---

### 2. Push notification / Firebase (production)

Rangkaian fix agar FCM jalan di Railway + guest bisa subscribe:

- **`3e7977b` (8 Jul)** — `fix(push): sertakan config firebase saat docker build`  
  ARG/ENV `NEXT_PUBLIC_FIREBASE_*` di Dockerfile; logging messaging lebih jelas  
  → PR **#60**
- **`d27bc0f` (8 Jul)** — `fix(push): fallback config firebase client production`  
  Fallback prod/dev selaras service worker; hindari gagal FCM jika Docker ARG kosong  
  → PR **#61**
- **`e982064` (8 Jul)** — `fix(push): izinkan subscribe notifikasi untuk guest`  
  Pisahkan token FCM dari persist backend (login); guest tidak kena 401 di subscribe kategori  
  → PR **#62**

---

### 3. Performa homepage (PSI mobile)

- **`c369d96` (8 Jul)** — `perf(homepage): tingkatkan skor PSI mobile`
  - `.browserslistrc` target browser modern
  - CSS Swiper dipindah ke komponen carousel (bukan layout publik)
  - Lazy-load komponen below-fold homepage
  - Defer GTM/GA via `next/script` `afterInteractive`

**Masuk `main`:** PR **#63** (`01281f4`, 8 Jul)

---

### 4. Audit log editorial

- **`fa7b771` (8 Jul)** — `feat(audit): satukan log editorial ke audit_log`
  - Write path editorial → koleksi `audit_log` tunggal
  - Migrasi `editor_activities` + UI activity (filter entity, modal reason)
  - Schedule backdate; reason edit di activity/dashboard trail
  - Perbaikan serialisasi related articles di halaman edit

**Status:** ada di `refactor-ga`, **belum** di `main` (per 10 Jul)

**Script terkait (jalankan dry-run dulu di prod):**

```bash
npm run migrate:editor-activities:prod
npm run verify:editor-activities-migration:prod
```

---

### 5. Layout UI publik & admin (responsive)

- **`62afa0f` (9 Jul)** — `refactor(ui): seragamkan layout halaman publik`
  - Overlay scroll hero (`SnapWrapper` sticky)
  - Padding responsif `px-4 md:px-6 lg:px-8` (ganti `md:px-0`)
  - Utility `admin-card-grid` (2→3→4 kolom; 4 kolom hanya `2xl`)
  - Tombol Edit/Remove `VideoFormCard` stack di kartu portrait sempit
- **`297de6c` (9 Jul)** — `refactor(ui): rapikan filter admin dan artikel`
  - Filter Articles admin: grid 2 kolom responsif
  - Utility `public-page-container` untuk padding halaman publik
  - Margin/padding detail artikel diseragamkan

**Status:** ada di `refactor-ga`, **belum** di `main`

---

### 6. Brand / logo (alpha lintas browser)

- **`cd48f36` (10 Jul)** — `fix(brand): perbaiki alpha logo agar aman di semua browser`
  - Regenerasi logo PNG dengan matte transparan bersih (hindari black-under-alpha WebP)
  - Referensi UI → PNG + `unoptimized` pada `next/image`
  - Utility `brand-logos.ts` untuk path aset terpusat

**Status:** ada di `refactor-ga`, **belum** di `main`

---

## Timeline singkat (Sen–Jum)

| Hari | Aktivitas |
|------|-----------|
| **Sen 6 Jul** | — |
| **Sel 7 Jul** | Profil `/penulis` + iklan homepage; merge PR #59 ke `main` |
| **Rab 8 Jul** | Fix Firebase/push (3 commit) + PSI homepage + audit_log; merge PR #60–#63 ke `main` |
| **Kam 9 Jul** | Seragamkan padding/layout publik & admin; filter Articles + detail artikel |
| **Jum 10 Jul** | Fix alpha logo PNG lintas browser |

---

## Daftar commit unik (non-merge)

1. `d771228` — feat(public): migrasi profil penulis dan iklan homepage  
2. `3e7977b` — fix(push): sertakan config firebase saat docker build  
3. `d27bc0f` — fix(push): fallback config firebase client production  
4. `e982064` — fix(push): izinkan subscribe notifikasi untuk guest  
5. `c369d96` — perf(homepage): tingkatkan skor PSI mobile  
6. `fa7b771` — feat(audit): satukan log editorial ke audit_log  
7. `62afa0f` — refactor(ui): seragamkan layout halaman publik  
8. `297de6c` — refactor(ui): rapikan filter admin dan artikel  
9. `cd48f36` — fix(brand): perbaiki alpha logo agar aman di semua browser  

## Merge PR ke `main` minggu ini

| PR | Merge commit | Isi utama |
|----|--------------|-----------|
| #59 | `b0df628` | Profil penulis + iklan homepage |
| #60 | `ce5ed20` | Firebase Docker build |
| #61 | `c263f33` | Firebase client fallback |
| #62 | `ff03ff3` | Guest push subscribe |
| #63 | `01281f4` | PSI homepage |

## Belum di production (`main` ← `refactor-ga`)

```
cd48f36 fix(brand): perbaiki alpha logo...
297de6c refactor(ui): rapikan filter admin dan artikel
62afa0f refactor(ui): seragamkan layout halaman publik
fa7b771 feat(audit): satukan log editorial ke audit_log
```

---

# Panduan migrasi ke production (full sync, zero data loss)

Referensi operasional: [`deploy_memo.md`](../deploy_memo.md).  
**Sumber env:** `.env` (lokal) vs `.env.prod` (production).  
**Prinsip:** backup production dulu → deploy kode → migrasi **additive** (dry-run) → verifikasi.  
**Jangan** `mongorestore --drop` ke production dari lokal, dan **jangan** `mc mirror --overwrite` MinIO → R2 kecuali sengaja push aset baru.

Secret (`JWT_*`, `S3_SECRET_KEY`, `S3_TOKEN`, `FIREBASE_SERVICE_ACCOUNT`, `GA_MP_API_SECRET`, dll.) **jangan ditulis ulang di chat/PR** — ambil langsung dari `.env.prod` / secret manager Railway.

---

## A. Mapping env lokal ↔ production

| Variabel | Lokal (`.env`) | Production (`.env.prod`) |
|----------|----------------|--------------------------|
| `NODE_ENV` | `development` | `production` |
| `DB_NAME` | `arasvara_news` | `arasvara_news` |
| `MONGO_URL` | `mongodb://192.168.0.109:27001` (Docker map `27001:27017`) | Railway `acela.proxy.rlwy.net:55554` (user `mongo`, DB `arasvara_news`) |
| `NEXT_PUBLIC_BASE_URL` | `http://localhost:3000` | `https://arasvara.id` |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3000/api` | `https://arasvara.id/api` |
| `CORS_ORIGINS` | `http://localhost:3000` | `https://arasvara.id` |
| `S3_ENDPOINT` | `http://192.168.0.109:9000` (MinIO) | Cloudflare R2 `*.r2.cloudflarestorage.com` |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` | MinIO `arasvara_admin` / lokal | R2 access key (dari `.env.prod`) |
| `S3_TOKEN` | kosong (MinIO tidak perlu) | **wajib** diisi (Cloudflare API token R2) |
| `S3_REGION` | `auto` | `apac` |
| `S3_BUCKET_NAME` | `arasvara-images` | `arasvara-images` |
| `S3_BUCKET_AVATAR` | `arasvara-avatars` | `arasvara-avatars` |
| `S3_BUCKET_CONFIGURATION` | `arasvara-configuration` | `arasvara-configuration` |
| `S3_FORCE_PATH_STYLE` | `true` | `true` |
| `S3_MAX_SOCKETS` | `200` | `200` |
| `NEXT_PUBLIC_STORAGE_MEDIA` | `http://192.168.0.109:9000/arasvara-images` | `https://media.arasvara.id` |
| `NEXT_PUBLIC_STORAGE_CONFIGURATION` | `http://192.168.0.109:9000/arasvara-configuration` | `https://configuration.arasvara.id` |
| Firebase project | **DEV** `arasvara-web` | **PROD** `arasvara-14a8c` |
| `NEXT_PUBLIC_FIREBASE_*` + `VAPID` | nilai project `arasvara-web` | nilai project `arasvara-14a8c` (harus ter-inline saat Docker build) |
| `FIREBASE_SERVICE_ACCOUNT` | base64 SA **dev** | base64 SA **prod** (`arasvara-14a8c`) |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | `G-YWQ3WTK5J9` | `G-7TZK76010Z` |
| `GA_MP_API_SECRET` / `GA4_PROPERTY_ID` | (biasanya tidak di lokal) | ada di `.env.prod` |
| `NEXT_PUBLIC_ADMIN_PANEL_PATH` | `admin-xyz` | `admin-xyz` |
| `ARTICLE_STRUCTURED_URL_ENABLED` | `true` | `true` |
| `ARTICLE_PAGE_REVALIDATE_SECONDS` | `3600` | `3600` |
| `SCHEDULER_SECRET` / `CRON_SECRET` | nilai lokal | nilai prod (beda dari lokal) |
| `JWT_SECRET` / `NEXT_PUBLIC_API_SECRET` | lokal (beda) | prod (beda; **jangan** samakan JWT dengan API secret) |

### A1. Siapkan `.env.migrate-prod` untuk script npm `*:prod`

Script seperti `migrate:editor-activities:prod` membaca `--env-file=.env.migrate-prod`. Buat file ini (jangan commit) dengan **minimal**:

```bash
# Salin dari .env.prod — contoh struktur (isi nilai asli dari .env.prod)
DB_NAME=arasvara_news
MONGO_URL=<MONGO_URL dari .env.prod>
S3_ENDPOINT=<S3_ENDPOINT dari .env.prod>
S3_ACCESS_KEY=<S3_ACCESS_KEY dari .env.prod>
S3_SECRET_KEY=<S3_SECRET_KEY dari .env.prod>
S3_TOKEN=<S3_TOKEN dari .env.prod>
S3_REGION=apac
S3_BUCKET_NAME=arasvara-images
S3_BUCKET_AVATAR=arasvara-avatars
S3_BUCKET_CONFIGURATION=arasvara-configuration
S3_FORCE_PATH_STYLE=true
S3_MAX_SOCKETS=200
NEXT_PUBLIC_STORAGE_MEDIA=https://media.arasvara.id
NEXT_PUBLIC_STORAGE_CONFIGURATION=https://configuration.arasvara.id
```

Cara cepat (Git Bash, dari root repo):

```bash
# Jangan commit hasilnya
cp .env.prod .env.migrate-prod
```

### A2. Load env production di shell (untuk mongodump / mc)

```bash
# Git Bash — export tanpa menampilkan secret di history jika memungkinkan
set -a
source .env.prod   # atau: export $(grep -v '^#' .env.prod | xargs)  # hati-hati spasi/quote
set +a

# Alias yang dipakai di panduan ini:
#   $MONGO_URL  → Railway
#   $DB_NAME    → arasvara_news
#   $S3_*       → R2
```

---

## B. Prasyarat

1. Akses GitHub `Webekspres/arasvara`, Railway (Mongo + app di `https://arasvara.id`), Cloudflare R2.
2. File lokal (sudah di `.gitignore` via `.env*`):
   - `.env` — lokal MinIO + Mongo docker
   - `.env.prod` — production
   - `.env.migrate-prod` — untuk script migrasi npm
3. Tool: `git`, `docker`, `mongosh`, `gh` (opsional), Node.js.
4. Maintenance window singkat (opsional) untuk migrasi `audit_log`.

---

## C. Backup production (wajib sebelum apa pun)

### C1. MongoDB Railway → file archive (tidak mengubah prod)

```bash
mkdir -p backup
STAMP=$(date +%Y%m%d-%H%M%S)

# MONGO_URL & DB_NAME dari .env.prod
docker run --rm mongo:latest mongodump \
  --uri="${MONGO_URL}" \
  --db="${DB_NAME}" \
  --archive > "backup/arasvara_prod_${STAMP}.archive"
```

Verifikasi read-only (URI dari `.env.prod`):

```bash
mongosh "${MONGO_URL}/${DB_NAME}" --eval '
  print("articles:", db.articles.countDocuments());
  print("PUBLISHED:", db.articles.countDocuments({ status: "PUBLISHED" }));
  print("users:", db.users.countDocuments());
  print("audit_log:", db.getCollectionNames().includes("audit_log") ? db.audit_log.countDocuments() : 0);
  print("editor_activities:", db.getCollectionNames().includes("editor_activities") ? db.editor_activities.countDocuments() : 0);
'
```

Simpan archive di luar git. **Jangan commit.**

### C2. Snapshot metadata R2 (opsional)

Bucket sama dengan lokal: `arasvara-images`, `arasvara-avatars`, `arasvara-configuration`.  
Endpoint/key dari `.env.prod` (`S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`).

```bash
MSYS_NO_PATHCONV=1 docker run --rm -v mc_config:/root/.mc minio/mc alias set r2_cloud \
  "${S3_ENDPOINT}" "${S3_ACCESS_KEY}" "${S3_SECRET_KEY}"

for b in arasvara-images arasvara-avatars arasvara-configuration; do
  MSYS_NO_PATHCONV=1 docker run --rm -v mc_config:/root/.mc minio/mc ls --summarize "r2_cloud/$b" | tail -5
done
```

Untuk release kode minggu ini: **tidak wajib** mirror R2 ↔ MinIO. Mirror `--overwrite` ke R2 berisiko menimpa object.

### C3. Catat tip git production

```bash
git fetch arasvara
git rev-parse arasvara/main   # catat hash sebelum merge (saat ini basis: 01281f4)
```

---

## D. Deploy kode (`refactor-ga` → `main`)

### D1. Build lokal dengan sanity check

```bash
git checkout refactor-ga
git pull arasvara refactor-ga
npm run build
npm run verify:perf-opts
npm run verify:media-url
npm run verify:cdn-phases
```

### D2. PR & merge

```bash
gh pr create --base main --head refactor-ga \
  --title "release: audit_log, UI padding, brand logo PNG" \
  --body "$(cat <<'EOF'
## Summary
- Satukan editor activity ke audit_log (+ script migrasi)
- Seragamkan padding/layout publik & admin
- Fix alpha logo PNG lintas browser

## Test plan
- [ ] Login + push subscribe (guest & logged-in) di https://arasvara.id
- [ ] Homepage / artikel / kategori padding MacBook & mobile
- [ ] Logo login/navbar tanpa kotak hitam (Safari iOS)
- [ ] Admin /admin-xyz Articles filter 2 kolom
- [ ] Admin editor activity / audit log

EOF
)"
```

### D3. Env yang harus ada di Railway/host production (selaras `.env.prod`)

Pastikan platform deploy **bukan** memakai nilai dari `.env` lokal:

| Wajib di production | Catatan |
|---------------------|---------|
| `MONGO_URL`, `DB_NAME` | Railway Mongo |
| `NEXT_PUBLIC_BASE_URL=https://arasvara.id` | + `NEXT_PUBLIC_API_URL`, `CORS_ORIGINS` |
| `S3_*` + `S3_TOKEN` | R2; `S3_REGION=apac` |
| `NEXT_PUBLIC_STORAGE_MEDIA=https://media.arasvara.id` | CDN publik |
| `NEXT_PUBLIC_STORAGE_CONFIGURATION=https://configuration.arasvara.id` | |
| Semua `NEXT_PUBLIC_FIREBASE_*` + `VAPID` | Project **`arasvara-14a8c`** (bukan `arasvara-web`) |
| `FIREBASE_SERVICE_ACCOUNT` | SA prod |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID=G-7TZK76010Z` | + `GA_MP_API_SECRET`, `GA4_PROPERTY_ID` jika dipakai |
| `JWT_SECRET`, `NEXT_PUBLIC_API_SECRET` | Berbeda satu sama lain |
| `SCHEDULER_SECRET`, `CRON_SECRET` | |
| `ARTICLE_STRUCTURED_URL_ENABLED=true` | URL artikel structured |
| `NEXT_PUBLIC_ADMIN_PANEL_PATH=admin-xyz` | |
| `S3_MAX_SOCKETS=200`, `ARTICLE_PAGE_REVALIDATE_SECONDS=3600` | Performa |

**Docker build:** `NEXT_PUBLIC_FIREBASE_*` harus tersedia sebagai ARG/ENV saat `next build` (sudah di-fix minggu ini). Kalau kosong, FCM di prod gagal meski runtime env terisi.

**Rollback kode:** revert merge / redeploy hash `main` sebelum release.

---

## E. Migrasi data production (additive — tanpa drop)

Jalankan **setelah** backup C1 sukses. Script `*:prod` memakai `.env.migrate-prod` (isi dari `.env.prod`).

### E1. Migrasi `editor_activities` → `audit_log` (wajib untuk `fa7b771`)

```bash
npm run verify:editor-activities-migration:prod
npm run migrate:editor-activities:prod
npm run verify:editor-activities-migration:prod
```

Cek Mongo prod (read-only):

```bash
mongosh "${MONGO_URL}/${DB_NAME}" --eval '
  print("audit_log:", db.audit_log.countDocuments());
  print("editor_activities (legacy):", db.editor_activities.countDocuments());
'
```

Jika gagal: **jangan hapus** `editor_activities`. Restore hanya jika data korup (bagian G).

### E2. Script lain — hanya jika belum pernah di prod

```bash
# Profil /penulis (slug user)
npm run audit:user-slugs:prod
npm run backfill:user-slugs:prod

# Structured article paths
npm run audit:article-paths:prod
# npm run backfill:article-paths:prod

# Featured image filename / CDN
# npm run migrate:featured-image -- --env-file=.env.migrate-prod --dry-run
# npm run migrate:featured-image -- --env-file=.env.migrate-prod --execute

# WebP palsu di featured (jika share preview rusak)
# npm run migrate:webp-audit:prod
# npm run migrate:webp-audit:prod -- --execute
```

### E3. Warm cache (opsional)

```bash
npm run warm:article-paths:prod
```

### E4. Full sync storage (hanya jika memang perlu aset lokal → R2)

Default release minggu ini: **skip**. Jika harus push MinIO lokal → R2, ikuti `deploy_memo.md` (`MODE=push_to_production`) dengan alias:

- Sumber lokal: `S3_ENDPOINT=http://192.168.0.109:9000`, key MinIO dari `.env`
- Tujuan: R2 dari `.env.prod` (`S3_ENDPOINT`, keys, buckets sama)

Selalu mirror **satu bucket dulu** dan verifikasi object count sebelum overwrite penuh.

---

## F. Verifikasi production (smoke test)

Base URL: **`https://arasvara.id`** (bukan localhost).

1. **Auth & admin:** `https://arasvara.id/login` → panel `/admin-xyz` — filter Articles, editor activity.
2. **Push:** subscribe kategori sebagai guest (tanpa 401); pastikan project Firebase **`arasvara-14a8c`**.
3. **Publik:** homepage, `/penulis/[slug]`, artikel structured, kategori — padding & logo.
4. **Logo:** Safari iOS / Android — tanpa kotak hitam.
5. **Media / CDN:**
   - `GET https://arasvara.id/api/media/view?key=featured/...` → **302** ke `https://media.arasvara.id/...`
   - `og:image` absolut CDN di view-source
6. **Hitung dokumen** bandingkan dengan catatan C1 (articles/users tidak boleh turun drastis).

---

## G. Jika terjadi masalah (zero data loss)

### Rollback kode saja

Redeploy / revert merge ke hash `main` sebelum release. Mongo/R2 tidak berubah.

### Restore Mongo dari backup C1

**Hati-hati:** `--drop` menimpa target.

```bash
# Uji di staging dulu (URI staging dari .env.staging), bukan langsung prod
docker run --rm -i mongo:latest mongorestore \
  --uri="${MONGO_URL_STAGING}" \
  --archive --drop < "backup/arasvara_prod_${STAMP}.archive"
```

Restore ke production hanya setelah staging OK + persetujuan eksplisit.  
**Jangan** restore dump lokal (`192.168.0.109:27001`) ke Railway.

### Storage

Jangan mirror MinIO → R2 dengan `--overwrite` sebagai “perbaikan” sembarangan. Prefer object individual / versioning R2.

---

## H. Checklist singkat release minggu ini

- [ ] Backup Mongo prod (`MONGO_URL` dari `.env.prod`) → `backup/arasvara_prod_*.archive`
- [ ] Siapkan `.env.migrate-prod` (salin dari `.env.prod`)
- [ ] Catat hash `arasvara/main` sebelum merge
- [ ] Pastikan Railway env = `.env.prod` (Firebase **14a8c**, CDN `media.arasvara.id`, `S3_TOKEN` terisi)
- [ ] PR `refactor-ga` → `main` (4 commit: audit, UI×2, brand)
- [ ] Deploy sukses di `https://arasvara.id`
- [ ] `migrate:editor-activities:prod` (verify → execute → verify)
- [ ] Smoke test publik + admin + push + logo + media 302
- [ ] Bandingkan count articles/users vs backup

---

## Catatan keamanan

- `.env` / `.env.prod` / `.env.migrate-prod` **tidak boleh** di-commit.
- Jangan tempel `JWT_SECRET`, `S3_SECRET_KEY`, `S3_TOKEN`, atau `FIREBASE_SERVICE_ACCOUNT` ke PR/issue.
- `deploy_memo.md` berisi contoh URI historis — untuk operasi nyata selalu pakai nilai terkini di `.env.prod`.
