# Audit Google Indexing - Arasvara Portal Berita

**Target:** Percepat indexing Google dari 24-72 jam jadi lebih cepat untuk kebutuhan engagement & momentum berita.

**Audit Date:** 2026-08-18  
**Project:** Arasvara (Next.js 15, App Router, ISR)

---

## Current Implementation

### 1. Sitemap Infrastructure ✅
**Status:** Sudah solid, sesuai best practice.

- **Main Sitemap:** `/sitemap.xml` (all articles, categories, authors)
- **News Sitemap:** `/sitemap-news.xml` & `/sitemap_news.xml` (48 jam terakhir, max 1000 URLs)
- **robots.txt:** Sudah declare kedua sitemap
- **Cache:** 1 jam (`max-age=3600`)
- **lastmod:** Ada, pakai `contentUpdatedAt` atau `updatedAt`

**Kode:**
- `src/services/sitemapService.ts` — fetch articles from DB
- `src/lib/sitemap-xml.ts` — build XML dengan `<lastmod>`
- `src/app/sitemap.xml/route.ts` — route handler
- `src/app/sitemap_news.xml/route.ts` — Google News sitemap (48h window)

**Strengths:**
- Sitemap news sudah ada (Google News prioritas tinggi untuk fresh content)
- lastmod field ada untuk signal freshness
- robots.txt sudah expose sitemap

**Gaps:**
- Sitemap di-cache 1 jam — artikel baru baru muncul di sitemap setelah 1 jam
- Tidak ada ping/submit sitemap otomatis ke Google setelah artikel publish

---

### 2. Structured Data (JSON-LD) ✅
**Status:** Complete, SEO-friendly.

- **NewsArticle schema:** Ada di setiap artikel (`ArticleJsonLd.tsx`)
- **Organization schema:** Homepage
- **WebSite schema:** Homepage dengan SearchAction
- **ProfilePage schema:** Author pages

**Fields present:**
- `headline`, `description`, `image`
- `datePublished`, `dateModified` (ISO UTC)
- `author` (Person), `publisher` (Organization with logo)
- `url`, `mainEntityOfPage`

**Strengths:**
- Semua schema core ada
- dateModified update saat content change (title/excerpt/content)

**Gaps:**
- Tidak ada `speakable`, `video`, atau enhanced schema lain yang bisa boost rich results

---

### 3. Metadata & Open Graph ✅
**Status:** Solid implementation.

- **Title, description, keywords:** Dynamic per page
- **Canonical URL:** Ada di semua halaman (`alternates.canonical`)
- **Open Graph:** article type, publishedTime, modifiedTime, images
- **Twitter Card:** summary_large_image
- **robots meta:** index,follow di public pages

**Code:** `src/lib/server/article-detail-page.ts` — `buildMetadataFromArticle()`

**Strengths:**
- Canonical URL konsisten
- OG metadata lengkap untuk social sharing
- No duplicate content issues

---

### 4. ISR & Cache Strategy ⚠️
**Status:** Partial — revalidation ada tapi on-demand only.

**Current behavior:**
- **Public article pages:** No explicit `revalidate` export → default Next.js behavior (static saat build, revalidate on-demand)
- **Author pages:** `export const revalidate = 300` (5 menit)
- **On-demand revalidation:** Ada via `revalidateArticlePage()` di `src/lib/cache/revalidate-article-page.ts`
  - Called dari `safeRevalidateArticlePublicPage()` in write service
  - Uses `revalidatePath()` dan `revalidateTag()`

**Revalidation triggers:**
- Article create/update di `coreWriteArticleService.ts`
- Article approval di approval route

**Gaps:**
- **Tidak ada time-based revalidate di article pages** — Google crawler hit cached version sampai on-demand revalidate triggered
- **Sitemap cache 1 jam** — new article tidak langsung visible di sitemap untuk crawler

---

### 5. IndexNow / Google Indexing API ❌
**Status:** TIDAK ADA.

**Current state:**
- Tidak ada integrasi IndexNow
- Tidak ada Google Indexing API
- Tidak ada ping ke search engines saat article publish
- Fully passive — menunggu Google crawl sitemap

**Impact:**
- Google harus wait untuk crawl schedule atau cache expiry sitemap
- Tidak ada instant notification saat artikel baru publish

---

### 6. Scheduled Publishing & Cron ✅
**Status:** Ada, tapi tidak trigger indexing.

- **Endpoint:** `/api/publish-scheduled`
- **Service:** `publishScheduledArticles()` in `writeArticleService.ts`
- **Auth:** `x-scheduler-secret` header
- **Revalidation:** Triggered setelah publish (`safeRevalidateArticlePublicPage()`)

