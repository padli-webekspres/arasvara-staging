## Mulai dari mana?

Urutan yang paling aman: **GA dulu → Firebase staging → Vercel staging → validasi environment → baru refactor kode.** Jangan mulai dari refactor kode sebelum staging + GA property staging sudah hidup.

### Keputusan akun & environment (final)

| Layer | Staging | Production |
|-------|---------|------------|
| **Akun Google** | `mp.webekspres@gmail.com` (akun pribadi kantor) | `arasvaranews@gmail.com` |
| **GA4** | Property baru di akun mp — untuk dev & validasi skema | Property **baru** (v2) di akun arasvaranews — jadi utama setelah cutover |
| **GA4 historis** | — | Property lama di arasvaranews **tetap aktif** (read-only, tidak dihapus) |
| **Firebase (FCM push)** | Project Firebase di akun **mp.webekspres** | Project `arasvara-14a8c` di akun **arasvaranews** |
| **Vercel** | Project baru (`staging-arasvara.vercel.app`) | Project production (`arasvara.id`) |
| **MongoDB** | Atlas staging (cluster terpisah) | Railway production |
| **R2** | Bucket production (read); upload hati-hati | Cloudflare R2 production |

> **Prinsip:** Seluruh environment staging (GA + Firebase + env Vercel) memakai akun **mp.webekspres**. Production sepenuhnya di **arasvaranews** — property GA baru dibuat nanti agar data lama tidak hilang.

---

## Urutan setup (7 langkah)

### Langkah 0 — Putuskan dulu (30 menit, tanpa coding)

Sebelum buat apa pun, tetapkan ini:

| Keputusan             | Rekomendasi                                                                                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Branch Vercel staging | `dev` (atau branch `staging` khusus)                                                                                                                   |
| URL staging           | `arasvara-staging.vercel.app` atau subdomain custom                                                                                                    |
| MongoDB | **Atlas staging** (cluster terpisah dari Railway prod) — lihat `MONGO_URL` di `.env.staging` |
| R2                    | Bucket production boleh dipakai staging untuk **read**; untuk **upload** staging, pertimbangkan prefix/folder terpisah agar tidak mengotori media prod |

> MongoDB staging terpisah penting: API `/api/analytics/view-article` dan dashboard CMS internal tidak tercampur dengan data prod.

---

### Langkah 1 — Google Analytics + Firebase (`mp.webekspres@gmail.com`) ← **MULAI DI SINI**

Ini fondasi staging. Tanpa ini, Vercel staging tidak punya ID GA/Firebase untuk diuji.

#### 1a. GA4 (akun mp.webekspres)

1. Login `mp.webekspres@gmail.com` → buat **GA4 Account** (mis. `Webekspres - Arasvara Staging`)
2. Buat **Property**: `Arasvara Staging` (timezone Asia/Jakarta)
3. Buat **Web Data Stream** dengan URL `https://staging-arasvara.vercel.app`
4. Catat **Measurement ID** (`G-XXXXXXXX`) → `NEXT_PUBLIC_GA_MEASUREMENT_ID` di `.env.staging`
5. Admin → **Data Retention** → ubah ke **14 bulan**
6. Admin → **Measurement Protocol** → buat **API Secret** → `GA_MP_API_SECRET`
7. Admin → **Custom Definitions** → daftarkan custom dimensions dari `refactor-data-ganalytics.md`
8. Buka **DebugView** — alat validasi utama

#### 1b. Firebase (akun mp.webekspres)

Seluruh Firebase staging harus di akun **mp.webekspres** (bukan `arasvara-14a8c` production).

1. Firebase Console (`mp.webekspres@gmail.com`) → buat project baru atau pakai project staging yang ada
2. Aktifkan **Cloud Messaging (FCM)** → generate **VAPID key** → `NEXT_PUBLIC_FIREBASE_VAPID_KEY`
3. Tambahkan **Authorized domains**: `staging-arasvara.vercel.app`, `localhost`
4. Salin config web app → isi semua `NEXT_PUBLIC_FIREBASE_*` di `.env.staging`
5. Service Account → generate key → encode base64 → `FIREBASE_SERVICE_ACCOUNT`
6. Link GA property staging ke Firebase project (opsional, Integrations → Google Analytics)

**Yang tidak perlu sekarang:** Looker Studio production, cutover `arasvara.id`, property GA di akun arasvaranews.

---

### Langkah 2 — Vercel project staging

1. Buat **project Vercel baru** (mis. `arasvara-staging`)
2. Connect repo GitHub yang sama
3. Set **Production Branch** = `dev` (atau branch staging pilihanmu)
4. **Jangan** pasang domain `arasvara.id` di project ini
5. Copy env vars dari production, lalu **override** yang ini:

| Env var | Staging (akun mp.webekspres) |
| ------- | ------------------------------ |
| `NEXT_PUBLIC_BASE_URL` | `https://staging-arasvara.vercel.app` |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | `G-...` dari property staging (akun mp) |
| `GA_MP_API_SECRET` | API secret dari property staging (akun mp) |
| `NEXT_PUBLIC_FIREBASE_*` | Semua dari Firebase project akun **mp.webekspres** |
| `FIREBASE_SERVICE_ACCOUNT` | Service account Firebase akun **mp.webekspres** |
| `MONGO_URL` | MongoDB Atlas staging (bukan Railway prod) |
| R2 / S3 vars | Sama seperti prod (read media prod) |
| JWT / secrets | Boleh sama sementara; idealnya terpisah nanti |

> **Jangan** pakai `NEXT_PUBLIC_GA_MEASUREMENT_ID` atau Firebase keys dari production (`arasvaranews` / `arasvara-14a8c`) di project Vercel staging.

