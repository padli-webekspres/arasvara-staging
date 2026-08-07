import DividerHorizontal from "@/components/homepage/DividerHorizontal";
import React from "react";
import type { Metadata } from "next";

/**
 * SEO Metadata khusus halaman Disclaimer & Batasan Tanggung Jawab.
 * Mencegah bentrokan Duplicate Title Tag dengan Halaman Utama (Homepage).
 */
export const metadata: Metadata = {
  title: "Disclaimer & Batasan Tanggung Jawab",
  description:
    "Pernyataan penting mengenai batasan tanggung jawab, penggunaan informasi, serta kebijakan konten di platform Arasvara.",
  openGraph: {
    title: "Disclaimer & Batasan Tanggung Jawab | Arasvara",
    description:
      "Pernyataan penting mengenai batasan tanggung jawab, penggunaan informasi, serta kebijakan konten di platform Arasvara.",
    type: "website",
    locale: "id_ID",
  },
  twitter: {
    card: "summary_large_image",
    title: "Disclaimer & Batasan Tanggung Jawab | Arasvara",
    description:
      "Pernyataan penting mengenai batasan tanggung jawab, penggunaan informasi, serta kebijakan konten di platform Arasvara.",
  },
};

const KetentuanKontenPage = () => {
  return (
    <main className="min-h-screen bg-background py-24 lg:py-32">
      {/* Header Halaman */}
      <section className="container xl:max-w-6xl mx-auto w-full min-w-0 px-4 md:px-6 lg:px-8 mb-8 md:mb-12">
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground tracking-tight mb-4">
          Disclaimer
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl leading-relaxed">
          Pernyataan penting mengenai batasan tanggung jawab, penggunaan
          informasi, serta kebijakan konten di platform Arasvara.
        </p>
      </section>

      <div className="flex flex-col gap-8 md:gap-12">
        {/* 1. Informasi Umum */}
        <section className="container xl:max-w-6xl relative flex flex-col md:flex-row mx-auto w-full min-w-0 px-4 md:px-6 lg:px-8 gap-6 md:gap-12">
          <h2 className="text-2xl md:text-3xl font-bold w-full md:w-1/3 text-primary shrink-0  h-fit">
            1. Informasi Umum
          </h2>
          <div className="w-full md:w-2/3 space-y-4 text-base md:text-lg leading-relaxed text-muted-foreground">
            <p>
              Seluruh konten yang dipublikasikan pada platform Arasvara
              disediakan untuk tujuan informasi umum, edukasi, dan referensi.
            </p>
            <p>
              Redaksi berupaya menjaga akurasi, relevansi, dan kelengkapan
              informasi, namun tidak menjamin bahwa seluruh konten selalu
              mutakhir, bebas kesalahan, atau sesuai dengan kebutuhan spesifik
              setiap pembaca.
            </p>
          </div>
        </section>

        <DividerHorizontal
          variant="dark"
          className="mx-auto w-full max-w-3xl "
        />

        {/* 2. Akurasi dan Validitas Data */}
        <section className="container xl:max-w-6xl relative flex flex-col md:flex-row mx-auto w-full min-w-0 px-4 md:px-6 lg:px-8 gap-6 md:gap-12">
          <h2 className="text-2xl md:text-3xl font-bold w-full md:w-1/3 text-primary shrink-0  h-fit">
            2. Akurasi dan Validitas Data
          </h2>
          <div className="w-full md:w-2/3 space-y-4 text-base md:text-lg leading-relaxed text-muted-foreground">
            <p>
              Informasi, data, opini, dan analisis yang dipublikasikan dapat
              berasal dari:
            </p>
            <ul className="list-disc pl-6 space-y-2 marker:text-primary">
              <li>hasil liputan internal,</li>
              <li>rilis resmi pemerintah/perusahaan,</li>
              <li>sumber pihak ketiga,</li>
              <li>pendapat para ahli,</li>
              <li>atau kontribusi penulis lepas (kontributor).</li>
            </ul>
            <p>
              Kami tidak bertanggung jawab atas ketidakakuratan, kesalahan
              penafsiran, atau potensi misinformasi yang timbul dari sumber luar
              yang tidak berada di bawah pengawasan langsung redaksi.
            </p>
          </div>
        </section>

        <DividerHorizontal
          variant="dark"
          className="mx-auto w-full max-w-3xl opacity-10"
        />

        {/* 3. Opini dan Editorial */}
        <section className="container xl:max-w-6xl relative flex flex-col md:flex-row mx-auto w-full min-w-0 px-4 md:px-6 lg:px-8 gap-6 md:gap-12">
          <h2 className="text-2xl md:text-3xl font-bold w-full md:w-1/3 text-primary shrink-0  h-fit">
            3. Opini dan Editorial
          </h2>
          <div className="w-full md:w-2/3 space-y-4 text-base md:text-lg leading-relaxed text-muted-foreground">
            <p>
              Artikel opini, kolom, ulasan, atau konten berbasis perspektif
              penulis merupakan pandangan pribadi penulis dan tidak selalu
              mencerminkan sikaр resmi redaksi maupun perusahaan.
            </p>
            <p>
              Segala konsekuensi yang timbul dari interpretasi terhadap opini
              menjadi tanggung jawab pembaca.
            </p>
          </div>
        </section>

        <DividerHorizontal
          variant="dark"
          className="mx-auto w-full max-w-3xl opacity-10"
        />

        {/* 4. Perubahan Konten */}
        <section className="container xl:max-w-6xl relative flex flex-col md:flex-row mx-auto w-full min-w-0 px-4 md:px-6 lg:px-8 gap-6 md:gap-12">
          <h2 className="text-2xl md:text-3xl font-bold w-full md:w-1/3 text-primary shrink-0  h-fit">
            4. Perubahan Konten
          </h2>
          <div className="w-full md:w-2/3 space-y-4 text-base md:text-lg leading-relaxed text-muted-foreground">
            <p>Redaksi berhak untuk:</p>
            <ul className="list-disc pl-6 space-y-2 marker:text-primary">
              <li>memperbarui,</li>
              <li>mengubah,</li>
              <li>memperbaiki,</li>
              <li>atau menghapus</li>
            </ul>
            <p>
              konten kapan saja tanpa pemberitahuan sebelumnya demi menjaga
              kualitas dan kepatuhan terhadap standar editorial.
            </p>
          </div>
        </section>

        <DividerHorizontal
          variant="dark"
          className="mx-auto w-full max-w-3xl opacity-10"
        />

        {/* 5. Tautan ke Pihak Ketiga */}
        <section className="container xl:max-w-6xl relative flex flex-col md:flex-row mx-auto w-full min-w-0 px-4 md:px-6 lg:px-8 gap-6 md:gap-12">
          <h2 className="text-2xl md:text-3xl font-bold w-full md:w-1/3 text-primary shrink-0  h-fit">
            5. Tautan ke Pihak Ketiga (External Links)
          </h2>
          <div className="w-full md:w-2/3 space-y-4 text-base md:text-lg leading-relaxed text-muted-foreground">
            <p>
              Platform ini dapat memuat tautan ke situs eksternal. Tautan
              tersebut disediakan untuk kemudahan akses dan tidak menunjukkan
              dukungan, afiliasi, atau verifikasi atas isi situs tersebut.
            </p>
            <p>
              Kami tidak bertanggung jawab atas konten, kebijakan privasi,
              maupun keamanan data pada situs pihak ketiga.
            </p>
          </div>
        </section>

        <DividerHorizontal
          variant="dark"
          className="mx-auto w-full max-w-3xl opacity-10"
        />

        {/* 6. Konten Sponsor, Advertorial, dan Iklan */}
        <section className="container xl:max-w-6xl relative flex flex-col md:flex-row mx-auto w-full min-w-0 px-4 md:px-6 lg:px-8 gap-6 md:gap-12">
          <h2 className="text-2xl md:text-3xl font-bold w-full md:w-1/3 text-primary shrink-0  h-fit">
            6. Konten Sponsor, Advertorial, dan Iklan
          </h2>
          <div className="w-full md:w-2/3 space-y-4 text-base md:text-lg leading-relaxed text-muted-foreground">
            <p>
              Beberapa konten pada platform ini mungkin berupa advertorial,
              artikel berbayar, atau konten brand partnership.
            </p>
            <p>
              Setiap bentuk kerja sama komersial akan ditandai secara jelas
              sesuai dengan regulasi dan etika industri media. Namun, kami tetap
              menjaga integritas editorial dalam semua publikasi.
            </p>
          </div>
        </section>

        <DividerHorizontal
          variant="dark"
          className="mx-auto w-full max-w-3xl opacity-10"
        />

        {/* 7. Tanggung Jawab Penggunaan Informasi */}
        <section className="container xl:max-w-6xl relative flex flex-col md:flex-row mx-auto w-full min-w-0 px-4 md:px-6 lg:px-8 gap-6 md:gap-12">
          <h2 className="text-2xl md:text-3xl font-bold w-full md:w-1/3 text-primary shrink-0  h-fit">
            7. Tanggung Jawab Penggunaan Informasi
          </h2>
          <div className="w-full md:w-2/3 space-y-4 text-base md:text-lg leading-relaxed text-muted-foreground">
            <p>
              Segala tindakan atau keputusan yang diambil pembaca berdasarkan
              konten yang tersedia merupakan tanggung jawab pribadi pembaca.
              Media tidak bertanggung jawab atas:
            </p>
            <ul className="list-disc pl-6 space-y-2 marker:text-primary">
              <li>kerugian material atau immaterial,</li>
              <li>keputusan bisnis atau finansial,</li>
              <li>tindakan pribadi,</li>
              <li>
                atau konsekuensi hukum yang timbul akibat penggunaan informasi
                dari platform ini.
              </li>
            </ul>
          </div>
        </section>

        <DividerHorizontal
          variant="dark"
          className="mx-auto w-full max-w-3xl opacity-10"
        />

        {/* 8. Hak Cipta & Distribusi */}
        <section className="container xl:max-w-6xl relative flex flex-col md:flex-row mx-auto w-full min-w-0 px-4 md:px-6 lg:px-8 gap-6 md:gap-12">
          <h2 className="text-2xl md:text-3xl font-bold w-full md:w-1/3 text-primary shrink-0  h-fit">
            8. Hak Cipta & Distribusi
          </h2>
          <div className="w-full md:w-2/3 space-y-4 text-base md:text-lg leading-relaxed text-muted-foreground">
            <p>
              Seluruh konten (teks, gambar, video, desain, infografik) yang
              dipublikasikan memiliki hak cipta dan dilindungi oleh peraturan
              perundang-undangan.
            </p>
          </div>
        </section>

        <DividerHorizontal
          variant="dark"
          className="mx-auto w-full max-w-3xl opacity-10"
        />

        {/* 9. Ketentuan Hukum */}
        <section className="container xl:max-w-6xl relative flex flex-col md:flex-row mx-auto w-full min-w-0 px-4 md:px-6 lg:px-8 gap-6 md:gap-12">
          <h2 className="text-2xl md:text-3xl font-bold w-full md:w-1/3 text-primary shrink-0  h-fit">
            9. Ketentuan Hukum
          </h2>
          <div className="w-full md:w-2/3 space-y-4 text-base md:text-lg leading-relaxed text-muted-foreground">
            <p>
              Dengan mengakses platform ini, pengguna menyetujui bahwa seluruh
              disclaimer dan kebijakan yang berlaku tunduk pada hukum dan
              peraturan yang berlaku di Indonesia.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
};

export default KetentuanKontenPage;
