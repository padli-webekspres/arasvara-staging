# GA4 Explorations — Arasvara

> Berdasarkan 34 Custom Dimensions + 6 Custom Metrics yang sudah terdaftar.
> Semua exploration dibuat di: GA4 → Explore → + New Exploration.

---

## 1. Funnel Exploration

### 1.1 Corong Loyalitas Artikel
**Tujuan:** Ukur berapa % pembaca yang benar-benar selesai baca, lalu share.

| Step | Event | Kondisi |
|------|-------|---------|
| 1 | `view_article` | — |
| 2 | `article_read_complete` | — |
| 3 | `article_share` | — |

- **Breakdown:** `category_name` → lihat kategori mana yang paling sering ditinggal di tengah
- **Breakdown:** `article_format` → apakah artikel GALLERY lebih sering selesai dibaca daripada STANDARD?
- **Insight:** Jika drop besar di step 1→2: konten terlalu panjang atau tidak menarik. Drop besar di 2→3: pembaca puas tapi tidak mau share.

---

### 1.2 Corong Konversi Iklan (Ad CTR)
**Tujuan:** Hitung click-through rate per posisi iklan.

| Step | Event |
|------|-------|
| 1 | `ad_impression` |
| 2 | `ad_click` |

- **Breakdown:** `ad_position` → sidebar vs horizontal vs carousel
- **Breakdown:** `ad_sponsor` → sponsor mana yang iklannya paling sering diklik
- **Insight:** CTR = event count step 2 / event count step 1. Posisi `article_vertical` biasanya lebih tinggi CTR-nya karena di area baca aktif.

---

### 1.3 Corong Push Notification → Baca Sampai Selesai
**Tujuan:** Ukur kualitas traffic dari push notif.

| Step | Event | Filter |
|------|-------|--------|
| 1 | `push_open` | — |
| 2 | `view_article` | `referrer_type` = `push` |
| 3 | `article_read_complete` | — |

- **Breakdown:** `notification_title` → push mana yang konversinya terbaik
- **Insight:** Push notification yang berhasil = open rate tinggi + completion rate tinggi.

---

### 1.4 Corong Discovery → Baca
**Tujuan:** Seberapa efektif klik dari kartu artikel membawa pembaca benar-benar membaca.

| Step | Event | Kondisi |
|------|-------|---------|
| 1 | `select_content` | — |
| 2 | `view_article` | — |
| 3 | `article_read_complete` | — |

- **Breakdown:** `click_location` → homepage_card vs sidebar vs related vs search_result
- **Insight:** Kartu "related" biasanya memiliki intent lebih tinggi (pembaca sudah engaged).

---

## 2. Free Form Exploration

### 2.1 Performa Konten per Kategori
**Tujuan:** Lihat kategori terbaik secara traffic, engagement, dan virality.

| Dimensi (Baris) | Metrik |
|-----------------|--------|
| `category_name` | Event count `view_article`, Event count `article_read_complete`, Event count `article_share`, Avg `time_on_page_seconds` |

- **Filter:** Periode 30/60/90 hari
- **Insight:** Kategori dengan view tinggi tapi completion rendah → konten perlu diperbaiki. Kategori dengan share tinggi → potensi viral.

---

### 2.2 Performa Penulis (Author Performance)
**Tujuan:** Bandingkan produktivitas dan engagement antar penulis.

| Dimensi (Baris) | Metrik |
|-----------------|--------|
| `author_name` | Event count `view_article`, Event count `article_read_complete`, Avg `time_on_page_seconds`, Avg `word_count`, Event count `article_share` |

- **Filter:** `category_name` tertentu untuk perbandingan apel-ke-apel
- **Insight:** Penulis dengan avg `time_on_page_seconds` tinggi = tulisannya engaging. `word_count` tinggi + completion rendah = terlalu panjang.

---

### 2.3 Heatmap Waktu Rilis Terbaik
**Tujuan:** Temukan kombinasi hari + jam yang paling banyak mendapat pembaca.

| Dimensi (Baris) | Dimensi (Kolom) | Metrik |
|-----------------|-----------------|--------|
| `publish_day_of_week` | `publish_hour` | Event count `view_article` |

- **Insight:** Identifikasi "golden hour" — misalnya Selasa jam 07.00–09.00 WIB secara konsisten paling tinggi viewnya.

---

### 2.4 Analisis Konten Evergreen vs Fresh
**Tujuan:** Apakah artikel lama masih menghasilkan traffic dan engagement?

| Dimensi (Baris) | Metrik |
|-----------------|--------|
| `article_title` | Avg `article_age_days`, Event count `view_article`, Avg `time_on_page_seconds` |

- **Filter:** `article_age_days` > 30 → fokus ke konten evergreen
- **Insight:** Artikel dengan `article_age_days` tinggi tapi view masih tinggi = aset SEO berharga, layak di-update.

