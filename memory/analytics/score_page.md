# Laporan PageSpeed Insights — Mobile Performance

**Tanggal analisis:** 24 Juni 2026  
**Skor saat ini:** Desktop performa **91** · Mobile performa **68**  
**Gap:** 23 poin — menandakan masalah yang terasa di perangkat mobile (CPU lambat, jaringan 4G throttled) meskipun desktop sudah baik.

---

## Ringkasan Eksekutif

Mobile score 68 dipengaruhi oleh **empat kelompok masalah utama** yang terlihat di audit PageSpeed:

| # | Masalah PSI | Estimasi dampak | Sumber di codebase |
|---|-------------|-----------------|-------------------|
| 1 | Cache TTL tidak efisien | ~796 KiB | Media CDN + konfigurasi, tanpa header cache panjang |
| 2 | Permintaan pemblokiran render (CSS) | ~790 ms | `layout.tsx` + bundle CSS global besar |
| 3 | Hierarki dependensi jaringan (critical path) | ~601 ms | Rantai HTML → beberapa chunk CSS |
| 4 | Ubah posisi/geometri yang dipaksa (forced reflow) | ~31–34 ms per sumber | GSAP / ScrollTrigger / SplitText di homepage |

Font Rubik via `next/font/local` sudah diperbaiki (menghilangkan Geist + serif), tetapi **bottleneck mobile saat ini lebih dominan di cache aset, CSS blocking, dan JavaScript animasi homepage**.

---

## 1. Gunakan Durasi Cache yang Efisien (~796 KiB)

### Apa yang PSI laporkan

Aset statis dari origin berikut hanya punya TTL cache **4 jam**:

- `media.arasvara.id` — gambar featured `.webp` (25–179 KiB per file)
- `configuration.arasvara.id` — video hero `.mp4`, aset konfigurasi
- `arasvara.id` — logo `main-logo-putih-naskah.png` (~129 KiB)

Total transfer yang bisa di-cache ulang: **~1.163 KiB**.

### Apa yang terjadi di kode

1. **`next.config.ts`** hanya mengatur header keamanan/CORS — **tidak ada** `Cache-Control` untuk aset statis atau media:

```112:130:next.config.ts
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "ALLOWALL" },
          // ... tidak ada Cache-Control
        ],
      },
    ];
  },
```

2. **Upload media ke S3** (contoh avatar) tidak menyetel `CacheControl` pada `PutObjectCommand` — hanya `ContentType`. Pola yang sama kemungkinan dipakai untuk featured image & video konfigurasi.

3. **Satu-satunya cache panjang** yang sudah benar: `/api/media/avatar/view` → `max-age=31536000, immutable`.

4. Gambar artikel di-load dari CDN (`NEXT_PUBLIC_STORAGE_MEDIA` → `media.arasvara.id`) lewat URL absolut di komponen kartu berita, **di luar kontrol Next.js** kecuali header diset di CDN/S3.

### Dampak ke mobile

Setiap kunjungan ulang (dan navigasi antar halaman) memuat ulang ratusan KB gambar + video karena cache browser/CDN kedaluwarsa cepat. Ini memperburuk **FCP** dan **LCP** di jaringan mobile.

### Solusi yang disarankan

| Prioritas | Tindakan | Lokasi |
|-----------|----------|--------|
| **Tinggi** | Set `Cache-Control: public, max-age=31536000, immutable` pada semua objek S3 dengan nama hash/versioned (`.webp`, `.mp4`) | Service upload media (`mediaService`, konfigurasi) |
| **Tinggi** | Konfigurasi CDN (CloudFront / reverse proxy) untuk `media.*` dan `configuration.*` dengan TTL ≥ 1 tahun untuk aset immutable | Infrastruktur |
| **Sedang** | Tambah header cache di `next.config.ts` untuk `/logo-arasvara/**`, `/fonts/**`, `/_next/static/**` | `next.config.ts` |
| **Sedang** | Pastikan URL gambar punya fingerprint (hash di path atau query `?v=`) agar cache panjang aman saat file diganti | Pipeline media |
| **Rendah** | Pertimbangkan `stale-while-revalidate` untuk aset yang jarang berubah tapi tidak immutable | CDN policy |

