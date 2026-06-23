import Link from "next/link";
import { FileQuestion } from "lucide-react"; // Asumsi kamu menggunakan lucide-react untuk icon

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground px-4">
      <div className="flex flex-col items-center text-center space-y-6">
        {/* Ikon atau Ilustrasi */}
        <div className="bg-primary/10 p-6 rounded-full text-primary">
          <FileQuestion className="w-20 h-20" strokeWidth={1.5} />
        </div>

        {/* Teks Error */}
        <div className="space-y-2">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight">404</h1>
          <h2 className="text-xl md:text-2xl font-semibold text-muted-foreground">
            Halaman Tidak Ditemukan
          </h2>
          <p className="text-sm md:text-base text-muted-foreground max-w-md mx-auto">
            Maaf, kami tidak bisa menemukan halaman yang kamu cari. Halaman
            tersebut mungkin telah dipindahkan, dihapus, atau kamu salah
            memasukkan URL.
          </p>
        </div>

        {/* Tombol Kembali ke Home */}
        <Link
          href="/"
          className="inline-flex items-center justify-center px-6 py-3 mt-4 text-sm font-medium text-white transition-colors rounded-lg bg-primary hover:bg-primary/90 focus:outline-hidden focus:ring-2 focus:ring-primary focus:ring-offset-2"
        >
          Kembali ke Beranda
        </Link>
      </div>
    </div>
  );
}
