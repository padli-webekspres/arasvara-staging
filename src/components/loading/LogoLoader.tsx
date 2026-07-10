import React, { useRef, useEffect } from "react";
import gsap from "gsap";
import Image from "next/image";

interface LogoLoaderProps {
  onComplete?: () => void; // Opsional jika kamu butuh callback ke parent
}

const LogoLoader: React.FC<LogoLoaderProps> = ({ onComplete }) => {
  // Ref untuk "jendela" yang akan bergerak dari 0% ke 100%
  const revealRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!revealRef.current) return;

    // Pastikan mulai dari 0%
    gsap.set(revealRef.current, { width: "0%" });

    // Animasi GSAP
    const animation = gsap.to(revealRef.current, {
      width: "100%", // Membuka jendela sampai penuh
      duration: 1.5, // Durasi yang nyaman
      ease: "power2.inOut", // Gerakan mulus
      repeat: -1, // Mengulang terus menerus (loop)
      repeatDelay: 0.3, // Jeda sedikit sebelum mengulang
    });

    return () => {
      // Bersihkan saat unmount
      animation.kill();
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-full w-full">
      {/* 1. CONTAINER UTAMA (Ukuran Fix/Pasti) */}
      {/* Ini penting agar layout tidak bergeser saat jendela animasi membesar/mengecil */}
      <div className="relative w-[160px] h-[50px] md:w-[200px] md:h-[60px]">
        {/* LOGO BAYANGAN (Opsional, sangat bagus untuk UX) */}
        {/* Menunjukkan jalur transparan di belakang sebelum diwarnai */}
        <div className="absolute inset-0 opacity-10">
          <Image
            src="/logo-arasvara/main-logo/main-logo-hitam-gema.png"
            alt="Arasvara Shadow"
            fill
            unoptimized
            className="object-contain object-left"
            priority
          />
        </div>

        {/* 2. JENDELA ANIMASI (Yang digerakkan GSAP) */}
        <div
          ref={revealRef}
          // overflow-hidden adalah kunci utamanya!
          className="absolute top-0 left-0 h-full overflow-hidden"
          style={{ width: "0%" }} // Awal
        >
          {/* 3. LOGO ASLI DI DALAM JENDELA */}
          {/* Ukurannya HARUS SAMA PERSIS dengan Container Utama (w-160px dll) */}
          {/* Jika tidak sama, gambar akan gepeng saat jendelanya menyusut */}
          <div className="relative w-[160px] h-[50px] md:w-[200px] md:h-[60px]">
            <Image
              src="/logo-arasvara/main-logo/main-logo-hitam-gema.png"
              alt="Arasvara Logo Loading"
              fill
              unoptimized
              className="object-contain object-left"
              priority
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default LogoLoader;