---

## 2. Permintaan Pemblokiran Render — CSS (~790 ms)

### Apa yang PSI laporkan

Empat chunk CSS memblokir render awal, total **~33,4 KiB** (durasi kumulatif ~1.960 ms di simulasi mobile):

| File | Ukuran | Durasi |
|------|--------|--------|
| `d5d55cfe712b9085.css` | 28,1 KiB | 820 ms |
| `999f0ce57745f53c.css` | 2,8 KiB | 490 ms |
| `355…f51f3fd.css` | 1,2 KiB | 490 ms |
| `51eb6e0b7ee434b7.css` | 1,3 KiB | 170 ms |

Chunk terbesar (`d5d55…`) adalah bundle CSS utama (Tailwind + shadcn + custom).

### Apa yang terjadi di kode

**Semua halaman** memuat CSS berikut dari root layout:

```1:9:src/app/layout.tsx
import "./globals.css";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/scrollbar";
import "swiper/css/mousewheel";
```

`globals.css` sendiri mengimpor:

```26:28:src/app/globals.css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";
```

Artinya **homepage mobile** yang belum scroll ke carousel tetap membayar biaya download + parse **4 file CSS Swiper** + seluruh design system admin/shadcn.

### Dampak ke mobile

Browser mobile harus mengunduh dan mem-parse CSS besar **sebelum** paint pertama. Ini langsung menunda **LCP** — terlihat di critical path (bagian 3).

### Solusi yang disarankan

| Prioritas | Tindakan | Detail |
|-----------|----------|--------|
| **Tinggi** | Pindahkan import Swiper CSS ke komponen yang memakainya saja | Hapus dari `layout.tsx`; import di `HeadlineSlider`, carousel, dll. |
| **Tinggi** | Audit CSS yang tidak terpakai di halaman publik | Pisahkan style admin vs public jika memungkinkan |
| **Sedang** | Lazy-load carousel di bawah fold | `dynamic(() => import(...), { ssr: false })` untuk section non-kritis |
| **Sedang** | Kurangi `@import` berantai di `globals.css` | Pertimbangkan split file CSS per route group `(public)` vs `admin-xyz` |
| **Rendah** | Evaluasi `experimental.optimizeCss` (Next.js) atau critical CSS inline untuk hero | Butuh pengujian regresi visual |

---

## 3. Hierarki Dependensi Jaringan — Critical Path (~601 ms)

### Apa yang PSI laporkan

```
arasvara.id          411 ms  (29,59 KiB)
  └─ d5d55…css       601 ms  (28,08 KiB)  ← bottleneck
  └─ 51eb6e…css      465 ms
  └─ 999f0ce…css     464 ms
  └─ 355…css         428 ms
```

**Tidak ada preconnect** ke origin lain yang terdeteksi.

### Apa yang terjadi di kode

1. Homepage sudah punya **preload LCP** untuk monogram — bagus:

```227:232:src/app/(public)/page.tsx
      <link
        rel="preload"
        as="image"
        href={HERO_MONOGRAM_SRC}
        fetchPriority="high"
      />
```

2. Namun **tidak ada** `preconnect`/`dns-prefetch` ke:
   - `media.arasvara.id` (gambar headline & kartu berita)
   - `configuration.arasvara.id` (video hero, poster)

3. **Hero video** di-load dengan `preload="auto"` — bersaing bandwidth dengan LCP image di mobile:

```54:62:src/components/homepage/HeroVideo.tsx
        <video
          ...
          preload="auto"
```

4. Banyak gambar featured di bawah fold di-fetch tanpa defer — kartu berita langsung render di `HomePageClient` setelah hydration.

### Solusi yang disarankan

| Prioritas | Tindakan |
|-----------|----------|
| **Tinggi** | Tambah `<link rel="preconnect" href="https://media.arasvara.id" crossorigin>` di `layout.tsx` atau `page.tsx` |
| **Tinggi** | Tambah preconnect ke `configuration.arasvara.id` jika video hero di-load dari sana |
| **Tinggi** | Ubah `preload="auto"` → `preload="metadata"` di mobile (deteksi via `matchMedia` atau user-agent) |
| **Sedang** | Tunda fetch video hero sampai setelah `load` event atau intersection observer |
| **Sedang** | Pastikan hanya **satu** resource punya `priority` / `fetchPriority="high"` (monogram sudah benar) |

