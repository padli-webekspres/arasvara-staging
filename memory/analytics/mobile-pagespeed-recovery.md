# Mobile PageSpeed Recovery — Ringkasan Kerja & Checklist Deploy

**Periode:** Agustus 2026  
**Fokus:** Homepage mobile (LCP / FCP / TBT), image variants, critical path  
**Catatan:** Skor PageSpeed 90+ hanya valid setelah deploy production + backfill varian + cache CDN. Kode saja tidak menjamin LCP &lt; 2.5s di Slow 4G.

---

## 1. Yang sudah dikerjakan di kode

### 1.1 Baseline & tooling

- `@next/bundle-analyzer` + script `npm run analyze` (`ANALYZE=true`)
- Script Lighthouse mobile: `npm run lighthouse:mobile` — URL dari `LIGHTHOUSE_URL` atau `NEXT_PUBLIC_BASE_URL` di `.env` (Lighthouse 13: `--form-factor=mobile`)
- Target modern: `tsconfig` `ES2020` + `.browserslistrc` yang sudah ada (tanpa polyfill spekulatif)
- Cache headers app di `next.config.ts`: `/_next/static`, `/fonts`, `/logo-arasvara` → `public, max-age=31536000, immutable`

### 1.2 Critical rendering path

- Font Rubik: preload dikurangi (italic dihapus dari preload)
- Analytics browser: `lazyOnload` agar tidak bersaing dengan LCP
- Firebase / FCM: `DeferredPushSubscriber` (client wrapper; tidak memblok SSR layout)
- Navbar: duplikat `usePushNotification()` dihapus (satu jalur deferred push)

### 1.3 Animasi & main thread

- GSAP snap-scroll (`useSnapScroll`): dynamic import; **dinonaktifkan di mobile** + `prefers-reduced-motion`
- `HeadlineSlider`: animasi CSS `transform` / `opacity` (tanpa GSAP di path kritis)
- `HeroVideo`: di mobile, MP4 ditunda sampai idle / scroll; poster = kandidat LCP
- `LogoLoader`: CSS-only (tanpa GSAP di overlay)
- `GalleryImageDialog`: GSAP di-import dinamis hanya saat dialog dibuka
- `useHeroCardSplitText`: GSAP/SplitText dinamis; skip di mobile

### 1.4 Image delivery & LCP

- `ResponsiveMediaImage`: `srcset` `-w640` / `-w1280`, fallback ke original jika varian 404
- Preload hero poster di `page.tsx` memakai `imagesrcset` + `imagesizes="100vw"` (selaras poster)
- **SSR LCP poster:** `HeroLcpPoster` di HTML awal (tidak menunggu hidrasi client)
- Section BG homepage, sponsor logos, featured artikel, gallery, ads cards: pakai variants / lazy di bawah fold
- Loading overlay homepage: **tidak** menunggu fetch `latest` articles (agar tidak menutup hero LCP)

### 1.5 Pipeline upload & backfill

- **Configuration bucket** (`s3-configuration.ts`): upload image menulis original WebP + `-w640` / `-w1280`; delete ikut hapus varian
- **Ads finalize** (`adsSharedHelpers.ts`): sama — menulis width variants
- Media library (sudah ada sebelumnya): `generateImageVariants` di upload/promote
- Backfill script:
  - Media: `npm run backfill:image-variants -- --execute`
  - Configuration (hero poster, section BG): `npm run backfill:image-variants -- --bucket=configuration --execute`

### 1.6 Cleanup ringan

- Footer: `priority` dihapus dari logo below-fold
- Dead / legacy (tidak di-bundle homepage aktif, belum dihapus file):  
  `HorizontalFeaturedCarousel.tsx`, `useHorizontalScroll.ts`, `components/navigation/Navbar.tsx` (diganti `NavbarContainer`)

### 1.7 Dokumentasi terkait

- Ops checklist CDN / backfill: `memory/analytics/score_page.md` (bagian Mobile Recovery + Checklist Ops)

---

## 2. Setelah deploy — wajib dilakukan

Urutan yang disarankan:

### Langkah 1 — Deploy production

Pastikan commit yang di-deploy berisi perubahan di atas (branch/merge yang benar).

### Langkah 2 — Backfill varian (paling kritis untuk LCP)

Jalankan dengan env yang menunjuk bucket production (R2):

```bash
# Dry-run dulu (opsional)
npm run backfill:image-variants -- --bucket=configuration
npm run backfill:image-variants

# Execute
npm run backfill:image-variants -- --bucket=configuration --execute
npm run backfill:image-variants -- --execute
```