---

### 2.5 Analisis Tag Konten
**Tujuan:** Tag mana yang paling banyak diminati pembaca.

| Dimensi (Baris) | Metrik |
|-----------------|--------|
| `tag_1` | Event count `view_article`, Event count `article_read_complete`, Event count `article_share` |

- Ulangi untuk `tag_2`, `tag_3`
- **Insight:** Tag dengan share tinggi tapi view rendah = niche yang loyal. Tag dengan view tinggi tapi completion rendah = clickbait.

---

### 2.6 Distribusi Channel Traffic
**Tujuan:** Traffic dari mana saja, dan channel mana yang paling engaging.

| Dimensi (Baris) | Metrik |
|-----------------|--------|
| `referrer_type` (direct, social, search, push, internal, other) | Event count `view_article`, Avg `time_on_page_seconds`, Event count `article_read_complete` |

- **Insight:** Traffic dari `search` biasanya punya intent lebih tinggi (avg time_on_page lebih lama). Traffic dari `social` biasanya bounce lebih cepat.

---

### 2.7 Performa Iklan per Sponsor
**Tujuan:** Laporan lengkap iklan untuk klien/sponsor.

| Dimensi (Baris) | Metrik |
|-----------------|--------|
| `ad_sponsor` | Event count `ad_impression`, Event count `ad_click` |

- **Kolom tambahan:** `ad_position`, `ad_size`
- **Insight:** CTR per sponsor — bisa jadi bahan laporan ke klien iklan.

---

### 2.8 Konten dengan Format Video vs Non-Video
**Tujuan:** Apakah artikel dengan video membuat pembaca lebih lama?

| Dimensi (Baris) | Metrik |
|-----------------|--------|
| `has_video` (true/false) | Avg `time_on_page_seconds`, Event count `article_read_complete`, Event count `article_share` |

- **Breakdown tambahan:** `has_gallery`
- **Insight:** Jika artikel video secara konsisten punya `time_on_page` lebih tinggi → justifikasi investasi konten video.

---

### 2.9 Analisis Search Internal
**Tujuan:** Apa yang dicari pembaca di site search, dan seberapa relevan hasilnya?

| Dimensi (Baris) | Metrik |
|-----------------|--------|
| `search_term` | Event count `search`, Avg `results_count` |

- **Filter:** `results_count` = 0 → keyword yang tidak menghasilkan artikel = peluang topik baru
- **Insight:** Keyword dengan banyak search tapi `results_count` rendah = gap konten yang harus diisi.

---

### 2.10 Efektivitas Posisi Klik pada Kartu Artikel
**Tujuan:** Posisi ke berapa paling sering diklik di setiap lokasi.

| Dimensi (Baris) | Dimensi (Kolom) | Metrik |
|-----------------|-----------------|--------|
| `click_location` | `position` (1–10) | Event count `select_content` |

- **Insight:** Jika posisi 1–3 jauh lebih tinggi dari posisi 4+, artinya pembaca jarang scroll ke bawah → perlu perbaikan layout atau konten di bawah fold.

---

### 2.11 Artikel Breaking vs Headline — Perbedaan Engagement
**Tujuan:** Apakah label "Breaking" atau "Headline" benar-benar mendongkrak angka?

| Dimensi (Baris) | Metrik |
|-----------------|--------|
| `is_breaking` | Event count `view_article`, Avg `time_on_page_seconds` |
| `is_headline` | Event count `view_article`, Avg `time_on_page_seconds` |

- **Insight:** Jika `is_breaking` = true tidak signifikan berbeda dari false, berarti label breaking kurang efektif menarik pembaca.

---

### 2.12 Segmentasi Logged-in vs Guest
**Tujuan:** Perbedaan perilaku pembaca yang login vs anonim.

| Dimensi (Baris) | Metrik |
|-----------------|--------|
| `user_type` (logged_in / guest) | Event count `view_article`, Avg `time_on_page_seconds`, Event count `article_read_complete`, Event count `article_share` |

- **Insight:** Jika `logged_in` secara konsisten punya engagement lebih tinggi → justifikasi fitur membership/login.

---

## 3. Path Exploration

### 3.1 Jalur Setelah Select Content
**Tujuan:** Ke mana pembaca pergi setelah klik kartu artikel dari lokasi tertentu.

- **Starting point:** Event `select_content`
- **Breakdown:** `click_location`
- **Lihat:** Halaman berikutnya yang dikunjungi

- **Insight:** Apakah setelah klik dari `homepage_headline` pembaca berhenti (1 halaman), atau lanjut ke artikel lain via `related`? Pembaca yang journey-nya panjang = high-value user.

---

