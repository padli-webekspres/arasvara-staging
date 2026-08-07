import React from "react";
import Image from "next/image";

interface LogoLoaderProps {
  onComplete?: () => void;
}

/**
 * Loader CSS-only — tanpa GSAP di critical path.
 */
const LogoLoader: React.FC<LogoLoaderProps> = () => {
  return (
    <div className="flex flex-col items-center justify-center h-full w-full">
      <div className="relative w-[160px] h-[50px] md:w-[200px] md:h-[60px]">
        <div className="absolute inset-0 opacity-10">
          <Image
            src="/logo-arasvara/main-logo/main-logo-hitam-gema-w640.webp"
            alt=""
            fill
            unoptimized
            className="object-contain object-left"
          />
        </div>

        <div className="logo-reveal-window absolute top-0 left-0 h-full overflow-hidden">
          <div className="relative w-[160px] h-[50px] md:w-[200px] md:h-[60px]">
            <Image
              src="/logo-arasvara/main-logo/main-logo-hitam-gema-w640.webp"
              alt="Arasvara Logo Loading"
              fill
              unoptimized
              className="object-contain object-left"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default LogoLoader;
