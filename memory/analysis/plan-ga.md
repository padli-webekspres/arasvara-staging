# Plan: Deploy ke Production + Setup GA4 Property Baru

> Disusun: 29 Juni 2026  
> Scope: Cutover GA4 production (arasvaranews) + deploy kode terbaru ke Vercel production

---

## Status Saat Ini

| Komponen | Status |
|----------|--------|
| Kode GA refactor (Fase 1–4) | ✅ Selesai, sudah di-commit |
| GA4 Staging (mp.webekspres) | ✅ Aktif, `G-FHEHTJ703J` |
| GA4 Production lama (`G-CMFR835YBF`) | ⚠️ Masih aktif — property lama Firebase, **tidak ada custom dimension baru** |
| GA4 Production baru (arasvaranews) | ❌ Belum dibuat |
| `GA_MP_API_SECRET` di prod | ❌ Belum ada di `.env.prod` |
| Vercel production deploy kode baru | ❌ Belum |

---

## Urutan Langkah

---

### BAGIAN A — Setup GA4 Property Baru di `arasvaranews@gmail.com`

#### A1. Buat Property Baru

1. Buka [analytics.google.com](https://analytics.google.com)
2. Login dengan **`arasvaranews@gmail.com`**
3. Admin → **+ Create Property**
   - Nama property: `Arasvara Production v2`
   - Timezone: `(GMT+07:00) Western Indonesia Time`
   - Currency: `Indonesian Rupiah (IDR)`
4. **Data Stream** → Add Stream → Web
   - Website URL: `https://arasvara.id`
   - Stream name: `arasvara.id`
5. Catat **Measurement ID**: `G-XXXXXXXXXX` → akan dipakai sebagai `NEXT_PUBLIC_GA_MEASUREMENT_ID`

#### A2. Atur Data Retention

1. Admin → **Data Settings → Data Retention**
2. Ubah dari **2 bulan → 14 bulan**
3. Klik Save

> ⚠️ Jangan lewati langkah ini. Default 2 bulan berarti data lama hilang dari Explorations & Looker Studio.

#### A3. Buat Measurement Protocol API Secret

1. Admin → **Data Streams** → pilih stream `arasvara.id`
2. Scroll ke bawah → **Measurement Protocol API secrets**
3. Klik **Create** → beri nama: `arasvara-prod-mp`
4. Catat nilai **Secret value** → akan dipakai sebagai `GA_MP_API_SECRET`

#### A4. Daftarkan Custom Dimensions & Metrics

Gunakan script yang sudah ada:

```bash
# Dari root project, set env dulu
set GA4_PROPERTY_ID=<ID_PROPERTY_BARU>   # angka saja, bukan G-xxx
set GOOGLE_APPLICATION_CREDENTIALS=./secrets/ga-admin-mp-webekspres.json

# Jalankan script
npx ts-node scripts/register-ga-custom-definitions.ts
```

> **Catatan:** Service account (`ga-admin-mp-webekspres.json`) harus punya akses **Editor** ke property `arasvaranews`. Caranya:
> 1. Login `arasvaranews@gmail.com` → GA Admin → property baru → **Property Access Management**
> 2. Add user → masukkan email service account dari file JSON (`client_email`)
> 3. Role: **Editor**
> 4. Baru jalankan script

Verifikasi di GA4 Admin → **Custom Definitions** → harus ada 34 dimensions + 6 metrics.

#### A5. Catat Property ID (Angka)

1. Admin → **Property Settings**
2. Catat **Property ID** (format angka, bukan `G-xxx`) → akan dipakai sebagai `GA4_PROPERTY_ID`

---

### BAGIAN B — Update `.env.prod` dan Deploy ke Vercel

#### B1. Update `.env.prod` (untuk referensi lokal)

Tambah/ubah 3 baris berikut di `.env.prod`:

```bash
# Ganti nilai lama G-CMFR835YBF dengan Measurement ID property baru
NEXT_PUBLIC_GA_MEASUREMENT_ID="G-XXXXXXXXXX"

# Tambahkan — sebelumnya tidak ada
GA_MP_API_SECRET="<secret_value_dari_langkah_A3>"

# Tambahkan — sebelumnya tidak ada
GA4_PROPERTY_ID=<angka_property_id_dari_langkah_A5>
```

> **Catatan penting:** `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID="G-CMFR835YBF"` di `.env.prod` **jangan diubah** — itu milik Firebase project `arasvara-14a8c` dan dipakai untuk push notification, bukan untuk tracking GA4 kita.

#### B2. Update Environment Variables di Vercel Production

1. Buka [vercel.com](https://vercel.com) → project `arasvara` (production `arasvara.id`)
2. **Settings → Environment Variables**
3. Update/tambah variabel berikut (scope: **Production**):

| Variabel | Nilai |
|----------|-------|
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | `G-XXXXXXXXXX` (property baru) |
| `GA_MP_API_SECRET` | `<secret dari A3>` |
| `GA4_PROPERTY_ID` | `<angka dari A5>` |
| `NEXT_PUBLIC_GTM_ID` | *(pastikan kosong / hapus jika masih ada nilai `GTM-W2CH2F5D`)* |

4. Klik Save untuk masing-masing.

#### B3. Deploy ke Vercel Production

```bash
# Pastikan semua perubahan kode sudah di-commit
git add -A
git commit -m "feat: GA4 refactor fase 1-4 + fix baca juga public path"
git push origin main
```

Vercel akan otomatis trigger deploy ke production setelah push ke `main`.

Atau deploy manual via Vercel dashboard: **Deployments → Redeploy**.

---

### BAGIAN C — Validasi Setelah Deploy

#### C1. Cek DebugView

1. Install extension Chrome: [Google Analytics Debugger](https://chrome.google.com/webstore/detail/google-analytics-debugger)
2. Aktifkan extension → buka `https://arasvara.id/[salah-satu-artikel]`
3. Buka GA4 → property baru → **Admin → DebugView**
4. Yang harus muncul dalam 30 detik:
   - `page_view`
   - `view_article` (dari Measurement Protocol, mungkin delay 10–30 detik)
   - `session_start`

#### C2. Cek Realtime Report

1. GA4 → property baru → **Reports → Realtime**
2. Buka beberapa halaman artikel di `arasvara.id`
3. Harus terlihat: active users, event `page_view`, `view_article`

#### C3. Cek Network Tab (Measurement Protocol)

1. Buka artikel → F12 → Network → filter `google-analytics.com/mp/collect`
2. Harus ada `POST` request dengan status 200 (atau 204)
3. Ini adalah `view_article` yang dikirim dari server via Measurement Protocol

#### C4. Verifikasi Custom Dimensions Terisi

Setelah 24–48 jam data masuk:
1. GA4 → **Reports → Realtime** → buka event `view_article`
2. Cek apakah parameter `article_title`, `category_name`, `author_name`, dll. terisi

---

### BAGIAN D — Setelah Validasi (Opsional, Nanti)

#### D1. Property Lama Tetap Aktif

Property lama `G-CMFR835YBF` di akun `arasvaranews` **tidak perlu dimatikan** — biarkan tetap aktif sebagai arsip data historis. Setelah deploy, property lama tidak akan menerima event baru dari kode (karena sudah diganti ke property v2).

#### D2. Setup Looker Studio Production

Setelah data property baru masuk minimal 7 hari:
1. Buka [lookerstudio.google.com](https://lookerstudio.google.com)
2. Login `arasvaranews@gmail.com`
3. Create → Report → **Google Analytics 4** data source
4. Pilih property **Arasvara Production v2**
5. Bangun 9 halaman laporan sesuai `memory/analytics/explore_ga.md`

---

## Checklist Final

### Sebelum Deploy
- [ ] A1: Property baru dibuat di `arasvaranews@gmail.com`
- [ ] A2: Data retention diubah ke 14 bulan
- [ ] A3: MP API Secret dibuat → dicatat
- [ ] A4: Script custom definitions dijalankan → 34 dims + 6 metrics terdaftar
- [ ] A5: Property ID (angka) dicatat
- [ ] B1: `.env.prod` diupdate (lokal)
- [ ] B2: Vercel env vars diupdate (`GA_MEASUREMENT_ID`, `GA_MP_API_SECRET`, `GA4_PROPERTY_ID`, `GTM_ID` kosong)

### Setelah Deploy
- [ ] C1: DebugView menampilkan `page_view` + `view_article`
- [ ] C2: Realtime Report aktif
- [ ] C3: Network tab menampilkan POST ke `/mp/collect`
- [ ] C4: Custom dimensions terisi (cek 24–48 jam setelah deploy)

---

## Catatan Penting

- **Firebase tidak berubah** — `NEXT_PUBLIC_FIREBASE_*` dan `FIREBASE_SERVICE_ACCOUNT` di prod tetap menggunakan `arasvara-14a8c`. Push notification tidak terdampak.
- **GTM wajib kosong** — `NEXT_PUBLIC_GTM_ID` harus kosong di Vercel production untuk menghindari double `page_view`.
- **Property lama tidak dihapus** — `G-CMFR835YBF` tetap menyimpan data historis, bisa dibuka di GA4 kapan saja.
- **`GOOGLE_APPLICATION_CREDENTIALS`** hanya dibutuhkan untuk menjalankan script `register-ga-custom-definitions.ts` secara lokal, tidak perlu di-set di Vercel.
