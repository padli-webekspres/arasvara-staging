import type { ComponentType } from "react";
import Link from "next/link";
import { Copyright } from "lucide-react";
import Image from "next/image";
import { FOOTER_MORE } from "@/lib/constants";
import {
  FacebookIcon,
  InstagramIcon,
  TelegramIcon,
  ThreadsIcon,
  WaIcon,
  XIcon,
} from "./icon/SocmedIcon";
import type {
  FooterSocialIconId,
  FooterViewProps,
} from "@/lib/footer-view-props";

const footerLinkClass =
  "text-gray-300 hover:text-white transition-colors text-sm";

const columnTitleClass =
  "text-xl font-semibold uppercase tracking-wider mb-4 text-white";

const SOCIAL_ICONS: Record<
  FooterSocialIconId,
  ComponentType<{ className?: string }>
> = {
  instagram: InstagramIcon,
  x: XIcon,
  facebook: FacebookIcon,
  threads: ThreadsIcon,
  whatsapp: WaIcon,
  telegram: TelegramIcon,
};

export default function FooterView({
  copyrightText,
  socialLinks,
  isLoading = false,
}: FooterViewProps) {
  return (
    <footer className="bg-primary text-white py-10 md:py-12">
      <div className="container mx-auto px-4 md:px-6">
        <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between lg:gap-x-10 xl:gap-x-16">
          <div className="flex shrink-0 justify-center lg:justify-start lg:pt-1">
            <Link
              href="/"
              className="relative block h-20 w-44 sm:h-24 sm:w-52 md:w-56"
              aria-label="Beranda Arasvara"
            >
              <Image
                src="/logo-arasvara/stacked-logo/stacked-logo-putih-naskah-w640.webp"
                alt="Arasvara"
                width={640}
                height={160}
                unoptimized
                className="hidden object-contain object-left lg:block"
                sizes="224px"
              />
              <Image
                src="/logo-arasvara/main-logo/main-logo-putih-naskah-w640.webp"
                alt="Arasvara"
                width={640}
                height={160}
                unoptimized
                className="object-contain object-center lg:hidden"
                sizes="(max-width: 1024px) 224px"
              />
            </Link>
          </div>

          <nav
            className="min-w-0 text-center lg:w-auto lg:shrink-0 lg:text-left"
            aria-label="Tautan lainnya"
          >
            <p className={columnTitleClass}>More</p>
            <ul className="flex flex-col items-center gap-2 lg:items-start">
              {FOOTER_MORE.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className={footerLinkClass}>
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex min-w-0 flex-1 flex-col gap-5 text-center lg:max-w-2xl lg:text-left">
            {isLoading ? (
              <div className="h-12 w-full animate-pulse rounded bg-white/10" />
            ) : (
              <p className="text-xs leading-relaxed text-gray-300">
                <Copyright className="inline-block w-3.5 h-3.5" /> 2026.{" "}
                {copyrightText}
              </p>
            )}

            <nav
              className="flex flex-wrap items-center justify-center gap-2 lg:justify-start"
              aria-label="Media sosial Arasvara"
            >
              {isLoading ? (
                <>
                  {[...Array(3)].map((_, i) => (
                    <div
                      key={`social-skeleton-${i}`}
                      className="h-11 w-11 animate-pulse rounded-full bg-white/10"
                    />
                  ))}
                </>
              ) : (
                socialLinks.map((social) => {
                  const Icon = SOCIAL_ICONS[social.icon];
                  return (
                    <a
                      key={social.name}
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-11 w-11 items-center justify-center text-gray-300 transition-colors hover:text-white"
                      aria-label={social.name}
                    >
                      <Icon className="h-7 w-7 sm:h-8 sm:w-8" />
                    </a>
                  );
                })
              )}
            </nav>
          </div>
        </div>
      </div>
    </footer>
  );
}
