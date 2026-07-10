import React from "react";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pedoman Pemberitaan Media Siber",
  description:
    "Pedoman Pemberitaan Media Siber yang dipatuhi oleh redaksi Arasvara sesuai dengan ketentuan Dewan Pers.",
};

export default function PedomanMediaSiberPage() {
  return (
    <main className="min-h-screen bg-background py-24 lg:py-32">
      <div className="container mx-auto max-w-4xl w-full min-w-0 px-4 md:px-6 lg:px-8">
        <div className="mb-10 border-b border-border pb-6">
          <h1 className="mb-4 text-3xl font-bold tracking-tight text-foreground md:text-4xl lg:text-5xl">
            Pedoman Pemberitaan Media Siber
          </h1>
        </div>

        <article className="prose prose-neutral dark:prose-invert max-w-none space-y-6 text-base md:text-lg leading-relaxed text-muted-foreground">
          <p>
            Kemerdekaan berpendapat, kemerdekaan berekspresi, dan kemerdekaan
            pers adalah hak asasi manusia yang dilindungi Pancasila,
            Undang-Undang Dasar 1945, dan Deklarasi Universal Hak Asasi Manusia
            PBB. Keberadaan media siber di Indonesia juga merupakan bagian dari
            kemerdekaan berpendapat, kemerdekaan berekspresi, dan kemerdekaan
            pers.
          </p>
          <p>
            Media siber memiliki karakter khusus sehingga memerlukan pedoman
            agar pengelolaannya dapat dilaksanakan secara profesional, memenuhi
            fungsi, hak, dan kewajibannya sesuai Undang-Undang Nomor 40 Tahun
            1999 tentang Pers dan Kode Etik Jurnalistik. Untuk itu Dewan Pers
            bersama organisasi pers, pengelola media siber, dan masyarakat
            menyusun Pedoman Pemberitaan Media Siber sebagai berikut:
          </p>

          <div className="space-y-8 pt-4 text-foreground">
            {/* 1. Ruang Lingkup */}
            <section>
              <h2 className="mb-2 text-xl font-semibold">1. Ruang Lingkup</h2>
              <p className="text-muted-foreground">
                Media Siber adalah segala bentuk media yang menggunakan wahana
                Internet dan melaksanakan kegiatan jurnalistik, serta memenuhi
                persyaratan Undang-Undang Pers dan Standar Perusahaan Pers yang
                ditetapkan Dewan Pers. Isi Buatan Pengguna (User Generated
                Content) adalah segala isi yang dibuat dan atau dipublikasikan
                oleh pengguna media siber, antara lain, artikel, gambar,
                komentar, suara, video dan berbagai bentuk unggahan yang melekat
                pada media siber, seperti blog, forum, komentar pembaca atau
                pemirsa, dan bentuk lain.
              </p>
            </section>

            {/* 2. Verifikasi dan keberimbangan berita */}
            <section>
              <h2 className="mb-2 text-xl font-semibold">
                2. Verifikasi dan keberimbangan berita
              </h2>
              <ol className="list-inside list-[lower-alpha] space-y-2 text-muted-foreground pl-2">
                <li>Pada prinsipnya setiap berita harus melalui verifikasi.</li>
                <li>
                  Berita yang dapat merugikan pihak lain memerlukan verifikasi
                  pada berita yang sama untuk memenuhi prinsip akurasi dan
                  keberimbangan.
                </li>
                <li>
                  Ketentuan dalam butir (a) di atas dikecualikan, dengan syarat:
                  <ul className="list-inside list-decimal space-y-1 pl-6 pt-2">
                    <li>
                      Berita benar-benar mengandung kepentingan publik yang
                      bersifat mendesak;
                    </li>
                    <li>
                      Sumber berita yang pertama adalah sumber yang jelas
                      disebutkan identitasnya, kredibel dan kompeten;
                    </li>
                    <li>
                      Subyek berita yang harus dikonfirmasi tidak diketahui
                      keberadaannya dan atau tidak dapat diwawancarai;
                    </li>
                    <li>
                      Media memberikan penjelasan kepada pembaca bahwa berita
                      tersebut masih memerlukan verifikasi lebih lanjut yang
                      diupayakan dalam waktu secepatnya. Penjelasan dimuat pada
                      bagian akhir dari berita yang sama, di dalam kurung dan
                      menggunakan huruf miring.
                    </li>
                  </ul>
                </li>
                <li>
                  Setelah memuat berita sesuai dengan butir (c), media wajib
                  meneruskan upaya verifikasi, dan setelah verifikasi
                  didapatkan, hasil verifikasi dicantumkan pada berita
                  pemutakhiran (update) dengan tautan pada berita yang belum
                  terverifikasi.
                </li>
              </ol>
            </section>

            {/* 3. Isi Buatan Pengguna */}
            <section>
              <h2 className="mb-2 text-xl font-semibold">
                3. Isi Buatan Pengguna (User Generated Content)
              </h2>
              <ol className="list-inside list-[lower-alpha] space-y-2 text-muted-foreground pl-2">
                <li>
                  Media siber wajib mencantumkan syarat dan ketentuan mengenai
                  Isi Buatan Pengguna yang tidak bertentangan dengan
                  Undang-Undang No. 40 tahun 1999 tentang Pers dan Kode Etik
                  Jurnalistik, yang ditempatkan secara terang dan jelas.
                </li>
                <li>
                  Media siber mewajibkan setiap pengguna untuk melakukan
                  registrasi keanggotaan dan melakukan proses log-in terlebih
                  dahulu untuk dapat mempublikasikan semua bentuk Isi Buatan
                  Pengguna. Ketentuan mengenai log-in akan diatur lebih lanjut.
                </li>
                <li>
                  Dalam registrasi tersebut, media siber mewajibkan pengguna
                  memberi persetujuan tertulis bahwa Isi Buatan Pengguna yang
                  dipublikasikan:
                  <ul className="list-inside list-decimal space-y-1 pl-6 pt-2">
                    <li>Tidak memuat isi bohong, fitnah, sadis dan cabul;</li>
                    <li>
                      Tidak memuat isi yang mengandung prasangka dan kebencian
                      terkait dengan suku, agama, ras, dan antargolongan (SARA),
                      serta menganjurkan tindakan kekerasan;
                    </li>
                    <li>
                      Tidak memuat isi diskriminatif atas dasar perbedaan jenis
                      kelamin dan bahasa, serta tidak merendahkan martabat orang
                      lemah, miskin, sakit, cacat jiwa, atau cacat jasmani.
                    </li>
                  </ul>
                </li>
                <li>
                  Media siber memiliki kewenangan mutlak untuk mengedit atau
                  menghapus Isi Buatan Pengguna yang bertentangan dengan butir
                  (c). Media siber wajib menyediakan mekanisme pengaduan Isi
                  Buatan Pengguna yang dinilai melanggar ketentuan pada butir
                  (c). Mekanisme tersebut harus disediakan di tempat yang dengan
                  mudah dapat diakses pengguna.
                </li>
                <li>
                  Media siber wajib menyunting, menghapus, dan melakukan
                  tindakan koreksi setiap Isi Buatan Pengguna yang dilaporkan
                  dan melanggar ketentuan butir (c), sesegera mungkin secara
                  proporsional selambat-lambatnya 2 x 24 jam setelah pengaduan
                  diterima.
                </li>
                <li>
                  Media siber yang telah memenuhi ketentuan pada butir (a), (b),
                  (c), dan (f) tidak dibebani tanggung jawab atas masalah yang
                  ditimbulkan akibat pemuatan isi yang melanggar ketentuan pada
                  butir (c).
                </li>
                <li>
                  Media siber bertanggung jawab atas Isi Buatan Pengguna yang
                  dilaporkan bila tidak mengambil tindakan koreksi setelah batas
                  waktu sebagaimana tersebut pada butir (f).
                </li>
              </ol>
            </section>

            {/* 4. Ralat, Koreksi, dan Hak Jawab */}
            <section>
              <h2 className="mb-2 text-xl font-semibold">
                4. Ralat, Koreksi, dan Hak Jawab
              </h2>
              <ol className="list-inside list-[lower-alpha] space-y-2 text-muted-foreground pl-2">
                <li>
                  Ralat, koreksi, dan hak jawab mengacu pada Undang-Undang Pers,
                  Kode Etik Jurnalistik, dan Pedoman Hak Jawab yang ditetapkan
                  Dewan Pers.
                </li>
                <li>
                  Ralat, koreksi dan atau hak jawab wajib ditautkan pada berita
                  yang diralat, dikoreksi atau yang diberi hak jawab.
                </li>
                <li>
                  Di setiap berita ralat, koreksi, dan hak jawab wajib
                  dicantumkan waktu pemuatan ralat, koreksi, dan atau hak jawab
                  tersebut.
                </li>
                <li>
                  Bila suatu berita media siber tertentu disebarluaskan media
                  siber lain, maka:
                  <ul className="list-inside list-decimal space-y-1 pl-6 pt-2">
                    <li>
                      Tanggung jawab media siber pembuat berita terbatas pada
                      berita yang dipublikasikan di media siber tersebut atau
                      media siber yang berada di bawah otoritas teknisnya;
                    </li>
                    <li>
                      Koreksi berita yang dilakukan oleh sebuah media siber,
                      juga harus dilakukan oleh media siber lain yang mengutip
                      berita dari media siber yang dikoreksi itu;
                    </li>
                    <li>
                      Media yang menyebarluaskan berita dari sebuah media siber
                      dan tidak melakukan koreksi atas berita sesuai yang
                      dilakukan oleh media siber pemilik dan atau pembuat berita
                      tersebut, bertanggung jawab penuh atas semua akibat hukum
                      dari berita yang tidak dikoreksinya itu.
                    </li>
                  </ul>
                </li>
                <li>
                  Sesuai dengan Undang-Undang Pers, media siber yang tidak
                  melayani hak jawab dapat dijatuhi sanksi hukum pidana denda
                  paling banyak Rp500.000.000 (Lima ratus juta rupiah).
                </li>
              </ol>
            </section>

            {/* 5. Pencabutan Berita */}
            <section>
              <h2 className="mb-2 text-xl font-semibold">
                5. Pencabutan Berita
              </h2>
              <ol className="list-inside list-[lower-alpha] space-y-2 text-muted-foreground pl-2">
                <li>
                  Berita yang sudah dipublikasikan tidak dapat dicabut karena
                  alasan penyensoran dari pihak luar redaksi, kecuali terkait
                  masalah SARA, kesusilaan, masa depan anak, pengalaman
                  traumatik korban atau berdasarkan pertimbangan khusus lain
                  yang ditetapkan Dewan Pers.
                </li>
                <li>
                  Media siber lain wajib mengikuti pencabutan kutipan berita
                  dari media asal yang telah dicabut.
                </li>
                <li>
                  Pencabutan berita wajib disertai dengan alasan pencabutan dan
                  diumumkan kepada publik.
                </li>
              </ol>
            </section>

            {/* 6. Iklan */}
            <section>
              <h2 className="mb-2 text-xl font-semibold">6. Iklan</h2>
              <ol className="list-inside list-[lower-alpha] space-y-2 text-muted-foreground pl-2">
                <li>
                  Media siber wajib membedakan dengan tegas antara produk berita
                  dan iklan.
                </li>
                <li>
                  Setiap berita/artikel/isi yang merupakan iklan dan atau isi
                  berbayar wajib mencantumkan keterangan "advertorial", "iklan",
                  "ads", "sponsored", atau kata lain yang menjelaskan bahwa
                  berita/artikel/isi tersebut adalah iklan.
                </li>
              </ol>
            </section>

            {/* 7. Hak Cipta */}
            <section>
              <h2 className="mb-2 text-xl font-semibold">7. Hak Cipta</h2>
              <p className="text-muted-foreground">
                Media siber wajib menghormati hak cipta sebagaimana diatur dalam
                peraturan perundang-undangan yang berlaku.
              </p>
            </section>

            {/* 8. Pencantuman Pedoman */}
            <section>
              <h2 className="mb-2 text-xl font-semibold">
                8. Pencantuman Pedoman
              </h2>
              <p className="text-muted-foreground">
                Media siber wajib mencantumkan Pedoman Pemberitaan Media Siber
                ini di medianya secara terang dan jelas.
              </p>
            </section>

            {/* 9. Sengketa */}
            <section>
              <h2 className="mb-2 text-xl font-semibold">9. Sengketa</h2>
              <p className="text-muted-foreground">
                Penilaian akhir atas sengketa mengenai pelaksanaan Pedoman
                Pemberitaan Media Siber ini diselesaikan oleh Dewan Pers.
              </p>
            </section>
          </div>

          <div className="mt-12 border-t border-border pt-6 text-sm text-muted-foreground">
            <p>Jakarta, 3 Februari 2012</p>
            <p className="italic">
              (Pedoman ini ditandatangani oleh Dewan Pers dan komunitas pers di
              Jakarta, 3 Februari 2012).
            </p>
          </div>
        </article>
      </div>
    </main>
  );
}
