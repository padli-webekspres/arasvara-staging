*POIN PERBAIKAN IN-SCOPE*

*A. PERFORMA & INFRASTRUKTUR*

*1. JavaScript terlalu banyak (53 scripts)*
Terkait: Sistem Web Aplikasi Hal 4 Poin 2 (Cache gambar, CSS, JS, file statis)

*2. Network payload 2,63 MB (target: 1-1,5 MB)*
Terkait: 
- Sistem Web Aplikasi Hal 4 Poin 2 (Integrasi CDN, image optimizer, caching)
- Sistem Web Aplikasi Hal 5 Modul 5 (Upload gambar auto resize & compress max 1 MB)
- Kebutuhan User Hal 2 (Mobile Friendly, Upload foto Auto size 1200×800 Max 1 MB)

*3. Render-blocking (3 resources)*
Terkait: Sistem Web Aplikasi Hal 4 Poin 2 (Cache untuk Google Lighthouse > 95)

*4. Server response 546 ms (target: <300 ms)*
Terkait:
- Sistem Web Aplikasi Hal 4 Poin 2 (Next.js SSR/SSG, CDN)
- Sistem Web Aplikasi Hal 5 Modul 5 (Pre-signed URL Object Storage)

*5. Cache belum optimal*
Terkait: Sistem Web Aplikasi Hal 4 Poin 2 (Integrasi CDN, image optimizer, caching)


*B. TECHNICAL SEO*

*6. Canonical mismatch (PRIORITAS TINGGI)*
Terkait:
- Sistem Web Aplikasi Hal 6 Modul 8 (Meta tag & sitemap otomatis)
- Kebutuhan User Hal 3 (Situs website mudah terindeks Google)

*7. 8 gambar tanpa ALT*
Terkait: Sistem Web Aplikasi Hal 6 Modul 8 (Meta tag & sitemap otomatis untuk SEO)

*8. 10 gambar tanpa width/height*
Terkait:
- Sistem Web Aplikasi Hal 5 Modul 5 (Upload gambar auto resize 1200×800 px)
- Kebutuhan User Hal 2 (Upload foto Auto size 1200×800 Megapixel)

*9. Error 503 di media.arasvara.id / configuration.arasvara.id*
Terkait:
- Sistem Web Aplikasi Hal 4 Poin 2 (Integrasi Object Storage dan subdomain)
- Sistem Web Aplikasi Hal 5 Modul 5 (Integrasi Object Storage Cloud)

*10. Heading structure: H3 missing*
Terkait: Sistem Web Aplikasi Hal 4 Poin 1 (Wireframe halaman utama, artikel, dashboard, CMS)

*11. NewsArticle schema belum lengkap/optimal*
Terkait: Sistem Web Aplikasi Hal 6 Modul 8 (Artikel terindeks optimal di mesin pencari)


*C. CMS & SECURITY*

*12. Kurangi akun Super Admin*
Terkait:
- Sistem Web Aplikasi Hal 5 Modul 4 (Pembatasan hak akses per level role)
- Kebutuhan User Hal 3 (CMS kategori Admin IT, Editor, Reporter + pembatasan level)

*13. Aria-label button ikon di header*
Terkait: Sistem Web Aplikasi Hal 4 Poin 1 (Tata letak dan elemen branding)

*14. Responsivitas tabel di mobile*
Terkait:
- Sistem Web Aplikasi Hal 6 Modul 6 (Tampilan cepat, ringan, responsif)
- Kebutuhan User Hal 2 (Mobile Friendly)

*15. Character counter di meta description field*
Terkait:
- Sistem Web Aplikasi Hal 5 Modul 2 (CRUD berita, preview, auto-save)
- Sistem Web Aplikasi Hal 6 Modul 8 (SEO & Analitik)
- Kebutuhan User Hal 2 (CMS Simple dan modern)


*D. UI/UX (MINOR)*

*16. Kontras warna link footer rendah*
Terkait: Sistem Web Aplikasi Hal 4 Poin 1 (Penyesuaian warna, tata letak, font, branding)

*17. Tombol pencarian mengambang menutupi konten mobile*
Terkait:
- Sistem Web Aplikasi Hal 4 Poin 1 (Rancangan visual & navigasi)
- Sistem Web Aplikasi Hal 6 Modul 6 (Mobile friendly/responsif)
- Kebutuhan User Hal 2 (Mobile Friendly)

*18. Heading kategori: pisahkan ikon panah dari teks*
Terkait: Sistem Web Aplikasi Hal 4 Poin 1 (Wireframe dan prototipe interaktif di Figma)


*E. MONITORING & INVESTIGATION (PARTIAL)*

*19. Backlink domain tidak dikenal*
Developer scope:
- Setup monitoring/audit tool untuk track backlink profile
- Generate disavow file jika dibutuhkan
Tim Arasvara scope:
- Review backlink list dan tentukan mana yang spam/suspicious
- Submit disavow list ke Google Search Console

*20. Indexing Google lambat*
Developer scope:
- Verify sitemap submission & robots.txt
- Check crawl budget issues (server response, redirect chains)
- Implement Google Indexing API jika diperlukan
- Fix technical SEO barriers (canonical, speed, mobile-friendly)
Tim Arasvara scope:
- Strengthen internal linking antar artikel
- Improve content quality & E-E-A-T signals
- Add primary source outbound links
- Regular content publishing schedule

---

TOTAL IN-SCOPE: 20 poin (18 full developer + 2 partial)

---

*OUT OF SCOPE (Perlu Klarifikasi Client)*

21. *Pagination multi-halaman artikel*
    - Permintaan client untuk otomatis, tidak diubah

22. *2FA*
    - Tidak ada pembahasan kontrak

23. *Revisi UI major lebih dari 1x*
    - Jika perlu re-layout author page/about us, cuma 1 kali, no major revision lagi

---

*TIM ARASVARA (Content & Editorial)*

24. *Internal linking lemah (14 links)*
    - Editor wajib tambahkan internal link relevan antar artikel
    - Contoh: artikel harga emas → link ke artikel emas hari sebelumnya, cara beli emas, investasi pemula

25. *0 external links (MERAH)*
    - Wajib link ke sumber primer: Antam, BI, BPS, kementerian, perusahaan, dokumen resmi
    - Jangan cuma tulis ulang media lain

26. *Homepage text 224 kata (kuning)*
    - Tambah deskripsi konten/intro jika perlu

27. *E-E-A-T belum kuat*
    - Buat halaman author per penulis
    - Format: Nama, jabatan, bio singkat, link "Lihat semua artikel [Nama]"
    - Contoh: "Nurul Kharimah adalah reporter Arasvara yang meliput lifestyle, entertainment dan isu generasi muda"

28. *Author markup di artikel*
    - Hubungkan penulis artikel dengan URL halaman profil mereka

29. *Typo di judul artikel yang sudah tayang*
    - QC editorial sebelum publish

30. *NAP (Name, Address, Phone) tidak ditemukan di page biasa*
    - Cantumkan di footer/contact selain About Us