---

## 4. Ubah Posisi/Geometri yang Dipaksa — Forced Reflow

### Apa yang PSI laporkan

| Sumber | Waktu reflow |
|--------|--------------|
| `4af27f77bd5de33b.js` | 31 ms |
| `[tanpa atribut]` | 34 ms |
| `cf17c1c3066fd104b.js` | 2–13 ms (beberapa call site) |

Chunk ini berasal dari bundle production (GSAP + React client components).

### Apa yang terjadi di kode

Homepage memuat beberapa library animasi yang **membaca geometri DOM setelah menulis DOM**:

**a) Snap scroll (GSAP ScrollTrigger)**

```31:42:src/hooks/animation/useSnapScroll.ts
      const st = ScrollTrigger.create({
        trigger: containerRef.current,
        start: "top top",
        end: "bottom bottom",
        snap: { snapTo: 1 / (panels.length - 1), ... },
      });
```

Dipakai di `SnapWrapper` — seluruh homepage hero.

**b) Split text animasi (baca `offsetWidth` berulang)**

```42:49:src/hooks/animation/useHeroCardSplitText.ts
    const runSplitAnimation = () => {
      if (title.offsetWidth < MIN_TITLE_WIDTH_PX) return false;
      split = new SplitText(title, { type: "words" });
```

Dipakai di `HeroCard` → headline slider homepage.

**c) HeadlineSlider** — `gsap.matchMedia()` + animasi kartu di mount.

**d) Carousel lain** — `HorizontalFeaturedCarousel`, `InTheNewsCarousel` (`offsetWidth` untuk thumb drag).

### Dampak ke mobile

CPU mobile lebih lemah → reflow + animasi GSAP saat initial load memperlambat **TTI** dan bisa memicu **CLS** kecil saat teks di-split.

### Solusi yang disarankan

| Prioritas | Tindakan |
|-----------|----------|
| **Tinggi** | Nonaktifkan `SplitText` di viewport mobile (`max-width: 768px`) — tampilkan judul statis |
| **Tinggi** | Defer inisialisasi `ScrollTrigger` sampai setelah `window.load` atau `requestIdleCallback` |
| **Sedang** | Dynamic import GSAP hanya di halaman homepage: `const gsap = await import('gsap')` |
| **Sedang** | Ganti snap scroll dengan CSS `scroll-snap-type` native (lebih ringan, tanpa JS) |
| **Rendah** | Batch DOM reads/writes di carousel (`InTheNewsCarousel`) dengan `requestAnimationFrame` |

---

## 5. Masalah Tambahan (Tidak Eksplisit di Screenshot, Relevan Mobile)

### 5.1 Homepage sangat "client-heavy"

`HomePageClient.tsx` (~580 baris) memuat banyak carousel, React Query, dan kartu berita sekaligus. Semua di-hydrate di mobile meski sebagian besar konten di bawah fold.

**Solusi:** Pecah section menjadi lazy boundaries (`React.lazy` + `Suspense`), render above-the-fold di server, defer carousel.

### 5.2 Gambar artikel tanpa optimizer

`shouldUnoptimizeNewsCardImage()` mem-bypass `next/image` optimizer untuk URL CDN — bergantung sepenuhnya pada kualitas file `.webp` di S3.

**Solusi:** Pastikan pipeline upload menghasilkan varian mobile (mis. lebar max 640px, quality 75–80).

### 5.3 Font Rubik — 6 weight di-preload

`layout.tsx` mendaftarkan 6 file woff2 dengan `preload: true`. Next.js biasanya hanya preload weight kritis, tapi tetap worth audit di Network tab mobile.

**Solusi:** Kurangi ke 2–3 weight yang benar-benar dipakai di homepage (Regular, Medium, Bold).

### 5.4 Skor desktop 91 vs mobile 68

Desktop toleran terhadap:
- CSS blocking (CPU parse cepat)
- GSAP reflow (GPU/CPU kuat)
- Cache miss (bandwidth besar)