### 3.2 Jalur Setelah Push Open
**Tujuan:** Apa yang dilakukan pembaca setelah masuk via push notifikasi.

- **Starting point:** Event `push_open`
- **Breakdown:** `notification_title`
- **Lihat:** Event berikutnya (apakah `article_read_complete`? `select_content`? atau langsung exit?)

- **Insight:** Push yang efektif tidak hanya membuat pembaca membuka artikel, tapi juga membuat mereka menjelajah lebih jauh.

---

### 3.3 Jalur Sebelum Author Profile View
**Tujuan:** Dari mana pembaca menemukan halaman penulis.

- **Starting point:** Event `author_profile_view`
- **Lihat ke belakang:** Halaman apa yang dibuka sebelum ke profil penulis?

- **Insight:** Jika mayoritas datang dari artikel tertentu → penulis tersebut punya fanbase yang aktif mencari konten lebih darinya.

---

### 3.4 Jalur Discovery dari Search ke Baca
**Tujuan:** Apakah pembaca yang masuk dari `search` internal langsung baca atau klik beberapa artikel dulu?

- **Starting point:** Event `search`
- **Lihat:** Event `select_content` → `view_article` → `article_read_complete`

- **Insight:** Jika ada banyak `search` → `select_content` → `select_content` lagi (tanpa `article_read_complete`) → hasil search kurang relevan.

---

## 4. Segment Overlap

### 4.1 Irisan Tipe Pembaca × Channel × Format Konten
**Tujuan:** Siapa pembaca paling loyal dan dari mana mereka datang.

| Segmen | Definisi |
|--------|----------|
| A | `user_type` = `logged_in` |
| B | `referrer_type` = `social` ATAU `push` |
| C | `has_video` = `true` |

- **Insight:** Irisan A∩B∩C = pembaca terdaftar yang datang dari social/push dan suka konten video → target untuk strategi push notif konten video premium.

---

### 4.2 Irisan Pembaca Aktif × Kategori × Share
**Tujuan:** Siapa yang paling sering share konten dari kategori tertentu.

| Segmen | Definisi |
|--------|----------|
| A | Melakukan `article_read_complete` |
| B | Melakukan `article_share` |
| C | `category_name` = [kategori pilihan] |

- **Insight:** Irisan A∩B∩C = target ideal untuk loyalty program atau newsletter.

---

### 4.3 Irisan Efektivitas Iklan × Tipe User
**Tujuan:** User mana yang paling sering klik iklan.

| Segmen | Definisi |
|--------|----------|
| A | Melakukan `ad_click` |
| B | `user_type` = `logged_in` |
| C | `referrer_type` = `search` |

- **Insight:** Jika A∩C besar tapi A∩B kecil → user anonym dari Google Search lebih sering klik iklan dibanding user terdaftar.

---

## 5. User Lifetime / Cohort Exploration

### 5.1 Retensi Berdasarkan Tipe User
**Tujuan:** Apakah user yang login lebih loyal dalam jangka panjang?

- **User segment:** `user_type` = `logged_in` vs `guest`
- **Metric:** Retention rate per minggu (berapa % kembali 7 hari setelah first visit)

- **Insight:** Jika user `logged_in` retensinya jauh lebih tinggi → bukti kuat untuk investasi fitur membership.

---

### 5.2 Cohort Pembaca Push Notification
**Tujuan:** Apakah subscriber push notif lebih setia dari pembaca biasa?

- **User segment:** User yang pernah melakukan `push_open`
- **Metric:** Event count `view_article` per minggu selama 4 minggu ke depan

- **Insight:** Jika cohort push_open memiliki weekly active rate tinggi → push notif efektif membangun habitual reader.

---

## Prioritas Exploration yang Disarankan

| Prioritas | Exploration | Alasan |
|-----------|-------------|--------|
| 🔴 Tinggi | 2.1 Performa Konten per Kategori | Paling langsung berguna untuk editorial decision |
| 🔴 Tinggi | 1.1 Corong Loyalitas Artikel | Ukur kesehatan konten secara keseluruhan |
| 🔴 Tinggi | 2.3 Heatmap Waktu Rilis | Actionable: mengubah jadwal rilis langsung impactful |
| 🔴 Tinggi | 1.2 Corong Konversi Iklan | Langsung berdampak pada revenue iklan |
| 🟡 Sedang | 2.2 Performa Penulis | Berguna untuk review tim konten |
| 🟡 Sedang | 2.9 Analisis Search Internal | Identifikasi gap konten |
| 🟡 Sedang | 3.1 Jalur Setelah Select Content | Optimasi UX layout kartu |
| 🟢 Rendah | 4.x Segment Overlap | Berguna saat data sudah banyak (>30 hari) |
| 🟢 Rendah | 5.x User Lifetime | Perlu data minimal 4–8 minggu untuk bermakna |