6. Deploy pertama — pastikan build sukses

**Tujuan langkah ini:** staging bisa dibuka, login, baca artikel, load gambar — belum perlu skema GA baru.

---

### Langkah 3 — MongoDB staging (Atlas)

1. Pastikan `MONGO_URL` di `.env.staging` mengarah ke **MongoDB Atlas staging** (bukan Railway production)
2. Restore data dari Railway prod ke Atlas staging jika perlu (lihat `deploy_memo.md`)
3. Uji: buka artikel di staging → cek `article_views` masuk ke DB Atlas staging, bukan prod

Kalau DB staging kosong total, event GA masih bisa dites, tapi flow CMS analytics internal akan terasa “kosong”.

---

### Langkah 4 — Smoke test staging (tanpa refactor kode)

Checklist sebelum sentuh kode GA:

- [ ] Staging URL bisa diakses
- [ ] Gambar dari R2 tampil
- [ ] Baca 1 artikel → event masuk **DebugView** (`page_view`, `view_article` yang ada sekarang)
- [ ] `POST /api/analytics/view-article` sukses (Network tab)
- [ ] Production `arasvara.id` **masih** pakai GA + Firebase production (`arasvaranews` / `arasvara-14a8c`) — tidak berubah

Kalau ini belum lulus, jangan lanjut refactor.

---

### Langkah 5 — Refactor kode (sesuai fase di report)

Baru setelah staging + GA staging stabil:

1. **Fase 1:** `measurement-protocol.ts`, perluas parameter `view_article`, env `GA_MP_API_SECRET`
2. **Fase 2–4:** scroll depth, klik headline, share, ads, push, dll.
3. Semua deploy ke **Vercel staging** dulu; validasi di DebugView
4. Production baru di-cutover setelah staging stabil minimal 1–2 minggu

---

### Langkah 6 — Looker Studio (staging dulu)

Setelah data staging mengalir **minimal 7 hari** di property akun **mp.webekspres**:

- Connect Looker Studio (login `mp.webekspres@gmail.com`) → property **Arasvara Staging**
- Bangun & uji laporan sesuai `refactor-data-ganalytics.md`
- Setelah skema event stabil, replikasi struktur laporan ke property production v2 (langkah 7)

---

### Langkah 7 — Cutover production (`arasvaranews@gmail.com`) — nanti

Saat staging validated (minimal 1–2 minggu):

1. Login `arasvaranews@gmail.com` → buat **GA4 Property baru**: `Arasvara Production v2`
2. Copy custom dimensions & event schema **identik** dengan staging (mp)
3. Buat Web Data Stream untuk `https://arasvara.id` + Measurement Protocol API Secret
4. **Property lama** di akun arasvaranews tetap aktif — tidak dihapus, hanya tidak menerima traffic baru
5. Update env **Vercel production** (bukan staging):
   - `NEXT_PUBLIC_GA_MEASUREMENT_ID` → `G-...` property v2 (arasvaranews)
   - `GA_MP_API_SECRET` → secret property v2
   - Firebase tetap `arasvara-14a8c` (arasvaranews) — **tidak diganti**
6. Deploy production → validasi Realtime / DebugView
7. Looker Studio production: connect ke property v2 di akun **arasvaranews**

> Cutover production **hanya** mengganti GA measurement ID — Firebase production (`arasvara-14a8c`) tidak berubah.

## Diagram alur singkat

```
Fase staging (mp.webekspres@gmail.com)
  Hari 1–2:  GA + Firebase staging → Vercel staging → MongoDB Atlas staging
  Hari 3–5:  Smoke test (kode lama, GA staging aktif)
  Minggu 2+: Refactor kode GA (deploy ke staging only)
  Minggu 4+: Looker Studio staging (akun mp)

Fase production (arasvaranews@gmail.com) — setelah staging stabil
  Buat GA Property v2 di arasvaranews
  Cutover arasvara.id → property v2
  Property lama arasvaranews tetap sebagai arsip historis
  Looker Studio production di akun arasvaranews
```

---

## Hal penting soal dua akun Google

Pemisahan **mp.webekspres** (staging) vs **arasvaranews** (production):

| Aspek | Staging (mp) | Production (arasvaranews) |
|-------|--------------|---------------------------|
| GA property | Validasi skema event baru | Property v2 (utama) + property lama (arsip) |
| Firebase | Project di akun mp | `arasvara-14a8c` — tidak berubah saat cutover GA |
| Looker Studio | Laporan uji di akun mp | Laporan resmi di akun arasvaranews |
| Data historis GA | Tidak relevan | Tetap di property lama arasvaranews |

Yang perlu diingat:

1. **Jangan campur** measurement ID staging (mp) ke `arasvara.id`
2. **Jangan campur** Firebase production (`arasvara-14a8c`) ke Vercel staging — push notif bisa sampai ke user prod
3. **Berikan akses** tim ke kedua akun jika perlu melihat staging & production
4. Saat cutover production, **copy skema** (custom dimensions, event names) dari staging mp → production arasvaranews — bukan pindah property, melainkan replikasi konfigurasi

---

## Jawaban langsung: mulai dari mana?

**Hari ini:** buat GA4 Property + Firebase project di `mp.webekspres@gmail.com`, daftarkan custom dimensions inti.

**Besok:** Vercel project staging + isi `.env.staging` (GA + Firebase dari akun mp) + deploy branch `dev`.

**Setelah staging hidup:** smoke test → Fase 1 refactor di kode.

**Nanti (staging stabil):** buat GA Property v2 di `arasvaranews@gmail.com` → cutover production.
