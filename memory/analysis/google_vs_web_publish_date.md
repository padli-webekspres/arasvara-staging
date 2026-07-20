# Analisis: Selisih Waktu Publish di Web vs Google Search

**Tanggal analisis:** 20 Juli 2026  
**Contoh URL:** [Makna Lirik lagu "Langit Abu-Abu" Karya Tulus](https://arasvara.id/entertainment/2026/07/19/makna-lirik-lagu-langit-abu-abu-karya-tulus)  
**Keluhan:** Di web relatif tampak lebih baru (mis. “10 jam lalu” / “4 jam lalu”), di Google Search relatif lebih lama (“1 day ago” / “19 hours ago”).

---

## 1. Ringkasan verdict

Ini **bukan bug Google semata**. Di Arasvara ada kombinasi:

1. **Label waktu absolut di halaman artikel menyesatkan** (`HH:mm` + teks `" WIB"` tanpa konversi ke `Asia/Jakarta` saat SSR di UTC).
2. **Metadata mesin (ISO `…Z`) dan umur relatif absolut** mengikuti timestamp UTC yang tersimpan — relatif di kartu/list bisa “benar” secara clock, sementara label jam “WIB” di detail bisa “salah”.
3. **Google Search** memilih tanggal dari beberapa sinyal (JSON-LD / Open Graph / URL / crawl cache) lalu menampilkan relatif dengan aturan rounding sendiri — sering tampak “lebih tua” dari label relatif di situs.

Untuk artikel contoh di atas (dicek ~09:25 WIB, 20 Jul 2026):

| Sumber | Nilai |
|--------|--------|
| `publishedAt` di data / meta | `2026-07-19T15:35:26.315Z` |
| Label di HTML (SSR) | **19 Juli 2026 · 15:35 WIB** |
| Umur absolut dari timestamp `Z` | **~10,8 jam** → cocok dengan “~10 jam lalu” |
| Jika 15:35 dimaksudkan sebagai WIB (= `08:35Z`) | umur **~17,8 jam** → mendekati “19 hours ago” / “1 day ago” |
| Path URL | `/entertainment/2026/07/19/...` (hari kalender 19 Jul) |

---

## 2. Bukti dari halaman production

Dari HTML live:

```html
<meta property="article:published_time" content="2026-07-19T15:35:26.315Z"/>
```

JSON-LD `NewsArticle` (ada **dua** blok identik di halaman):

```json
"datePublished": "2026-07-19T15:35:26.315Z",
"dateModified": "2026-07-19T15:35:26.315Z"
```

Payload artikel:

- `publishedAt`: `2026-07-19T15:35:26.315Z`
- `createdAt`: `2026-07-19T15:12:34.570Z` (lebih awal ~23 menit)
- `updatedAt`: sama dengan `publishedAt`

Tampilan visible: **15:35 WIB** — padahal `15:35Z` secara benar di WIB adalah **22:35 WIB**.

---

## 3. Akar masalah di kode Arasvara (prioritas tinggi)

### 3.1 `formatTimeReadable` menempelkan “WIB” tanpa set zone Jakarta

File: [`src/lib/utils.ts`](../../src/lib/utils.ts)

```ts
export function formatTimeReadable(dateValue: string | Date, locale = "id-ID") {
  const dt =
    typeof dateValue === "string"
      ? DateTime.fromISO(dateValue)
      : DateTime.fromJSDate(dateValue);
  return dt.setLocale(locale).toFormat("HH:mm") + " WIB";
}
```

- Tidak ada `.setZone("Asia/Jakarta")`.
- Di **server production (Railway biasanya UTC)**, jam yang diformat = jam UTC, lalu ditambah label `" WIB"` → **salah**.
- Di browser lokal Indonesia (UTC+7), Luxon sering pakai zona lokal → angka jam bisa beda dari SSR (hydration mismatch potensial).

Dipakai di [`ArticleUi`](../../src/components/news/ArticleUi.tsx) via props dari [`NewsDetailClient`](../../src/components/news/NewsDetailClient.tsx).

`formatDateReadable` / `formatDateTimeReadable` juga tidak memaksa `Asia/Jakarta` (mengandalkan zone default runtime).

### 3.2 Relatif di kartu memakai absolut ms (benar clock-wise)

File: [`src/lib/format-published-at.ts`](../../src/lib/format-published-at.ts)

`formatPublishedAtForUi` memakai `Date.getTime()` → selisih absolut dari ISO `…Z`.  
Jadi di list/kartu user bisa melihat **“10 jam lalu”** yang konsisten dengan `15:35Z`, sementara detail menampilkan **“15:35 WIB”** yang menyesatkan.

Ini menjelaskan pola: **web “terasa lebih baru”** dibanding interpretasi “jam dinding WIB yang tertulis”.

### 3.3 Metadata untuk crawler

[`buildMetadataFromArticle`](../../src/lib/server/article-detail-page.ts) mengirim:

```ts
publishedTime: new Date(article.publishedAt || article.createdAt).toISOString()
```

→ `article:published_time` = timestamp UTC dengan suffix `Z` (benar sebagai instant, asalkan `publishedAt` di DB memang UTC yang dimaksud).

JSON-LD di `NewsDetailClient` + lagi di `ArticleUi` menduplikasi `datePublished` / `dateModified`. Duplikat biasanya tidak mengubah tanggal, tapi menambah noise untuk crawler.

### 3.4 Path structured URL pakai tanggal WIB

Public path `/entertainment/2026/07/19/...` dibangun dari bagian tanggal **WIB** (`publishedAtToWibDateParts`).  
Google sering memakai **tanggal di URL** sebagai sinyal “hari artikel”. Pada 20 Jul, URL bertanggal **19 Jul** mudah dibulatkan menjadi **“1 day ago”**, terlepas dari jam di meta.

---

## 4. Kemungkinan penyebab di sisi Google (prioritas sedang–tinggi)

Google **tidak menjamin** relatif waktu di SERP = `now - datePublished` di situs. Sinyal yang umum:

### 4.1 Rounding / granularitas tampilan SERP

- Di bawah ~24 jam kadang tetap ditampilkan **“X hours ago”**.
- Mendekati batas hari atau lintas zona, sering naik ke **“1 day ago”**.
- Rounding tidak selalu floor jam yang sama dengan `Math.floor` di `formatPublishedAtForUi`.

### 4.2 Cache indeks / waktu crawl

- Relatif di SERP dihitung dari **waktu Google terakhir mengaitkan tanggal ke dokumen**, bukan dari jam user membuka hasil.
- Jika crawler pertama kali melihat halaman lebih awal (atau menyimpan tanggal lain), label bisa “lebih tua” dari yang user hitung sekarang di web.

### 4.3 Multi-sinyal tanggal (bukan hanya JSON-LD)

Google bisa mempertimbangkan:

| Sinyal | Di Arasvara / contoh artikel |
|--------|------------------------------|
| `datePublished` JSON-LD | `…T15:35:26.315Z` |
| `article:published_time` | sama |
| `dateModified` | sama dengan publish (tidak ada sinyal “update baru”) |
| Tanggal di URL | `2026/07/19` |
| Teks visible | “19 Juli 2026”, “15:35 WIB” |
| Sitemap `news:publication_date` / `lastmod` | jika berbeda, bisa mempengaruhi |
| `createdAt` di payload (tidak selalu di meta) | 15:12Z — lebih tua dari publish |

Jika Google lebih percaya **hari kalender URL/teks** daripada jam ISO, hasilnya cenderung **“1 day ago”** pada hari berikutnya.

### 4.4 Zona waktu & parsing ambigu

- ISO dengan `Z` = UTC — benar untuk mesin.
- Teks visible **“15:35 WIB”** yang tidak selaras dengan instant UTC bisa membuat sistem lain “menebak ulang” waktu lokal.
- Selisih ~7 jam (WIB vs penyimpanan UTC-as-wall-clock) sering muncul di kasus “web X jam, Google X+7 (± rounding) jam”. Kasus “4 jam vs 19 jam” (~15 jam) bisa campuran **offset + cache + rounding**, bukan satu faktor tunggal.

### 4.5 Discover / Top Stories vs organic biasa

Di beberapa permukaan Google, tanggal diganti dengan **waktu indeksasi** atau aturan freshness berbeda dari organic blue link.

### 4.6 Republish / soft update tanpa `dateModified` baru

Jika artikel diedit tapi `dateModified` tetap = `publishedAt`, Google tidak melihat “update baru”. Sebaliknya jika pernah crawl versi lama, tanggal lama bisa tertahan sampai re-crawl.

---

## 5. Rekonstruksi skenario contoh

### Artikel “Langit Abu-Abu”

```text
DB/meta:  2026-07-19T15:35:26.315Z
SSR UI:   15:35 WIB          ← label salah jika server UTC
Absolut:  ~10–11 jam (pagi 20 Jul)  ← “10 jam lalu” di relatif UI
Google:   “1 day ago”        ← sangat masuk akal dari URL/hari 19 Jul + rounding SERP
           atau ~18 jam jika mereka menganggap 15:35 sebagai WIB sejati
```

### Pola “4 jam lalu (web) vs 19 jam lalu (Google)”

Kemungkinan paling masuk akal (bisa bersamaan):

1. Relatif web dari ISO `Z` (absolut) = 4 jam.
2. Google memakai sinyal hari/URL/cache yang menggeser “usia” ke ~19 jam, **atau** menginterpretasikan jam dinding WIB yang tertulis di halaman sebagai waktu lokal yang berbeda dari `Z`.
3. Selisih besar hampir selalu melibatkan **timezone labeling bug** + **kebijakan tampilan Google**, bukan sekadar `createdAt` vs `publishedAt` (di contoh ini `createdAt` hanya ~23 menit lebih tua).

---

## 6. Ranking kemungkinan (untuk Arasvara)

| # | Penyebab | Likely? | Dampak |
|---|----------|---------|--------|
| 1 | Label `WIB` tanpa `setZone("Asia/Jakarta")` di SSR UTC | **Sangat tinggi** | User & crawler melihat jam lokal yang salah |
| 2 | Google memakai tanggal URL / hari kalender → “1 day ago” | **Tinggi** | Selisih vs “X jam lalu” di web |
| 3 | Rounding & cache relatif SERP Google | **Tinggi** | “19 hours” vs “4 hours” / “1 day” |
| 4 | `datePublished` ISO `Z` vs persepsi “jam publish redaksi WIB” | **Tinggi** | Bingung operasional; Google ikut ISO |
| 5 | Duplikat JSON-LD | Rendah–sedang | Noise; jarang penyebab utama selisih jam |
| 6 | `dateModified` = `publishedAt` | Sedang | Tidak membantu sinyal “baru diupdate” |
| 7 | Sitemap / Indexing API delay | Sedang | Tanggal di indeks tertinggal |
| 8 | `createdAt` dipakai Google | Rendah di contoh ini | Hanya beda ~23 menit |

---

## 7. Rekomendasi perbaikan (produk/teknis)

### Wajib (koreksi kebenaran waktu)

1. **Samakan semua format tampilan ke `Asia/Jakarta`:**
   - `formatTimeReadable`, `formatDateReadable`, `formatDateTimeReadable` → `.setZone("Asia/Jakarta")` (atau `fromISO(..., { zone: "utc" }).setZone("Asia/Jakarta")`).
2. Pastikan **penyimpanan `publishedAt` selalu instant UTC yang benar** saat publish sekarang (`new Date()`) maupun schedule/backdate dari `datetime-local` (konversi eksplisit dari WIB → UTC, jangan treat wall-clock sebagai `Z`).
3. Audit admin `datetime-local` + `toJakartaDatetimeLocal` end-to-end agar nilai yang disimpan = niat redaksi.

### SEO / crawler

4. Satu blok JSON-LD `NewsArticle` saja (hindari duplikat `NewsDetailClient` + `ArticleUi`).
5. Pastikan `datePublished` / `article:published_time` / visible WIB **menggambarkan instant yang sama**.
6. Update `dateModified` saat ada edit substantif.
7. Setelah fix: **URL Inspection → Request indexing** untuk sampel artikel; bandingkan tanggal di Rich Results / crawled HTML.

### Ekspektasi bisnis

8. Edukasi tim: **Google tidak wajib menampilkan “X jam lalu” sama dengan situs**. Target yang realistis: metadata & visible time **konsisten dan benar zona**; relatif SERP boleh tetap berbeda sedikit karena cache/rounding.

---

## 8. Cara verifikasi cepat (opsional)

```bash
# Ambil meta publish
curl -sL 'https://arasvara.id/entertainment/2026/07/19/makna-lirik-lagu-langit-abu-abu-karya-tulus' \
  | grep -o 'article:published_time" content="[^"]*"'

# Bandingkan:
# - Instant ISO (Z)
# - Jam jika dikonversi ke Asia/Jakarta
# - Umur absolut vs label di UI
```

Di Google Search Console: Inspection URL → lihat tanggal yang Google ekstrak vs HTML yang di-crawl.

---

## 9. Kesimpulan

Selisih “web lebih baru / Google lebih lama” pada kasus Arasvara paling kuat dijelaskan oleh:

1. **Bug presentasi timezone** (`… WIB` tanpa konversi di lingkungan UTC) + relatif UI yang memakai absolut UTC; dan  
2. **Perilaku Google** (hari di URL, rounding, cache indeks) yang tidak mirror 1:1 ke `formatPublishedAtForUi`.

Memperbaiki (1) adalah langkah pertama yang paling berdampak; (2) tidak bisa “dipaksa” sempurna, hanya diminimalkan dengan metadata yang bersih dan konsisten.
