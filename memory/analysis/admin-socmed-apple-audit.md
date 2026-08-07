# Audit Halaman Socmed Admin untuk iPhone, iPad, dan macOS

Tanggal audit: 2026-07-28

## Ringkasan

Halaman yang diaudit:
- `src/app/admin-xyz/articles/socmed/page.tsx`
- `src/components/admin/articles/VideoSocmedForm.tsx`
- `src/components/admin/articles/VideoFormCard.tsx`
- `src/components/media/CropImageModal.tsx`
- `src/lib/image/getCroppedImg.ts`
- `src/services/article/articleSection/socmed/videoSocmedService.ts`

Kesimpulan singkat:
- Halaman socmed admin sudah punya mitigasi penting untuk Safari/iOS pada proses crop dan ekspor gambar, terutama retry preview image dan fallback JPEG saat browser tidak mendukung WebP canvas.
- Risiko terbesar saat dipakai di iPhone, iPad, dan macOS bukan pada upload ke backend, tetapi pada pengalaman edit berkepanjangan di browser: kebocoran object URL, gesture drag-sort di layar sentuh, dan nested scroll pada layout admin.
- Tidak ditemukan indikasi bug fatal yang pasti membuat halaman selalu gagal di Apple device, tetapi ada beberapa titik yang sangat mungkin menimbulkan error intermiten, UI terasa berat, atau aksi sulit dipakai di Safari.

## Temuan

### 1. Tinggi: cleanup object URL di `VideoSocmedForm` berisiko tidak jalan untuk state terbaru

Lokasi:
- `src/components/admin/articles/VideoSocmedForm.tsx`

Masalah:
- Effect cleanup unmount memakai dependency array kosong, tetapi di dalamnya membaca `thumbnailPreview`, `rawImageSrc`, dan `videoItems`.
- Karena closure hanya menangkap nilai render pertama, object URL yang dibuat setelah user menambah, edit, atau load thumbnail dari IndexedDB bisa tidak ikut dibersihkan saat komponen unmount.

Dampak di Apple device:
- Safari iPhone/iPad lebih sensitif terhadap memory pressure dari gambar blob dan preview URL.
- Dalam sesi edit yang lama, terutama saat user sering ganti thumbnail dan buka crop modal berkali-kali, halaman bisa terasa makin berat, preview lebih mudah gagal decode, atau tab direload oleh browser.

Indikasi kode:
- Cleanup unmount ada, tetapi tidak mengikuti perubahan state terbaru.
- Komponen ini sering membuat `URL.createObjectURL(...)` dari upload, hasil crop, dan restore dari IndexedDB.

Saran:
- Simpan daftar blob URL aktif di `useRef<Set<string>>` lalu revoke secara terpusat.
- Atau ubah cleanup effect agar mengikuti state terbaru dan revoke object URL lama segera saat state diganti, bukan hanya saat unmount.

### 2. Tinggi: drag-sort kemungkinan bentrok dengan gesture scroll di iPhone/iPad

Lokasi:
- `src/components/admin/articles/VideoSocmedForm.tsx`
- `src/components/admin/articles/VideoFormCard.tsx`

Masalah:
- Sorting memakai `DragDropProvider` dan `useSortable`, tetapi tidak ada konfigurasi khusus untuk touch behavior, activation constraint, atau guard terhadap scroll gesture.
- Drag handle sangat kecil dan ditempatkan di sudut kartu.

Dampak di Apple device:
- Di iPhone dan iPad, gesture sentuh vertikal sangat mudah dianggap scroll, bukan drag.
- User bisa kesulitan mengurutkan kartu portrait karena area handle kecil dan berdekatan dengan konten yang juga bisa ikut scroll.
- Pada iPad Safari, hasilnya sering terasa "kadang bisa, kadang tidak", terutama saat daftar video panjang.

Kenapa ini penting:
- Halaman socmed sangat bergantung pada reordering manual.
- Kalau drag tidak reliabel di touch device, fungsi inti halaman jadi turun kualitasnya walau desktop masih terasa baik.

Saran:
- Tambahkan activation constraint untuk touch/pointer.
- Pertimbangkan handle yang lebih besar atau mode reorder alternatif untuk touch, misalnya tombol naik/turun.
- Tambahkan `touch-action` yang sesuai pada drag handle agar konflik scroll lebih terkendali.

### 3. Sedang: nested scroll pada layout besar berpotensi mengganggu Safari iPad/macOS

Lokasi:
- `src/components/admin/articles/VideoSocmedForm.tsx`

Masalah:
- Di breakpoint besar, kiri dan kanan sama-sama menjadi panel scrollable (`overflow-y-auto`) di dalam layout yang juga memiliki batas tinggi (`lg:max-h-screen`).

Dampak di Apple device:
- Safari iPad dan macOS sering kurang nyaman dengan nested scroll area, terutama saat keyboard muncul, trackpad gesture aktif, atau user memakai Magic Keyboard.
- Risiko UX:
  - scroll terasa "tertahan"
  - user mengira daftar tidak bisa digeser
  - tombol aksi atau field form terasa hilang dari viewport saat keyboard on-screen muncul