**Note:** Cron eksternal (Vercel Cron / external service) harus hit endpoint ini. Tidak ada config di repo.

---

## Root Cause Analysis

**Kenapa indexing lambat 24-72 jam?**

1. **Passive Discovery:** Google harus crawl sitemap sendiri, tidak ada ping
2. **Sitemap Cache:** Artikel baru muncul di sitemap setelah 1 jam (cache expiry)
3. **No Direct Notification:** Tidak ada IndexNow atau Indexing API untuk notify Google
4. **Crawl Budget:** Portal berita kecil/medium dapat crawl budget terbatas dari Google
5. **No Priority Signal:** Tidak ada mekanisme untuk mark artikel urgent/breaking news

**Bottleneck terbesar:** Fully passive indexing strategy — wait for Google crawl sitemap.

---

## Solutions & Options

### Option 1: IndexNow Integration ⭐ RECOMMENDED FOR QUICK WIN
**What:** Notify Bing, Yandex, dan search engines lain via IndexNow API saat artikel publish.

**Implementation:**
1. Daftar di Bing Webmaster Tools, dapat API key
2. Buat service `src/services/indexNowService.ts`:
   ```ts
   export async function notifyIndexNow(urls: string[]) {
     await fetch('https://api.indexnow.org/indexnow', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({
         host: 'arasvara.id',
         key: process.env.INDEXNOW_API_KEY,
         keyLocation: `https://arasvara.id/${process.env.INDEXNOW_API_KEY}.txt`,
         urlList: urls
       })
     });
   }
   ```
3. Taruh key file di `/public/{key}.txt`
4. Call dari `coreWriteArticleService.ts` setelah publish (fire-and-forget)

**Pros:**
- Setup mudah (< 1 jam)
- Free
- Instantly notify search engines
- Support Bing, Yandex, Seznam, Naver
- No rate limit concern untuk portal berita scale

**Cons:**
- **Tidak support Google** (Google tidak adopt IndexNow)
- Hanya benefit untuk non-Google search engines

**Cost:** FREE  
**Effort:** LOW (1-2 jam)  
**Impact for Google:** NONE (tapi boost Bing indexing)

---

### Option 2: Google Indexing API (Web Search) ⭐⭐ HIGH IMPACT
**What:** Direct notify Google via Indexing API untuk instant crawl request.

**Implementation:**
1. Setup Google Cloud project + enable Indexing API
2. Create service account, download JSON key
3. Verify site di Google Search Console, grant permission ke service account
4. Buat service `src/services/googleIndexingService.ts`:
   ```ts
   import { google } from 'googleapis';
   
   const auth = new google.auth.GoogleAuth({
     keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
     scopes: ['https://www.googleapis.com/auth/indexing']
   });
   
   export async function notifyGoogleIndexing(url: string, type: 'URL_UPDATED' | 'URL_DELETED') {
     const indexing = google.indexing({ version: 'v3', auth });
     await indexing.urlNotifications.publish({
       requestBody: { url, type }
     });
   }
   ```
5. Call dari write service setelah publish/update/delete
6. Handle rate limits (200 requests/day default, bisa request increase)

**Pros:**
- **Direct ping ke Google** — artikel masuk crawl queue instantly
- Officially supported Google API
- Dapat priority crawl
- Support update & delete notification

**Cons:**
- **Rate limit:** 200 req/day default (butuh request quota increase untuk portal berita aktif)
- **Setup complexity:** Butuh Google Cloud project, service account, Search Console verification
- **API restrictions:** Originally untuk Job Posting & Live Stream, tapi praktek banyak news sites pakai untuk articles
- **Possible policy risk:** Google bisa restrict access jika abuse (tapi normal news usage should be fine)

**Cost:** FREE (API calls gratis, cuma butuh GCP project)  
**Effort:** MEDIUM (4-6 jam setup + testing + quota request)  
**Impact for Google:** HIGH (instant crawl notification)

**⚠️ Important Notes:**
- Google Indexing API officially untuk JobPosting/BroadcastEvent schema, tapi banyak news sites pakai untuk NewsArticle
- Butuh request quota increase via form — default 200/day tidak cukup untuk portal aktif
- Risk: Google bisa reject quota increase atau restrict access jika detect misuse
- Alternative: Prioritize breaking news only (< 200 articles/day)

---

### Option 3: Google Search Console API (Sitemap Submit) ⭐
**What:** Programmatically submit sitemap ke Google Search Console setelah artikel publish.

**Implementation:**
1. Setup Google Cloud + enable Search Console API
2. Service account setup (sama seperti Indexing API)
3. Buat function:
   ```ts
   import { google } from 'googleapis';
   
   export async function submitSitemap() {
     const searchconsole = google.searchconsole({ version: 'v1', auth });
     await searchconsole.sitemaps.submit({
       siteUrl: 'https://arasvara.id',
       feedpath: 'https://arasvara.id/sitemap-news.xml'
     });
   }
   ```
4. Trigger setelah artikel publish (throttle: max 1x per 5 menit)

**Pros:**
- Official Google API
- No rate limit concern
- Cleaner than manual Search Console submit

**Cons:**
- **Slower than Indexing API** — hanya notify Google bahwa sitemap updated, masih tunggu normal crawl schedule
- Tidak instant crawl
- Masih tergantung sitemap cache (1 jam)

**Cost:** FREE  
**Effort:** MEDIUM (4 jam)  
**Impact:** LOW-MEDIUM (faster than passive, slower than Indexing API)

---

### Option 4: Reduce Sitemap Cache + Aggressive Revalidation ⚠️
**What:** Turunkan sitemap cache dari 1 jam jadi 5-10 menit, tambah time-based ISR revalidate.

**Implementation:**
1. **Sitemap cache:** Ubah `max-age=3600` jadi `max-age=300` (5 menit)
   ```ts
   // src/app/sitemap.xml/route.ts
   headers: {
     'Cache-Control': 'public, max-age=300, s-maxage=300'
   }
   ```
2. **Article page ISR:** Tambah `export const revalidate = 300` di article pages
   ```ts
   // src/app/(public)/[category]/[yyyy]/[mm]/[dd]/[slug]/page.tsx
   export const revalidate = 300; // 5 menit
   ```
3. **Sitemap revalidation:** Call `revalidatePath('/sitemap.xml')` setelah article publish

**Pros:**
- No external dependency
- No API setup
- Artikel baru muncul di sitemap lebih cepat

**Cons:**
- **Tidak instant** — masih tunggu Google crawl sitemap (bisa tetap 12-24 jam)
- **Increased server load** — lebih banyak sitemap regeneration
- **CDN cost** — lebih banyak cache miss
- Tidak boost crawl priority

**Cost:** Increased hosting cost (minor)  
**Effort:** LOW (1 jam)  
**Impact:** LOW (marginal improvement, bukan game changer)

---

### Option 5: RSS Feed + Google PubSubHubbub (WebSub) ⭐⭐
**What:** Tambah RSS feed + notify Google via PubSubHubbub saat artikel baru.

**Implementation:**
1. Buat RSS feed `/rss.xml` atau `/feed.xml`
2. Include `<atom:link rel="hub" href="https://pubsubhubbub.appspot.com"/>` di feed
3. Ping hub setelah artikel publish:
   ```ts
   export async function notifyPubSubHubbub(feedUrl: string) {
     await fetch('https://pubsubhubbub.appspot.com/', {
       method: 'POST',
       headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
       body: new URLSearchParams({
         'hub.mode': 'publish',
         'hub.url': feedUrl
       })
     });
   }
   ```

**Pros:**
- **Google-supported protocol** (used by YouTube, Blogger, WordPress)
- Instant notification
- Also benefits RSS readers & aggregators
- No API key needed
- No rate limits

**Cons:**
- **Uncertain Google crawl impact** — Google might prioritize or might not
- RSS feed perlu maintenance
- Less direct than Indexing API

**Cost:** FREE  
**Effort:** MEDIUM (3-4 jam untuk RSS + WebSub)  
**Impact:** MEDIUM (unclear if Google still prioritizes WebSub for news)

---

### Option 6: Hybrid Strategy (BEST) ⭐⭐⭐
**What:** Kombinasi multiple approaches untuk max coverage.

**Recommended combo:**
1. **IndexNow** (boost Bing) — 1 jam effort
2. **Google Indexing API** (instant Google notification) — 6 jam effort + quota request
3. **Reduce sitemap cache** to 5 min — 1 jam effort
4. **WebSub/PubSubHubbub** (RSS feed) — 4 jam effort

**Total effort:** ~12 jam setup + testing  
**Total cost:** FREE (kecuali increased CDN cost minor)

**Fallback if Indexing API quota rejected:**
- Keep IndexNow + WebSub + aggressive sitemap cache
- Prioritize breaking news manual submission via Search Console

---

## Recommendation Matrix

| Solution | Effort | Cost | Google Impact | Bing Impact | Risk |
|----------|--------|------|---------------|-------------|------|
| IndexNow | LOW | FREE | NONE | HIGH | NONE |
| Google Indexing API | MEDIUM | FREE | HIGH* | NONE | MEDIUM (quota) |
| Search Console API | MEDIUM | FREE | LOW | NONE | NONE |
| Reduce Cache | LOW | Minor | LOW | LOW | NONE |
| WebSub (PubSubHubbub) | MEDIUM | FREE | MEDIUM | LOW | NONE |
| **Hybrid (1+2+5)** | **HIGH** | **FREE** | **HIGH** | **HIGH** | **MEDIUM** |

*Depends on Google approval for quota increase

---

## Implementation Priority

### Phase 1: Quick Wins (Week 1)
1. **IndexNow integration** — 2 jam
2. **Reduce sitemap cache** to 5 min — 1 jam
3. **Add `revalidate` to article pages** — 1 jam

**Result:** Bing indexing instant, Google marginal improvement.

### Phase 2: Google Direct (Week 2)
4. **Setup Google Cloud + Indexing API** — 4 jam
5. **Request quota increase** — submit form + wait (1-2 minggu)
6. **Implement + test** — 2 jam

**Result:** Google instant notification (if quota approved).

### Phase 3: Additional Coverage (Week 3)
7. **Build RSS feed** — 2 jam
8. **WebSub integration** — 2 jam

**Result:** Multi-channel notification, RSS reader coverage.

---

## Technical Debt & Risks

### Current Risks:
1. **No monitoring:** Tidak ada tracking apakah Google actually crawling faster setelah notification
2. **No fallback:** Jika Indexing API fail, tidak ada retry mechanism
3. **Rate limit exposure:** Bisa hit quota jika traffic spike (scheduled publish burst)

### Recommendations:
1. **Add logging:** Track semua indexing API calls (success/fail) ke DB atau log aggregator
2. **Implement queue:** Jangan langsung call external API di request path — pakai job queue (BullMQ atau similar)
3. **Monitor Search Console:** Track "Discovered - currently not indexed" di GSC untuk detect crawl issues
4. **Add circuit breaker:** Jika API fail 3x berturut-turut, stop calling untuk 1 jam

---

## Alternative: Manual Process (If API Rejected)

Jika Google reject Indexing API quota increase:

### Short-term workaround:
1. **Breaking news priority:** Manual submit breaking news URLs via Search Console (max 10/day)
2. **Social signal boost:** Aggressive social media posting (Twitter, Facebook) — Google crawl viral URLs faster
3. **Internal linking:** Link artikel baru dari homepage/high-traffic pages — Google crawl frequently-visited pages faster
4. **External backlinks:** Submit artikel baru ke aggregator sites (Google News, Flipboard) untuk instant backlink

### Medium-term:
- Build reputation dengan Google — consistent quality content + clean site structure + fast Core Web Vitals → earn better crawl budget naturally
- Request Google News Publisher Center inclusion (if not already) — Google News articles get priority crawl

---

## Conclusion

**Root cause:** Fully passive indexing strategy — no active notification to Google.

**Best solution:** Hybrid approach dengan IndexNow (Bing) + Google Indexing API (Google) + WebSub (RSS).

**Realistic expectation:**
- **With Indexing API:** 1-6 jam (dari 24-72 jam) — **80% improvement**
- **Without Indexing API:** 6-12 jam (dari 24-72 jam) — **50% improvement**

**Next step:** Implement Phase 1 (IndexNow + cache optimization) dulu untuk quick win, then Phase 2 (Google Indexing API) untuk max impact.

**Critical note:** Google Indexing API bukan silver bullet — Google masih bisa choose untuk delay indexing based on site authority, content quality, dan crawl budget. API hanya guarantee "notified", bukan "instant indexed".

---

## Implementation Checklist

- [ ] Setup IndexNow (API key + host file)
- [ ] Integrate IndexNow call di article publish flow
- [ ] Reduce sitemap cache to 5 min
- [ ] Add `revalidate = 300` to article pages
- [ ] Setup Google Cloud project
- [ ] Enable Indexing API + create service account
- [ ] Verify domain di Search Console + grant permission
- [ ] Implement Google Indexing service
- [ ] Request quota increase (200 → 2000/day)
- [ ] Integrate Indexing API call di publish flow
- [ ] Build RSS feed (`/rss.xml`)
- [ ] Integrate WebSub ping
- [ ] Add monitoring & logging
- [ ] Test end-to-end flow
- [ ] Monitor Search Console for indexing speed improvement

---

**Prepared by:** Kiro AI  
**Date:** 2026-08-18  
**Status:** Ready for implementation