**Alasan:** Preload dan `srcset` mengarah ke file `-w640.webp` / `-w1280.webp`. Tanpa backfill, request varian 404 lalu fallback ke WebP penuh → LCP mobile tetap berat, terutama hero poster di `configuration.*`.

### Langkah 3 — Cloudflare / CDN

Untuk origin media & configuration:

- Cache rule: path `*.webp`, `*.woff2`, `*.mp4` (dan aset versioned lain) → efektif `public, max-age=31536000, immutable`
- Edge **mengikuti** origin `Cache-Control` (jangan override TTL pendek, mis. 4 jam)
- HSTS: `max-age=31536000; includeSubDomains; preload` + Always Use HTTPS

**Alasan:** Kode sudah menulis immutable pada upload/varian baru; edge yang memotong TTL membuat repeat visit dan skor lab tetap buruk.

### Langkah 4 — Verifikasi LCP di browser (mobile / throttling)

- LCP element = **hero poster**, bukan video MP4, bukan logo overlay loading
- Network: URL poster idealnya varian responsif (sering 640w di HP); tidak double-fetch original + 1280 yang sia-sia
- View-source / initial HTML: `<img>` poster ada sebelum JS berat jalan

**Alasan:** Memastikan SSR poster, defer video, dan overlay fix aktif di production.

### Langkah 5 — PageSpeed / Lighthouse

```bash
LIGHTHOUSE_URL=https://arasvara.id npm run lighthouse:mobile
```

Lalu PageSpeed Insights desktop + mobile setelah CDN & backfill “hangat”.

**Alasan:** Skor hanya bermakna pada URL production dengan varian & cache yang sudah ada.

### Langkah 6 — Analytics smoke (GA4)

- Cek GA4 Realtime / DebugView: `page_view` masuk (initial + navigasi SPA)
- Pastikan `NEXT_PUBLIC_GA_MEASUREMENT_ID` production benar

**Alasan:** Script analytics di-defer (`lazyOnload`); data harus tetap masuk, hanya tidak bersaing dengan LCP seawal dulu.

### Langkah 7 — Smoke fungsional singkat

- Hero: poster tampil dulu; video muncul setelah idle/scroll di mobile
- Headline, latest, ads, gallery masih normal
- Upload ulang poster hero di admin → cek object `-w640` / `-w1280` muncul di configuration bucket
- Upload iklan baru → cek varian di media bucket

**Alasan:** Pipeline upload configuration & ads berubah; regressi upload harus ditangkap cepat.

---

## 3. Yang harus diperhatikan

| Risiko                        | Mengapa penting                                                                                       |
| ----------------------------- | ----------------------------------------------------------------------------------------------------- |
| Backfill belum dijalankan     | Kode “benar” tapi LCP tetap jelek karena file varian belum ada                                        |
| CDN TTL pendek / override     | Repeat visit & lab score tidak membaik                                                                |
| Skor lab vs field             | Slow 4G lab bergantung TTFB origin; 90+ tidak dijamin dari kode saja                                  |
| Overlay / flash singkat       | Overlay lebih jarang; jika prefetch config/headline gagal bisa ada flash konten                       |
| Object legacy tanpa immutable | Hanya object baru + hasil backfill yang pasti immutable; legacy mungkin perlu migrasi header terpisah |
| Branch / commit salah         | Deploy tanpa commit recovery = production tidak dapat perbaikan                                       |
| Double-fetch poster           | Jika preload URL ≠ pilihan `srcset` browser, cek Network; seharusnya sudah diselaraskan di `page.tsx` |

---

## 4. Verifikasi lokal (sebelum / selain deploy)

```bash
npx tsc --noEmit
npm run verify:perf-opts
npm run build
# opsional
npm run analyze
```

---

## 5. Referensi file utama

| Area                   | Path                                                                              |
| ---------------------- | --------------------------------------------------------------------------------- |
| Preload + SSR poster   | `src/app/(public)/page.tsx`, `src/components/homepage/HeroLcpPoster.tsx`          |
| Hero / snap            | `HeroVideo.tsx`, `SnapWrapper.tsx`, `useSnapScroll.ts`                            |
| Responsive img         | `src/components/ui/ResponsiveMediaImage.tsx`, `src/lib/media/public-media-url.ts` |
| Config upload variants | `src/lib/configuration/s3-configuration.ts`                                       |
| Ads variants           | `src/services/ads/adsSharedHelpers.ts`                                            |
| Backfill               | `scripts/backfill-image-variants.ts`                                              |
| Layout / defer         | `src/app/layout.tsx`, `DeferredPushSubscriber.tsx`                                |
| Ops PageSpeed historis | `memory/analytics/score_page.md`                                                  |