Catatan:
- Ini bukan bug logika, tetapi bug pengalaman pakai yang sering muncul hanya di device Apple/tablet.

Saran:
- Uji khusus iPad portrait/landscape.
- Pertimbangkan mengurangi jumlah panel scroll internal, atau gunakan tinggi yang lebih fleksibel daripada `max-h-screen` pada layout admin ini.

### 4. Sedang: load awal dari backend + draft lokal bisa membuat state thumbnail campuran lebih sulit diprediksi

Lokasi:
- `src/components/admin/articles/VideoSocmedForm.tsx`
- `src/app/admin-xyz/articles/socmed/page.tsx`

Masalah:
- Komponen memprioritaskan `existingItems` dari backend jika ada isi.
- Jika backend kosong, komponen fallback ke localStorage + IndexedDB draft.
- Pendekatan ini valid, tetapi untuk Safari/iOS yang sering lebih agresif membersihkan storage browser, perilakunya bisa terasa tidak konsisten antar sesi.

Dampak di Apple device:
- User bisa melihat draft lokal hilang setelah browser membersihkan storage.
- Thumbnail draft dari IndexedDB bisa tidak tersedia walau metadata video masih ada di localStorage.
- Efeknya bukan crash, tetapi form terasa "kadang data balik, kadang tidak".

Saran:
- Saat restore draft, tampilkan indikator yang jelas bahwa data berasal dari draft lokal.
- Tambahkan recovery message jika blob thumbnail tidak lagi ada di IndexedDB.

### 5. Sedang: remove/edit thumbnail masih mengandalkan revoke yang tidak membedakan blob URL dan URL server pada beberapa path

Lokasi:
- `src/components/admin/articles/VideoSocmedForm.tsx`

Masalah:
- Sebagian path sudah memeriksa `startsWith("blob:")`, tetapi ada juga revoke yang dipanggil langsung jika `thumbnail_url` ada.
- Biasanya tidak fatal, tetapi ini membuat lifecycle preview lebih rapuh dan lebih sulit dipastikan aman.

Dampak di Apple device:
- Safari sering lebih sensitif terhadap operasi media yang berulang.
- Jika lifecycle preview tidak konsisten, bug akan muncul sebagai masalah intermittent yang sulit direproduksi.

Saran:
- Standarkan: hanya revoke URL yang memang `blob:`.
- Pisahkan jelas antara preview lokal dan URL server permanen.

### 6. Rendah: crop modal sudah cukup aman untuk iOS, tetapi masih bergantung pada canvas memory

Lokasi:
- `src/components/media/CropImageModal.tsx`
- `src/lib/image/getCroppedImg.ts`

Hal positif:
- Sudah ada retry preview image.
- Sudah ada fallback saat proses crop gagal.
- Sudah ada deteksi format melalui utilitas image pipeline di codebase.

Risiko sisa:
- Untuk gambar kamera iPhone yang sangat besar, proses crop tetap memakai canvas di browser.
- Di perangkat lama atau RAM rendah, Safari tetap bisa gagal atau lambat walau sudah ada retry.

Saran:
- Batasi ukuran file sebelum crop untuk alur socmed.
- Tambahkan pesan khusus jika file terlalu besar untuk diproses stabil di mobile Safari.

## Bagian yang sudah relatif aman

- Upload thumbnail ke backend tidak bergantung pada fitur browser yang eksotis.
- Proses simpan akhir memakai `FormData` dan route API biasa, yang umumnya aman di Safari modern.
- Komponen crop sudah lebih matang dibanding pola upload gambar biasa karena punya retry dan handling error.
- Untuk combined mode TikTok/Instagram, pemetaan platform upload thumbnail sudah benar dan cukup jelas.

## Prioritas perbaikan yang disarankan

1. Rapikan lifecycle `URL.createObjectURL` dan `URL.revokeObjectURL` di `VideoSocmedForm`.
2. Perbaiki UX drag-sort untuk touch device, terutama iPhone dan iPad.
3. Audit ulang nested scroll pada layout admin socmed untuk iPad landscape dan macOS Safari.
4. Tambahkan fallback UX saat draft lokal atau blob thumbnail hilang dari storage browser.

## Skenario uji manual yang disarankan

### iPhone Safari
- Tambah 5-10 video sambil beberapa kali ganti thumbnail.
- Buka crop modal berulang dengan file kamera ukuran besar.
- Coba drag urutan kartu saat halaman bisa discroll.
- Simpan, refresh, lalu cek apakah draft lokal dan thumbnail tetap konsisten.

### iPad Safari
- Uji portrait dan landscape.
- Coba scroll panel kiri dan kanan bergantian.
- Coba drag-sort dengan jari dan trackpad.
- Cek apakah tombol `Simpan Perubahan` selalu mudah diakses.

### macOS Safari
- Uji drag-sort memakai trackpad.
- Cek nested scroll saat daftar video panjang.
- Cek performa setelah edit thumbnail berulang dalam satu sesi.

## Putusan audit

Status keseluruhan: cukup layak dipakai, tetapi belum sepenuhnya aman untuk pengalaman Apple device yang stabil pada sesi edit panjang.

Fokus risiko terbesar:
- memory/object URL handling
- drag-sort touch behavior
- nested scroll pada layout admin