Mobile PSI mensimulasikan **Moto G Power + Slow 4G** → masalah di atas teramplifikasi.

---

## Roadmap Implementasi (Prioritas)

### Fase 1 — Quick wins (estimasi +10–15 poin mobile)

1. Set cache panjang di S3/CDN untuk media & konfigurasi
2. Pindahkan CSS Swiper keluar dari `layout.tsx`
3. `preconnect` ke `media.arasvara.id` + `configuration.arasvara.id`
4. `preload="metadata"` untuk hero video di mobile
5. Nonaktifkan SplitText di mobile

### Fase 2 — Structural (estimasi +5–10 poin)

1. Lazy-load carousel & section bawah fold di homepage
2. Defer GSAP / ScrollTrigger initialization
3. Header cache untuk `/logo-arasvara/**` dan `/fonts/**` di `next.config.ts`
4. Audit ukuran gambar featured untuk mobile

### Fase 3 — Infrastruktur & polish

1. Responsive image variants di pipeline upload
2. Pertimbangkan CSS split public vs admin
3. Evaluasi native scroll-snap vs GSAP snap
4. Kurangi font weight yang di-load

---

## File Kunci untuk Perbaikan

| File | Peran |
|------|-------|
| `next.config.ts` | Header cache static assets |
| `src/app/layout.tsx` | CSS global + Swiper imports |
| `src/app/globals.css` | Tailwind + shadcn bundle |
| `src/app/(public)/page.tsx` | Preload LCP, preconnect CDN |
| `src/components/homepage/HeroVideo.tsx` | Video preload strategy |
| `src/components/homepage/SnapWrapper.tsx` | GSAP snap scroll |
| `src/hooks/animation/useHeroCardSplitText.ts` | Forced reflow SplitText |
| `src/components/news/HeadlineSlider.tsx` | GSAP slider homepage |
| `src/services/mediaService.ts` (upload) | S3 CacheControl metadata |
| CDN config (`media.*`, `configuration.*`) | TTL cache aset statis |

---

## Metrik Target

| Metrik | Mobile sekarang (perkiraan) | Target setelah Fase 1–2 |
|--------|------------------------------|------------------------|
| Performance score | 68 | 80–85 |
| LCP | Terpengaruh CSS + cache | < 2,5 s |
| FCP | Terpengaruh render-blocking CSS | < 1,8 s |
| TBT | Terpengaruh GSAP | < 200 ms |
| CLS | Relatif stabil (font sudah swap) | < 0,1 |

---

## Catatan

- Laporan ini berdasarkan screenshot PageSpeed mobile + analisis kode di branch `dev` per 24 Juni 2026.
- Setelah setiap fase implementasi, re-audit dengan **Mobile + Slow 4G** di URL yang sama untuk memvalidasi peningkatan.
- Perbaikan font (Rubik `next/font/local`) sudah dilakukan — tidak lagi menjadi bottleneck utama; fokus berikutnya adalah **cache, CSS, dan JS animasi homepage**.

---

## Post-deploy Checklist Fase 1

### Konfigurasi CDN

- Atur behavior CDN untuk `https://media.arasvara.id/*` agar mengikuti origin `Cache-Control` dari object storage.
- Atur behavior CDN untuk `https://configuration.arasvara.id/*` agar mengikuti origin `Cache-Control`.
- Untuk file statis immutable (`*.webp`, `*.png`, `*.mp4`) gunakan kebijakan efektif:
  - `Cache-Control: public, max-age=31536000, immutable`
  - Hindari override TTL 4 jam di edge policy.

### Verifikasi Header

- Upload satu gambar artikel baru dari CMS, lalu cek response header CDN:
  - `cache-control: public, max-age=31536000, immutable`
- Upload ulang hero video/thumbnail di konfigurasi, lalu cek header CDN yang sama.
- Verifikasi file lama yang masih 4 jam:
  - lakukan invalidate path relevan **atau**
  - jalankan one-time metadata rewrite di bucket agar objek lama ikut immutable.

### Validasi PSI

- Jalankan ulang PageSpeed Insights (Mobile) pada homepage.
- Pastikan audit berikut menurun:
  - `Gunakan durasi cache yang efisien`
  - `Permintaan pemblokiran render`
  - `Hierarki dependensi jaringan`

