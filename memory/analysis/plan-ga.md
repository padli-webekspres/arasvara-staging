## Mulai dari mana?

Urutan yang paling aman: **GA dulu → Vercel staging → validasi environment → baru refactor kode.** Jangan mulai dari refactor kode sebelum staging + GA property staging sudah hidup.

Dengan keputusanmu:

- **Production GA:** `arasvaranews@gmail.com` (tetap, jangan disentuh dulu)
- **Staging / skema baru:** `mp.webekspres@gmail.com`
- **Vercel:** project baru untuk staging
- **R2 + MongoDB Railway:** pakai yang ada

---

## Urutan setup (7 langkah)

### Langkah 0 — Putuskan dulu (30 menit, tanpa coding)

Sebelum buat apa pun, tetapkan ini:

| Keputusan             | Rekomendasi                                                                                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Branch Vercel staging | `dev` (atau branch `staging` khusus)                                                                                                                   |
| URL staging           | `arasvara-staging.vercel.app` atau subdomain custom                                                                                                    |
| MongoDB               | **Database terpisah** di cluster Railway yang sama, mis. `arasvara_staging` — jangan pakai DB production                                               |
| R2                    | Bucket production boleh dipakai staging untuk **read**; untuk **upload** staging, pertimbangkan prefix/folder terpisah agar tidak mengotori media prod |

> MongoDB staging terpisah penting: API `/api/analytics/view-article` dan dashboard CMS internal tidak tercampur dengan data prod.

---

### Langkah 1 — Google Analytics (`mp.webekspres@gmail.com`) ← **MULAI DI SINI**

Ini fondasi. Tanpa ini, Vercel staging tidak punya ID untuk diuji.

1. Login `mp.webekspres@gmail.com` → buat **GA4 Account** baru (mis. `Webekspres - Arasvara`)
2. Buat **Property**: `Arasvara Staging` (timezone Asia/Jakarta)
3. Buat **Web Data Stream** dengan URL staging (boleh update nanti setelah Vercel jadi)
4. Catat **Measurement ID** (`G-XXXXXXXX`)
5. Admin → **Data Retention** → ubah ke **14 bulan**
6. Admin → **Measurement Protocol** → buat **API Secret** → catat untuk server-side
7. Admin → **Custom Definitions** → daftarkan custom dimensions dari report (`article_id`, `category_name`, `tag_1`, dll.) — bisa bertahap, tapi `view_article` core dimensions sebaiknya didaftarkan sekarang
8. Buka **DebugView** — ini alat validasi utama nanti

**Yang tidak perlu sekarang:** Looker Studio, BigQuery, cutover production.

---

### Langkah 2 — Vercel project staging

1. Buat **project Vercel baru** (mis. `arasvara-staging`)
2. Connect repo GitHub yang sama
3. Set **Production Branch** = `dev` (atau branch staging pilihanmu)
4. **Jangan** pasang domain `arasvara.id` di project ini
5. Copy env vars dari production, lalu **override** yang ini:

| Env var                         | Staging                                                      |
| ------------------------------- | ------------------------------------------------------------ |
| `NEXT_PUBLIC_BASE_URL`          | URL Vercel staging                                           |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | `G-...` dari property `mp.webekspres`                        |
| `GA_MP_API_SECRET`              | secret dari langkah 1 (nanti dipakai saat MP diimplementasi) |
| `MONGODB_URI`                   | cluster Railway sama, **database name staging**              |
| R2 / S3 vars                    | sama seperti prod (sesuai rencanamu)                         |
| JWT / Firebase                  | idealnya secret staging terpisah                             |

6. Deploy pertama — pastikan build sukses

**Tujuan langkah ini:** staging bisa dibuka, login, baca artikel, load gambar — belum perlu skema GA baru.

---

### Langkah 3 — MongoDB staging di Railway

1. Buat database `arasvara_staging` (atau clone subset data prod untuk testing realistis)
2. Pastikan staging Vercel mengarah ke DB ini
3. Uji: buka artikel di staging → cek `article_views` masuk ke DB staging, bukan prod

Kalau DB staging kosong total, event GA masih bisa dites, tapi flow CMS analytics internal akan terasa “kosong”.

---

### Langkah 4 — Smoke test staging (tanpa refactor kode)

Checklist sebelum sentuh kode GA:

- [ ] Staging URL bisa diakses
- [ ] Gambar dari R2 tampil
- [ ] Baca 1 artikel → event masuk **DebugView** (`page_view`, `view_article` yang ada sekarang)
- [ ] `POST /api/analytics/view-article` sukses (Network tab)
- [ ] Production `arasvara.id` **masih** pakai GA `arasvaranews@gmail.com` — tidak berubah

Kalau ini belum lulus, jangan lanjut refactor.

---

### Langkah 5 — Refactor kode (sesuai fase di report)

Baru setelah staging + GA staging stabil:

1. **Fase 1:** `measurement-protocol.ts`, perluas parameter `view_article`, env `GA_MP_API_SECRET`
2. **Fase 2–4:** scroll depth, klik headline, share, ads, push, dll.
3. Semua deploy ke **Vercel staging** dulu; validasi di DebugView
4. Production baru di-cutover setelah staging stabil minimal 1–2 minggu

---

### Langkah 6 — Looker Studio

Setelah data staging mengalir **minimal 7 hari** di property `mp.webekspres`:

- Connect Looker Studio ke property staging
- Bangun laporan sesuai report
- Setelah yakin, buat property **Production v2** di akun `mp.webekspres` (atau stream terpisah) untuk cutover prod

---

### Langkah 7 — Cutover production (nanti, bukan sekarang)

Saat staging validated:

1. Property/stream production baru di `mp.webekspres`
2. Update env production Vercel **project prod** (bukan staging)
3. Property lama `arasvaranews` tetap aktif read-only untuk historis
4. Jangan kirim traffic prod ke dua property sekaligus tanpa strategi deduplikasi

---

## Diagram alur singkat

```
Hari 1–2:  GA (mp.webekspres) → Vercel staging → MongoDB staging
Hari 3–5:  Smoke test (kode lama, GA staging aktif)
Minggu 2+: Refactor kode GA (deploy ke staging only)
Minggu 4+: Looker Studio staging
Nanti:     Cutover production ke mp.webekspres
```

---

## Hal penting soal dua akun GA

Pemisahan `arasvaranews` (prod lama) vs `mp.webekspres` (baru) **cocok** untuk melindungi data historis. Yang perlu diingat:

1. **Looker Studio historis** tetap di akun `arasvaranews`; laporan baru di `mp.webekspres` — tidak otomatis digabung
2. **Berikan akses** ke tim yang perlu melihat kedua property (Viewer/Editor di masing-masing akun)
3. **Staging Vercel** hanya boleh pakai GA `mp.webekspres` — jangan pernah pakai measurement ID production lama di staging (bisa mengotori data prod)

---

## Jawaban langsung: mulai dari mana?

**Hari ini:** buat GA4 Account + Property + Data Stream + API Secret di `mp.webekspres@gmail.com`, lalu daftarkan custom dimensions inti.

**Besok:** buat Vercel project staging + env vars + deploy branch `dev`.

**Setelah staging hidup:** smoke test → baru mulai Fase 1 refactor di kode.

Kalau mau, saya bisa susunkan **checklist env vars lengkap** baris per baris dari `.env` project kamu untuk project Vercel staging — switch ke Agent mode dan saya bisa baca `.env` (tanpa mengekspos secret) lalu buatkan matriks staging vs production.
