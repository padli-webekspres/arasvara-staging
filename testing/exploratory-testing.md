# Exploratory Testing Arasvara in Local
Wajib cantumkan url, replikasi, revice dan data pendukung lain

## Temuan client side
### root page
1. UI: 
button arrow pada setiap carousel belum konsisten. ada yang rounded ada yang bulat. button nya pada mobile masih terlalu besar, resize lagi
2. Perlu cek pada carousel sosial media update di ios apakah aman
3. pada mobile di bagian yang style-z, card pada mobile nya samakan semua kecuali yang paling pertama
4. pada card arah lensa, teks terlalu besar di mobile
5. logo pada navbar di mobile terllau besar. perkecil sedikit
6. navbar pada mobile susah di interaksi
7. ketika di selection masih default warna biru, harusnya warna brand nya

### indeks
1. date picker masih ada warna biru, ganti jadi hijau

### single article
1. pada mobile, gap atas nya terlalu jauh
2. tombol connect wa dan telegram di mobile dibuat stack saja
4. tanggal dan jam jadi kebawah dan ga rapih di mobile

### search
1. pad amobile, filter kurang terlihat. kurang konsisten juga dengan indeks
2. masih ada testing artikel yang belum dihapus
3. masih kurang nyaman digunakan di mobile app

### channel
1. masih ada grid yang kosong, di initial fetch

### penulis
1. gap ke atas nya di mobile masih terlalu jauh. perlu improvement

## temuan admin

### dashboard
1. toast deskripsi nya kurang terlihat
2. jika didiamkan lama, malah jadi 403 padahal harusnya refresh jwt atau logout
3. ai slop banget

### users
1. masih ada team. harusnya tim dihapus saja
2. role warna nya masih terlalu kontras. sesuaikan dengan guideline. status nya juga

### configuration
1. layoutnya masih berantakan
2. button tentang kami harusnya buka tab baru