---

## Checklist Ops — Responsive Image Variants + Security Headers

Setelah deploy kode PageSpeed (varian `-w640`/`-w1280` + a11y):

### 1. Backfill varian gambar existing (R2 / MinIO)

```bash
# Dry-run media bucket
npm run backfill:image-variants

# Execute media bucket
npm run backfill:image-variants -- --execute

# Configuration bucket (hero poster + section BG) — kritis untuk LCP mobile
npm run backfill:image-variants -- --bucket=configuration
npm run backfill:image-variants -- --bucket=configuration --execute
```

Script mem-paginate bucket, melewati objek yang sudah punya kedua varian, dan menulis `Cache-Control: immutable` pada varian baru. Upload konfigurasi baru juga otomatis menulis `-w640`/`-w1280`.

### 2. Cloudflare Cache Rules (media + configuration)

Untuk origin `media.arasvara.id` dan `configuration.arasvara.id`:

- Cache Rule: path `*.webp`, `*.woff2`, `*.mp4` (dan PNG logo jika versioned)
- Edge TTL / Cache-Control efektif: `public, max-age=31536000, immutable`
- Pastikan edge **mengikuti** origin `Cache-Control` (jangan override TTL 4 jam)

### 3. HSTS (Cloudflare SSL/TLS)

Di Cloudflare dashboard → SSL/TLS → Edge Certificates:

- Enable HSTS: `max-age=31536000; includeSubDomains; preload`
- Enable "Always Use HTTPS"

### 4. Re-test PageSpeed

Setelah deploy + backfill + cache rules:

1. PageSpeed Insights desktop homepage → target Performance ≥90, Accessibility ≥90
2. PageSpeed Insights mobile homepage
3. Spot-check 1 artikel detail (galeri + featured image)

---

## Mobile Recovery (Slow 4G / LCP)

Kode yang sudah diterapkan di app:

- Font Rubik preload dikurangi (hapus italic)
- GA/GTM `lazyOnload`; Firebase PushSubscriber dynamic
- GSAP snap-scroll dinonaktifkan di mobile; HeadlineSlider CSS transform
- Hero video mobile ditunda (poster = LCP) sampai idle/scroll
- Preload LCP poster memakai `imagesrcset`/`imagesizes` selaras `ResponsiveMediaImage` (hindari double-fetch)
- Hero poster di-SSR lewat `HeroLcpPoster` (ada di HTML awal)
- Loading overlay tidak menunggu `latest` articles
- LogoLoader CSS-only; section BG + sponsor logos + artikel featured pakai `ResponsiveMediaImage`
- Configuration + ads upload menulis varian `-w640`/`-w1280`
- Gallery dialog GSAP di-import dinamis saat dibuka
- Bundle analyzer: `npm run analyze`
- Lighthouse mobile: `LIGHTHOUSE_URL=https://arasvara.id npm run lighthouse:mobile`
- Target modern: `tsconfig` ES2020 + `.browserslistrc` (tanpa polyfill spekulatif)
- Cache headers app: `/_next/static`, `/fonts`, `/logo-arasvara` → `public, max-age=31536000, immutable` di `next.config.ts`

Dead / legacy (tidak di-bundle homepage aktif):

- `HorizontalFeaturedCarousel.tsx` + `useHorizontalScroll.ts` — tidak di-import
- `components/navigation/Navbar.tsx` (GSAP) — diganti `NavbarContainer`

Setelah deploy, jalankan kembali PSI mobile dan pastikan:

1. LCP element = hero poster (bukan video MP4 / overlay logo); satu request selaras preload/srcset
2. Tidak ada long task GSAP di initial load mobile
3. Backfill varian **media + configuration** + Cloudflare immutable cache sudah aktif
4. Skor 90+ tidak dijamin dari kode saja — butuh TTFB/CDN origin yang sehat

### Verifikasi lokal (pre-deploy)

```bash
npx tsc --noEmit
npm run verify:perf-opts
npm run build
# opsional: ANALYZE=true npm run analyze
```

PSI/Lighthouse terhadap produksi + backfill R2 + Cloudflare tetap checklist manual ops.